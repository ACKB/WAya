import { config } from '../config.js';
import { CalendarService } from '../calendar/calendarService.js';
import { DatabaseService } from '../database/db.js';
import { buildSystemPrompt } from './prompt.js';
import { aiTools } from './tools.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export class AIService {
  /**
   * Ejecuta una herramienta llamada por la IA.
   */
  private static async executeTool(
    toolName: string,
    args: any,
    phone: string,
    currentCustomerName: string | null
  ): Promise<string> {
    console.log(`🔧 Ejecutando herramienta [${toolName}] con argumentos:`, args);

    switch (toolName) {
      case 'check_availability': {
        const res = await CalendarService.checkAvailability(args.serviceName, args.date);
        return JSON.stringify({
          servicio: res.service.name,
          duracionMinutos: res.service.durationMinutes,
          resumen: res.summaryText,
          dias: res.days.map(d => ({
            fecha: d.date,
            dia: d.dayOfWeek,
            estaLleno: d.isFull,
            horariosLibres: d.slots.map(s => `${s.start} a ${s.end}`)
          }))
        });
      }

      case 'book_appointment': {
        const clientName = args.customerName || currentCustomerName || 'Cliente';
        const res = await CalendarService.bookAppointment({
          phone,
          customerName: clientName,
          serviceQuery: args.serviceName,
          dateStr: args.date,
          timeStr: args.time
        });
        // Si no teníamos guardado el nombre y lo proporcionó aquí, lo guardamos
        if (clientName && (!currentCustomerName || currentCustomerName !== clientName)) {
          DatabaseService.upsertUserName(phone, clientName);
        }
        return JSON.stringify(res);
      }

      case 'list_services': {
        return JSON.stringify(config.servicesData.services.map(s => ({
          nombre: s.name,
          duracion: `${s.durationMinutes} minutos`,
          precio: `$${s.price}`,
          descripcion: s.description
        })));
      }

      case 'save_customer_name': {
        if (args.name) {
          DatabaseService.upsertUserName(phone, args.name.trim());
          return JSON.stringify({ success: true, message: `Nombre ${args.name} guardado con éxito.` });
        }
        return JSON.stringify({ success: false, message: 'Nombre no válido' });
      }

      default:
        return JSON.stringify({ error: `Herramienta desconocida: ${toolName}` });
    }
  }

  /**
   * Detecta si el usuario está presentándose directamente para guardar el nombre de inmediato.
   */
  static extractAndSaveNameHeuristic(text: string, phone: string): string | null {
    const patterns = [
      /(?:soy|me llamo|mi nombre es)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i,
      /(?:habla|le escribe)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i,
    ];

    const stopWords = ['y', 'que', 'o', 'pero', 'por', 'de', 'para', 'un', 'una', 'el', 'la', 'los', 'las'];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        let parts = match[1].trim().split(/\s+/);
        // Descartar conectores si la última palabra es una stop word
        while (parts.length > 1 && stopWords.includes(parts[parts.length - 1].toLowerCase())) {
          parts.pop();
        }
        const name = parts.join(' ').trim();
        if (name && !stopWords.includes(name.toLowerCase())) {
          DatabaseService.upsertUserName(phone, name);
          console.log(`👤 Nombre detectado y guardado para ${phone}: ${name}`);
          return name;
        }
      }
    }
    return null;
  }

  /**
   * Procesa un mensaje de WhatsApp entrante y retorna la respuesta natural generada por la IA.
   */
  static async generateReply(phone: string, incomingText: string): Promise<string> {
    // 1. Obtener o inferir información del usuario
    let user = DatabaseService.getUser(phone);
    const heurName = this.extractAndSaveNameHeuristic(incomingText, phone);
    const customerName = heurName || user?.name || null;

    // 2. Guardar mensaje del usuario en SQLite
    DatabaseService.saveMessage(phone, 'user', incomingText);

    // 3. Obtener historial reciente
    const recentMessages = DatabaseService.getRecentMessages(phone, 8);
    const systemPrompt = buildSystemPrompt(customerName, phone);

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    // 4. Llamar al proveedor de IA
    try {
      const reply = await this.callAIProvider(messages, phone, customerName);
      // Guardar respuesta del asistente en SQLite
      DatabaseService.saveMessage(phone, 'assistant', reply);
      return reply;
    } catch (error: any) {
      console.error('❌ Error al comunicarse con la IA:', error?.message || error);
      
      // Mensaje de respaldo amable en caso de fallo de conexión con el LLM
      const fallbackReply = `Hola${customerName ? ' ' + customerName : ''}, un gusto saludarle. En este momento estoy verificando nuestros horarios disponibles. Por favor, indíqueme qué tratamiento desea (como tinte, corte o manicure) y le confirmaremos de inmediato.`;
      DatabaseService.saveMessage(phone, 'assistant', fallbackReply);
      return fallbackReply;
    }
  }

  /**
   * Conecta con la API compatible con OpenAI (Ollama local, LM Studio o Cloud).
   */
  private static async callAIProvider(
    messages: ChatMessage[],
    phone: string,
    customerName: string | null
  ): Promise<string> {
    const isCloud = config.ai.provider === 'cloud';
    const baseUrl = isCloud
      ? 'https://generativelanguage.googleapis.com/v1beta/openai' // Endpoint OpenAI de Gemini
      : config.ai.localBaseUrl;

    const apiKey = isCloud ? config.ai.cloudApiKey : 'local-no-key-required';
    const model = isCloud ? 'gemini-1.5-flash' : config.ai.localModel;

    console.log(`🤖 Consultando IA [${model}] en ${baseUrl}...`);

    const requestPayload: any = {
      model,
      messages,
      tools: aiTools,
      tool_choice: 'auto',
      temperature: 0.3,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Error HTTP ${response.status} desde el servidor de IA: ${errText}`);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error('Respuesta vacía del servidor de IA');

    const message = choice.message;

    // Si la IA decidió llamar a una o varias herramientas
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`⚡ La IA solicitó ${message.tool_calls.length} llamada(s) a herramientas.`);
      messages.push(message);

      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          fnArgs = {};
        }

        const toolResult = await this.executeTool(fnName, fnArgs, phone, customerName);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: fnName,
          content: toolResult
        });
      }

      // Volver a llamar a la IA para que redacte la respuesta final con los datos obtenidos
      const followUpResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
        }),
      });

      if (!followUpResponse.ok) {
        const errText = await followUpResponse.text();
        throw new Error(`Error en el seguimiento de herramientas: ${errText}`);
      }

      const followUpData: any = await followUpResponse.json();
      return followUpData.choices?.[0]?.message?.content || 'Con mucho gusto. ¿En qué más puedo ayudarle?';
    }

    return message.content || 'Disculpe, ¿podría repetirme su solicitud?';
  }
}

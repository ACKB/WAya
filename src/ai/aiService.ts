import { config } from '../config.js';
import { CalendarService } from '../calendar/calendarService.js';
import { DatabaseService } from '../database/db.js';
import { buildSystemPrompt } from './prompt.js';
import { aiTools } from './tools.js';
import { LayaRouter } from './layaRouter.js';

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
      /(?:a\s+nombre\s+de|anotame\s+como|anotame\s+a\s+nombre\s+de|con\s+el\s+nombre\s+de)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+)?)/i,
      /(?:habla|le escribe)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i,
    ];

    const stopWords = ['y', 'que', 'o', 'pero', 'por', 'de', 'para', 'un', 'una', 'el', 'la', 'los', 'las'];

    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        let parts = match[1].trim().split(/\s+/);
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

    // Detección directa si el mensaje es únicamente el nombre (ej. "Yolanda", "Yolanda Rodríguez")
    const words = text.trim().split(/\s+/);
    if (words.length >= 1 && words.length <= 3) {
      const isAlpha = words.every(w => /^[A-ZÁÉÍÓÚÑa-záéíóúñ]+$/.test(w));
      const forbidden = [
        'hola', 'buenos', 'dias', 'tardes', 'noches', 'gracias', 'ok', 'dale',
        'tinte', 'corte', 'manicure', 'alisado', 'lunes', 'martes', 'miercoles',
        'jueves', 'viernes', 'sabado', 'domingo', 'hoy', 'manana', 'mañana',
        'salir', 'si', 'no', 'ya', 'perfecto', 'bien', 'claro'
      ];
      if (isAlpha && !words.some(w => forbidden.includes(w.toLowerCase()))) {
        const directName = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        DatabaseService.upsertUserName(phone, directName);
        console.log(`👤 Nombre directo detectado para ${phone}: ${directName}`);
        return directName;
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

    // 3. Ejecutar Laya Decision Engine (Sistema 1) para clasificar y generar formulario fáctico
    let grounded: any = null;
    try {
      grounded = await LayaRouter.generateGroundedForm(phone, customerName, incomingText);
      console.log(`⚡ [Laya Form State] Faltantes: [${grounded.formJson.faltantes.join(', ')}] | Completo: ${grounded.formJson.completo}`);
    } catch (layaErr: any) {
      console.warn('⚠️ Laya Decision Engine aviso:', layaErr?.message || layaErr);
    }

    if (!grounded) {
      return `Hola${customerName ? ' ' + customerName : ''}, un gusto saludarle. ¿En qué podemos ayudarle hoy en el salón?`;
    }

    // 4. Si el formulario está COMPLETO (Tenemos X, Y, Z, A, B y M): emitir respuesta fija estructurada
    if (grounded.formJson.completo && grounded.formJson.respuesta_fija_confirmacion) {
      const titular = grounded.formJson.cliente_titular || grounded.formJson.cliente || 'Cliente';
      const beneficiario = grounded.formJson.beneficiario || titular;
      console.log(`🎯 [Formulario 100% Completo] Confirmando cita para Titular: ${titular}, Beneficiario: ${beneficiario}, Servicio: ${grounded.formJson.servicio} (${grounded.formJson.duracion_minutos} min)...`);
      
      await CalendarService.bookAppointment({
        phone,
        customerName: titular,
        beneficiaryName: beneficiario,
        relationship: grounded.formJson.parentesco || 'titular',
        serviceQuery: grounded.formJson.servicio || 'Servicio',
        durationMinutes: grounded.formJson.duracion_minutos || 30,
        dateStr: grounded.formJson.fecha!,
        timeStr: grounded.formJson.hora_inicio_24!
      });
      DatabaseService.clearDraft(phone);

      // Verificar si el cliente hizo una consulta estética en este mismo mensaje (ej. sobre un color o corte)
      const isAestheticQuery = /(?:color|rubio|negro|naranja|cobrizo|tinte|corte|recomiendas|opinas|queda|tono|laceado|alisado)/i.test(incomingText);
      if (isAestheticQuery) {
        try {
          const aestheticMessages: ChatMessage[] = [
            {
              role: 'system',
              content: `Eres una estilista experta y amable de "${config.servicesData.business.name}".
El cliente preguntó: "${incomingText}".
Respóndele brevemente a su consulta estética (máximo 2 líneas) con calidez, entusiasmo y criterio profesional. NO menciones fechas ni confirmaciones de citas (eso se agrega automáticamente después).`
            },
            { role: 'user', content: incomingText }
          ];
          const advice = await this.callAIProvider(aestheticMessages, phone, customerName);
          const fullReply = `${advice.trim()}\n\n${grounded.formJson.respuesta_fija_confirmacion}`;
          DatabaseService.saveMessage(phone, 'assistant', fullReply);
          return fullReply;
        } catch (err) {
          console.warn('Aviso al consultar consejo estético:', err);
        }
      }

      DatabaseService.saveMessage(phone, 'assistant', grounded.formJson.respuesta_fija_confirmacion);
      return grounded.formJson.respuesta_fija_confirmacion;
    }

    // 5. Si está fuera de tema (Guardrail)
    if (grounded.extracted.isOffTopic) {
      const redirectReply = `Hola${customerName ? ' ' + customerName : ''}, hay que evitar movernos de tema. ¿Para cuándo quisiera su cita o qué tipo de tratamiento desea?`;
      DatabaseService.saveMessage(phone, 'assistant', redirectReply);
      return redirectReply;
    }

    // 6. Si faltan coordinar datos: pasar a Llama SOLO el JSON de estado limpio sin historial largo para no marearlo
    const promptInstructions = `Eres la asistente virtual amable de "${config.servicesData.business.name}".
Atiendes clientes en Perú por WhatsApp. Hablas con mucha amabilidad, sencillez y cortesía.

ESTADO ACTUAL DE LA CITA:
${grounded.formSummaryText}

INSTRUCCIONES CLAVES:
1. Si el cliente hizo una consulta sobre estética, colores o estilos (ej. "¿rubio o negro?", "naranja"), dale tu opinión profesional con entusiasmo (1-2 líneas).
2. Luego, pídele amablemente lo que FALTA COORDINAR (${grounded.formJson.faltantes.join(', ')}).
3. Utiliza SIEMPRE formato de 12 horas con am y pm (ej. "de 10:00 am a 11:30 am", "de 02:00 pm a 06:30 pm"). NUNCA uses formato militar de 24 horas.
4. Mantén la respuesta breve, cálida y directa (máximo 2 párrafos). NO inventes confirmaciones de citas si aún falta coordinar datos.`;

    const messages: ChatMessage[] = [
      { role: 'system', content: promptInstructions },
      { role: 'user', content: incomingText }
    ];

    try {
      const reply = await this.callAIProvider(messages, phone, customerName);
      DatabaseService.saveMessage(phone, 'assistant', reply);
      return reply;
    } catch (error: any) {
      console.error('❌ Error al comunicarse con el modelo generativo:', error?.message || error);
      const fallbackReply = `Hola${customerName ? ' ' + customerName : ''}, con mucho gusto le ayudamos con su cita. Actualmente nos falta coordinar: ${grounded.formJson.faltantes.join(', ')}. ¿Podría indicarnos ese dato para avanzar?`;
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
      temperature: 0.4,
    };

    // Solo incluir tools en la nube si está explícitamente configurado, para evitar errores de gramática en modelos locales
    if (isCloud && process.env.ENABLE_TOOLS === 'true') {
      requestPayload.tools = aiTools;
      requestPayload.tool_choice = 'auto';
    }

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

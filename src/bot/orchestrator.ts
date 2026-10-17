import { AIService } from '../ai/aiService.js';
import { DatabaseService } from '../database/db.js';

export class BotOrchestrator {
  /**
   * Coordina el flujo completo:
   * 1. Consulta la memoria del usuario por teléfono.
   * 2. Llama a la IA con contexto y acceso a las funciones de calendario.
   * 3. Devuelve la respuesta final lista para el cliente.
   */
  static async handleIncomingMessage(phone: string, text: string): Promise<string> {
    const user = DatabaseService.getUser(phone);
    if (user?.name) {
      console.log(`👤 Usuario reconocido: ${user.name} (${phone})`);
    } else {
      console.log(`👤 Usuario nuevo o sin nombre registrado: ${phone}`);
    }

    const reply = await AIService.generateReply(phone, text);
    return reply;
  }
}

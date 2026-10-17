import { DatabaseService } from '../database/db.js';
import { WhatsAppClient } from '../whatsapp/client.js';
import { config } from '../config.js';

export class ReminderScheduler {
  private static intervalHandle: NodeJS.Timeout | null = null;

  static start(intervalSeconds = 60) {
    if (this.intervalHandle) return;

    console.log('⏰ Servicio de recordatorios iniciado (revisión cada minuto)...');
    
    // Ejecutar de inmediato y luego periódicamente
    this.checkAndSendReminders();
    this.intervalHandle = setInterval(() => {
      this.checkAndSendReminders();
    }, intervalSeconds * 1000);
  }

  static stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private static async checkAndSendReminders() {
    const now = new Date();

    // Rango de búsqueda: Citas entre 50 y 70 minutos a partir de ahora (~1 hora antes)
    const windowStart = new Date(now.getTime() + 50 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 70 * 60 * 1000);

    const fromIso = windowStart.toISOString().substring(0, 19);
    const toIso = windowEnd.toISOString().substring(0, 19);

    try {
      const pendingAppointments = DatabaseService.getUpcomingAppointmentsForReminder(fromIso, toIso);

      for (const appt of pendingAppointments) {
        const timePart = appt.start_time.split('T')[1]?.substring(0, 5) || '';

        const reminderMsg = `Hola ${appt.customer_name}, le recordamos con mucho gusto que tiene su cita para *${appt.service_name}* programada para hoy a las *${timePart} hrs*.\n\n⚠️ Le recomendamos llegar con *15 minutos de anticipación* para iniciar puntualmente su atención.\n\n¡Le esperamos en ${config.servicesData.business.name}! 😊`;

        console.log(`📢 Enviando recordatorio de 1 hora a ${appt.customer_name} (${appt.phone})...`);

        const sent = await WhatsAppClient.sendMessage(appt.phone, reminderMsg);
        if (sent) {
          DatabaseService.markReminderSent(appt.id);
          DatabaseService.saveMessage(appt.phone, 'assistant', reminderMsg);
          console.log(`✅ Recordatorio enviado exitosamente a ${appt.phone}`);
        }
      }
    } catch (err: any) {
      console.error('Error al ejecutar el servicio de recordatorios:', err?.message || err);
    }
  }
}

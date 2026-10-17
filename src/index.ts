import { config } from './config.js';
import { CalendarService } from './calendar/calendarService.js';
import { ReminderScheduler } from './scheduler/reminder.js';
import { WhatsAppClient } from './whatsapp/client.js';

async function main() {
  console.log('========================================================');
  console.log(`🚀 INICIANDO BOT DE CITAS PARA: ${config.servicesData.business.name}`);
  console.log(`🤖 Modo de IA: ${config.ai.provider.toUpperCase()}`);
  if (config.ai.provider === 'local') {
    console.log(`📍 Endpoint Local: ${config.ai.localBaseUrl} (Modelo: ${config.ai.localModel})`);
  }
  console.log('========================================================\n');

  // 1. Inicializar calendario (Google Calendar o Local Mock)
  CalendarService.initGoogleCalendar();

  // 2. Iniciar servicio de recordatorios (revisa cada minuto citas de 1h antes)
  ReminderScheduler.start();

  // 3. Iniciar conexión de WhatsApp vía Baileys
  await WhatsAppClient.start();

  // Manejo de apagado limpio
  const handleExit = () => {
    console.log('\n🛑 Cerrando bot...');
    ReminderScheduler.stop();
    process.exit(0);
  };

  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);
}

main().catch(err => {
  console.error('❌ Error fatal al iniciar el bot:', err);
  process.exit(1);
});

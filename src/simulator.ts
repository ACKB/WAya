import readline from 'node:readline';
import { BotOrchestrator } from './bot/orchestrator.js';
import { CalendarService } from './calendar/calendarService.js';
import { config } from './config.js';

async function runSimulator() {
  console.clear();
  console.log('========================================================');
  console.log('🧪 SIMULADOR INTERACTIVO DEL BOT DE CITAS');
  console.log('   (Prueba la conversación antes o en paralelo a WhatsApp)');
  console.log('========================================================');
  console.log(`Negocio: ${config.servicesData.business.name}`);
  console.log(`IA: ${config.ai.provider} (${config.ai.localModel})`);
  console.log('Escribe "salir" para terminar la simulación.\n');

  CalendarService.initGoogleCalendar();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const testPhone = '51987654321';

  const promptUser = () => {
    rl.question('\n👤 Cliente: ', async (input) => {
      const text = input.trim();
      if (!text || text.toLowerCase() === 'salir') {
        rl.close();
        process.exit(0);
      }

      try {
        console.log('⏳ Bot pensando...');
        const reply = await BotOrchestrator.handleIncomingMessage(testPhone, text);
        console.log(`\n🤖 Bot:\n${reply}`);
      } catch (err: any) {
        console.error('Error:', err?.message || err);
      }

      promptUser();
    });
  };

  promptUser();
}

runSimulator();

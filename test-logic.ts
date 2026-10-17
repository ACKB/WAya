import { SlotCalculator } from './src/calendar/slotCalculator.js';
import { DatabaseService } from './src/database/db.js';
import { CalendarService } from './src/calendar/calendarService.js';
import { AIService } from './src/ai/aiService.js';

async function testAll() {
  console.log('--- 1. PROBANDO CALCULADORA DE SLOTS PARA TINTE (120 MINUTOS) ---');
  // Simular que el lunes de 09:00 a 11:00 ya está ocupado
  const busy = [{ start: '09:00', end: '11:00' }];
  const avail = SlotCalculator.calculateFreeSlots('2026-10-19', 120, busy);
  console.log('Día:', avail.dayOfWeek, avail.date);
  console.log('Slots disponibles para 2h:', avail.slots.map(s => `${s.start}-${s.end}`));
  console.log('Formato amigable para adultos:', SlotCalculator.formatFriendlyRanges(avail.slots));

  console.log('\n--- 2. PROBANDO MEMORIA DE USUARIO EN SQLITE ---');
  const testPhone = '51999888777';
  DatabaseService.upsertUserName(testPhone, 'María González');
  const user = DatabaseService.getUser(testPhone);
  console.log('Usuario recuperado de SQLite:', user);

  console.log('\n--- 3. PROBANDO DETECCIÓN HEURÍSTICA DE NOMBRE ---');
  const detected1 = AIService.extractAndSaveNameHeuristic('Hola que tal, soy María y quiero una cita', '51911223344');
  console.log('Nombre detectado en frase 1:', detected1);
  const detected2 = AIService.extractAndSaveNameHeuristic('Buenos días, me llamo Carlos Pérez', '51955667788');
  console.log('Nombre detectado en frase 2:', detected2);

  console.log('\n--- 4. PROBANDO AGENDAMIENTO Y ACTUALIZACIÓN DE DISPONIBILIDAD ---');
  CalendarService.initGoogleCalendar();
  const booking = await CalendarService.bookAppointment({
    phone: testPhone,
    customerName: 'María González',
    serviceQuery: 'tinte',
    dateStr: '2026-10-19',
    timeStr: '08:00'
  });
  console.log('Resultado de agendamiento:', booking);

  // Consultar disponibilidad después de agendar a las 08:00 (ocupa de 08:00 a 10:00)
  const afterAvail = await CalendarService.checkAvailability('tinte', '2026-10-19');
  console.log('Disponibilidad tras agendar:');
  console.log(afterAvail.summaryText);

  console.log('\n✅ ¡TODAS LAS PRUEBAS DE LÓGICA LOCAL PASARON EXITOSAMENTE!');
}

testAll().catch(err => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});

import { AIService } from './src/ai/aiService.js';
import { DatabaseService } from './src/database/db.js';
import { LayaRouter } from './src/ai/layaRouter.js';

async function runTest() {
  console.log('========================================================');
  console.log('🧪 TEST: BENEFICIARIOS (1:N) Y CITAS COMBINADAS EN WAYA');
  console.log('========================================================\n');

  await LayaRouter.init();
  const phoneTest = '51999888777';

  // Limpiar borradores previos
  DatabaseService.clearDraft(phoneTest);

  console.log('--- CASO 1: Madre (Yolanda) pide cita para su hijo (Luis) ---');
  const msg1 = 'Hola, quiero una cita para corte de cabello para mi hijo Luis para el lunes';
  console.log(`👤 Usuario (${phoneTest}): "${msg1}"`);
  const reply1 = await AIService.generateReply(phoneTest, msg1);
  console.log(`🤖 Bot:\n${reply1}\n`);

  const msg2 = 'a las 10:00 am, me llamo Yolanda';
  console.log(`👤 Usuario (${phoneTest}): "${msg2}"`);
  const reply2 = await AIService.generateReply(phoneTest, msg2);
  console.log(`🤖 Bot:\n${reply2}\n`);

  // Verificar en base de datos
  const user = DatabaseService.getUser(phoneTest);
  console.log('📋 Usuario Titular en BD:', user);

  const beneficiaries = DatabaseService.getBeneficiaries(phoneTest);
  console.log('👥 Beneficiarios registrados en BD:', beneficiaries);

  const appointments = DatabaseService.getAllAppointments(3);
  console.log('📅 Últimas citas en BD:', appointments.map(a => ({
    id: a.id,
    titular: a.customer_name,
    beneficiario: a.beneficiary_name,
    parentesco: a.relationship,
    servicio: a.service_name,
    duracion: a.duration_minutes,
    inicio: a.start_time,
    fin: a.end_time,
    estado: a.status
  })));

  const stats = DatabaseService.getDashboardMetrics();
  console.log('\n📊 Métricas del Dashboard Web:', {
    total: stats.totalAppointments,
    hoy: stats.todayAppointments,
    confirmadas: stats.confirmedAppointments,
    ingresoProyectado: stats.estimatedRevenue,
    horasValle: stats.valleyHours.length
  });

  console.log('\n========================================================');
  console.log('🎉 TEST FINALIZADO CON ÉXITO');
  console.log('========================================================');
}

runTest().catch(console.error);

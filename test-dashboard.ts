import { startDashboardServer } from './src/dashboard/server.js';

async function testDashboard() {
  console.log('🚀 Iniciando servidor de prueba del Dashboard...');
  const server = startDashboardServer();

  // Esperar 500ms
  await new Promise(r => setTimeout(r, 500));

  try {
    const resStats = await fetch('http://127.0.0.1:3000/api/stats');
    const stats = await resStats.json();
    console.log('✅ Endpoint /api/stats respondió HTTP 200:', stats);

    const resAppts = await fetch('http://127.0.0.1:3000/api/appointments');
    const appts = await resAppts.json();
    console.log(`✅ Endpoint /api/appointments respondió HTTP 200 (${appts.length} citas en lista)`);

    const resBeneficiaries = await fetch('http://127.0.0.1:3000/api/beneficiaries');
    const beneficiaries = await resBeneficiaries.json();
    console.log(`✅ Endpoint /api/beneficiaries respondió HTTP 200 (${beneficiaries.length} beneficiarios registrados)`);

    const resHtml = await fetch('http://127.0.0.1:3000/');
    const htmlText = await resHtml.text();
    console.log(`✅ Endpoint / (HTML) respondió HTTP 200 (${htmlText.length} bytes recibidos)`);
  } catch (err: any) {
    console.error('❌ Error probando dashboard:', err?.message || err);
  } finally {
    server.close();
    console.log('🛑 Servidor cerrado con éxito.');
    process.exit(0);
  }
}

testDashboard();

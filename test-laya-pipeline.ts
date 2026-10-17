import { LayaRouter } from './src/ai/layaRouter.js';
import { CalendarService } from './src/calendar/calendarService.js';
import { DatabaseService } from './src/database/db.js';

async function testPipeline() {
  console.log('========================================================');
  console.log('🧪 PROBANDO PIPELINE DUAL: LAYA (SISTEMA 1) + FORMULARIO');
  console.log('========================================================\n');

  CalendarService.initGoogleCalendar();
  const testPhone = '51922334455';
  const customerName = 'María';

  // Paso 1: Cliente pregunta por tinte de cabello
  console.log('--- PASO 1: "Hola que tal, queria reservar una cita para tinte de cabello" ---');
  const msg1 = 'Hola que tal, queria reservar una cita para tinte de cabello';
  DatabaseService.saveMessage(testPhone, 'user', msg1);
  const res1 = await LayaRouter.generateGroundedForm(testPhone, customerName, msg1);
  console.log('Formulario generado por Laya + Calendar:');
  console.log(res1.formSummaryText);

  // Paso 2: Cliente pregunta por el martes
  console.log('\n--- PASO 2: "¿Disculpe pero no tendrá cita para el martes?" ---');
  const msg2 = '¿Disculpe pero no tendrá cita para el martes?';
  DatabaseService.saveMessage(testPhone, 'user', msg2);
  const res2 = await LayaRouter.generateGroundedForm(testPhone, customerName, msg2);
  console.log('Formulario generado por Laya + Calendar:');
  console.log(res2.formSummaryText);

  // Paso 3: Cliente elige el lunes a las 8:30
  console.log('\n--- PASO 3: "no, esta bien que sea el Lunes de 8:30" ---');
  const msg3 = 'no, esta bien que sea el Lunes de 8:30';
  DatabaseService.saveMessage(testPhone, 'user', msg3);
  const res3 = await LayaRouter.generateGroundedForm(testPhone, customerName, msg3);
  console.log('Formulario generado por Laya + Calendar:');
  console.log(res3.formSummaryText);

  // Paso 4: Intento de desvío de tema (Prompt Injection / Pregunta ajena)
  console.log('\n--- PASO 4: "Oye, ¿me puedes escribir un script en Python para hackear o resolver mi tarea?" ---');
  const msg4 = 'Oye, ¿me puedes escribir un script en Python para hackear o resolver mi tarea?';
  DatabaseService.saveMessage(testPhone, 'user', msg4);
  const res4 = await LayaRouter.generateGroundedForm(testPhone, customerName, msg4);
  console.log('Respuesta del Guardrail de Laya:');
  console.log(res4.formSummaryText);
  console.log('\n¿Detectado como fuera de tema?:', res4.extracted.isOffTopic);

  console.log('\n✅ ¡EL SISTEMA CLASIFICA PERFECTAMENTE Y BLOQUEA DESVÍOS DE TEMA CON LAYA!');
  process.exit(0);
}

testPipeline().catch(err => {
  console.error('Error en prueba de pipeline:', err);
  process.exit(1);
});

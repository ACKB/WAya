import { Laya } from 'laya-system-one';
import { config, ServiceItem } from '../config.js';
import { CalendarService } from '../calendar/calendarService.js';
import { SlotCalculator } from '../calendar/slotCalculator.js';
import { DatabaseService } from '../database/db.js';

export interface LayaExtractedForm {
  intent: 'agendar' | 'consultar_disponibilidad' | 'consultar_precios' | 'cancelar' | 'saludo' | 'otro';
  service: ServiceItem | null;
  multipleServices: ServiceItem[];
  beneficiaryName: string | null;
  relationship: string | null;
  dayName: string | null;
  targetDateStr: string | null;
  timeStr: string | null;
  isOffTopic: boolean;
  confidence: number;
}

export class LayaRouter {
  private static layaInstance: any = null;
  private static isInitializing = false;

  static async init(): Promise<void> {
    if (this.layaInstance || this.isInitializing) return;
    this.isInitializing = true;
    try {
      console.log('🧠 Inicializando Laya Decision Engine (Sistema 1)...');
      this.layaInstance = await Laya.load();
      console.log('✅ Laya Decision Engine listo (latencia ~40ms, 0 alucinación).');
    } catch (err: any) {
      console.warn('⚠️ No se pudo inicializar Laya nativo, usando extractor estándar:', err?.message || err);
      this.layaInstance = null;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Extrae información sobre si la cita es para un tercero (hijo, esposo, etc.)
   */
  static extractBeneficiaryInfo(text: string): { name: string | null; relationship: string | null } {
    // 1. Patrones explícitos con parentesco y nombre: "para mi hijo Luis", "para mi esposo Carlos", "para mi hijito Mateo"
    const matchWithRel = text.match(/(?:para|a)\s+mi\s+(hijo|hijito|hija|hijita|esposo|marido|esposa|mamá|mama|madre|papá|papa|padre|hermano|hermana|sobrino|sobrina)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i);
    if (matchWithRel) {
      const rawRel = matchWithRel[1].toLowerCase();
      let rel = 'familiar';
      if (rawRel.includes('hij')) rel = 'hijo';
      else if (rawRel.includes('espos') || rawRel.includes('marid')) rel = 'esposo';
      else if (rawRel.includes('mam') || rawRel.includes('madr')) rel = 'mama';
      else if (rawRel.includes('pap') || rawRel.includes('padr')) rel = 'papa';
      return { name: matchWithRel[2].trim(), relationship: rel };
    }

    // 2. Patrones con parentesco sin nombre explícito: "para mi hijo", "para mi hijito", "para mi esposo"
    const matchRelOnly = text.match(/(?:para|a)\s+mi\s+(hijo|hijito|hija|hijita|esposo|marido|esposa|mamá|mama|madre|papá|papa|padre)/i);
    if (matchRelOnly) {
      const rawRel = matchRelOnly[1].toLowerCase();
      let rel = 'familiar';
      let defaultName = 'Familiar';
      if (rawRel.includes('hij')) { rel = 'hijo'; defaultName = rawRel.includes('a') ? 'su Hija' : 'su Hijo'; }
      else if (rawRel.includes('espos') || rawRel.includes('marid')) { rel = 'esposo'; defaultName = 'su Esposo'; }
      else if (rawRel.includes('mam') || rawRel.includes('madr')) { rel = 'mama'; defaultName = 'su Mamá'; }
      return { name: defaultName, relationship: rel };
    }

    // 3. Patrones directos: "para Luis", "es para Yolanda", "la cita es para Carlos"
    const matchDirect = text.match(/(?:para|es para|cita para)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]{3,20})/i);
    if (matchDirect) {
      const candidate = matchDirect[1].trim();
      const candidateLower = candidate.toLowerCase();
      const reserved = ['corte', 'tinte', 'manicure', 'unas', 'uñas', 'alisado', 'lavado', 'peinado', 'hoy', 'mañana', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo', 'las'];
      if (!reserved.includes(candidateLower)) {
        return { name: candidate, relationship: 'familiar' };
      }
    }

    return { name: null, relationship: null };
  }

  /**
   * Extrae si hay múltiples servicios solicitados en el mensaje (ej. "tinte y corte")
   */
  static extractMultipleServices(text: string): ServiceItem[] {
    const lower = text.toLowerCase();
    const allServices = config.servicesData.services;
    const found: ServiceItem[] = [];

    for (const s of allServices) {
      const sNameLower = s.name.toLowerCase();
      const keyMatch = (s.aliases || []).some((k: string) => lower.includes(k.toLowerCase()));
      if (lower.includes(sNameLower) || keyMatch) {
        if (!found.some(f => f.id === s.id)) {
          found.push(s);
        }
      }
    }

    return found;
  }

  /**
   * Calcula la fecha YYYY-MM-DD correspondiente a un día mencionado (ej. "lunes", "mañana", "hoy")
   */
  static resolveDateFromDay(dayKeyword: string | null): string {
    const now = new Date();
    if (!dayKeyword || dayKeyword === 'no_mencionado') {
      return now.toISOString().split('T')[0];
    }

    if (dayKeyword === 'hoy') {
      return now.toISOString().split('T')[0];
    }

    if (dayKeyword === 'manana') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    }

    const dayMap: Record<string, number> = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miercoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6
    };

    const targetDayIndex = dayMap[dayKeyword];
    if (targetDayIndex !== undefined) {
      const currentDayIndex = now.getDay();
      let diff = targetDayIndex - currentDayIndex;
      if (diff <= 0) {
        diff += 7; // El próximo día de la semana entrante
      }
      const d = new Date(now);
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }

    return now.toISOString().split('T')[0];
  }

  /**
   * Extrae la hora específica o la hora de inicio si el usuario la escribió (ej. "8:30", "a las 9", "de 10 a 11:30")
   */
  static extractSpecificTime(text: string): string | null {
    // 1. Detección de rangos: ej. "de 10 a 11:30", "de 10:00 a 12:00", "entre las 14 y 16" -> Extraer la hora de inicio
    const matchRange = text.match(/(?:de|desde|entre)?\s*(\d{1,2})(?::(\d{2}))?\s*(?:a|hasta|y|-)\s*(\d{1,2})(?::(\d{2}))?/i);
    if (matchRange && matchRange[1] && matchRange[3]) {
      let h = parseInt(matchRange[1], 10);
      const m = matchRange[2] || '00';
      if ((text.toLowerCase().includes('pm') || text.toLowerCase().includes('tarde')) && h < 12) {
        h += 12;
      }
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    // 2. Hora exacta con minutos: "8:30", "08:30", "14:00", "a las 8:30"
    const matchTime = text.match(/(?:a\s+las?|para\s+las?|de)?\s*(\d{1,2}):(\d{2})/i);
    if (matchTime) {
      let h = parseInt(matchTime[1], 10);
      const m = matchTime[2];
      if ((text.toLowerCase().includes('pm') || text.toLowerCase().includes('tarde')) && h < 12) {
        h += 12;
      }
      return `${String(h).padStart(2, '0')}:${m}`;
    }

    // 3. Hora simple sin minutos: "a las 8", "para las 8", "a las 10", "tipo 4 de la tarde"
    const matchHour = text.match(/(?:a\s+las?|para\s+las?|a\s+la|a|tipo)\s*(\d{1,2})(?:\s*(am|pm|de la mañana|de la tarde))?/i);
    if (matchHour) {
      let h = parseInt(matchHour[1], 10);
      const modifier = (matchHour[2] || '').toLowerCase();
      if ((modifier.includes('pm') || modifier.includes('tarde') || text.toLowerCase().includes('tarde')) && h < 12) {
        h += 12;
      }
      return `${String(h).padStart(2, '0')}:00`;
    }

    return null;
  }

  /**
   * Evalúa el texto del usuario con Laya y extrae el formulario estructurado en milisegundos.
   */
  static async evaluate(text: string): Promise<LayaExtractedForm> {
    if (!this.layaInstance) {
      await this.init();
    }

    const specificTime = this.extractSpecificTime(text);
    const beneficiary = this.extractBeneficiaryInfo(text);
    const multiServices = this.extractMultipleServices(text);

    // Si Laya está activo, ejecutar las preguntas tipadas calibradas
    if (this.layaInstance) {
      try {
        const result = await this.layaInstance.predict(text, {
          tema: {
            type: 'choice',
            instructions: '¿El cliente está hablando de servicios del salón o de un tema externo?',
            criteria: {
              salon_citas: 'agendar cita, elegir o confirmar horarios (lunes, martes, etc., a las 8:30, etc.), decir que le parece bien una hora o fecha, tintes, cortes, estética, colores, precios o saludos',
              tema_externo: 'pedir chistes, bromas, código de programación, matemáticas, tareas, ciencia, recetas de comida o temas ajenos al salón'
            }
          },
          intent: {
            type: 'choice',
            instructions: '¿Cuál es la intención principal del usuario en este mensaje?',
            criteria: {
              agendar: 'quiere reservar, apartar, elegir hora o confirmar una cita para un tratamiento o para un familiar',
              consultar_disponibilidad: 'pregunta qué días u horarios tienen libres o si hay lugar',
              consultar_precios: 'pregunta cuánto cuesta un servicio o qué servicios ofrecen',
              cancelar: 'palabras explícitas de cancelación como cancelar cita, anular reserva, no podré ir, dar de baja',
              saludo: 'únicamente saluda, agradece o se despide sin pedir cita',
              otro: 'cualquier otro tema'
            }
          },
          servicio: {
            type: 'choice',
            instructions: '¿Qué servicio o tratamiento menciona el usuario?',
            criteria: {
              tinte: 'tinte de cabello, teñir, color, mechas, balayage',
              corte_dama: 'corte de dama, mujer o peinado femenino',
              corte_caballero: 'corte de hombre, varón o barbería',
              manicure: 'manicure, uñas, esmaltado',
              alisado: 'alisado, keratina, botox capilar',
              ninguno: 'no menciona ningún tratamiento específico'
            }
          },
          dia: {
            type: 'choice',
            instructions: '¿Qué día de la semana menciona el usuario?',
            criteria: {
              lunes: 'lunes',
              martes: 'martes',
              miercoles: 'miércoles',
              jueves: 'jueves',
              viernes: 'viernes',
              sabado: 'sábado',
              hoy: 'hoy o para hoy mismo',
              manana: 'mañana',
              proxima_semana: 'la próxima semana o la otra semana',
              no_mencionado: 'no menciona un día específico'
            }
          }
        });

        const answers = result.answers || {};
        let isOffTopic = answers.tema?.choice === 'tema_externo';
        let intentChoice = answers.intent?.choice || 'otro';
        const serviceChoice = answers.servicio?.choice;
        const dayChoice = answers.dia?.choice;

        const resolvedService = multiServices.length > 0
          ? multiServices[0]
          : (serviceChoice && serviceChoice !== 'ninguno' ? CalendarService.findService(serviceChoice) : null);

        // Salvaguarda: si menciona una hora explícita, un día válido o un servicio, nunca es fuera de tema
        if (specificTime || resolvedService || (dayChoice && dayChoice !== 'no_mencionado')) {
          isOffTopic = false;
        }

        // Si el usuario propone o confirma hora, fecha o servicio, NUNCA es cancelar a menos que diga cancelar explícitamente
        const textLower = text.toLowerCase();
        if (specificTime || textLower.includes('para el') || textLower.includes('que sea') || textLower.includes('dale') || textLower.includes('perfecto') || textLower.includes('me quedo con')) {
          if (!textLower.includes('cancel') && !textLower.includes('anul') && !textLower.includes('no voy')) {
            intentChoice = 'agendar';
          }
        }

        const daysKeywords = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo', 'hoy', 'manana', 'mañana'];
        const explicitlyMentionedDay = daysKeywords.find(d => textLower.includes(d));
        const finalDayName = explicitlyMentionedDay ? (dayChoice !== 'no_mencionado' ? dayChoice : null) : null;
        const targetDate = this.resolveDateFromDay(finalDayName);

        return {
          intent: intentChoice,
          service: resolvedService,
          multipleServices: multiServices,
          beneficiaryName: beneficiary.name,
          relationship: beneficiary.relationship,
          dayName: finalDayName,
          targetDateStr: targetDate,
          timeStr: specificTime,
          isOffTopic,
          confidence: answers.intent?.confidence || 0.9,
        };
      } catch (err: any) {
        console.error('Error durante la inferencia de Laya:', err?.message || err);
      }
    }

    // Fallback heurístico
    const foundService = multiServices.length > 0 ? multiServices[0] : CalendarService.findService(text);
    return {
      intent: text.toLowerCase().includes('cita') || text.toLowerCase().includes('reserv') ? 'agendar' : 'otro',
      service: foundService,
      multipleServices: multiServices,
      beneficiaryName: beneficiary.name,
      relationship: beneficiary.relationship,
      dayName: null,
      targetDateStr: this.resolveDateFromDay(null),
      timeStr: specificTime,
      isOffTopic: false,
      confidence: 0.8
    };
  }

  /**
   * Genera el Formulario Relleno Fáctico que se enviará al Modelo Generativo
   */
  static async generateGroundedForm(
    phone: string,
    customerName: string | null,
    text: string
  ): Promise<{
    formJson: any;
    formSummaryText: string;
    extracted: LayaExtractedForm;
  }> {
    const extracted = await this.evaluate(text);

    // Guardrail: Si el usuario se sale del tema, abortar consulta y forzar redirección
    if (extracted.isOffTopic) {
      const offTopicText = `
⚠️ ALERTA DE GUARDRAIL (DESVÍO DE TEMA DETECTADO POR LAYA):
- ESTADO: El cliente ha hecho una pregunta o comentario ajeno a la peluquería o salón de belleza.
- INSTRUCCIÓN OBLIGATORIA PARA TU RESPUESTA:
  1. Dile amablemente: "Hay que evitar movernos de tema" o "Para no salirnos del tema".
  2. Redirige inmediatamente la conversación preguntándole: "¿Para cuándo quisiera su cita o qué tipo de tratamiento desea?".
  3. NUNCA resuelvas la petición externa (no escribas código, no hagas cálculos matemáticos, no cuentes chistes ni hables de cosas ajenas al salón).
`.trim();

      const formJson = {
        cliente: customerName || 'Aún no proporcionado',
        telefono: phone,
        fuera_de_tema: true,
        instruccion: 'Redirigir a citas diciendo: "Hay que evitar movernos de tema. ¿Para cuándo quisiera su cita o qué tipo de tratamiento desea?"'
      };

      return { formJson, formSummaryText: offTopicText, extracted };
    }

    // 1. Obtener borrador acumulado de la sesión en SQLite
    let draft = DatabaseService.getDraft(phone);

    // Actualizar nombre del titular si ya se conoce
    if (customerName && !draft.customer_name) {
      draft = DatabaseService.updateDraft(phone, { customer_name: customerName });
      DatabaseService.upsertUserName(phone, customerName);
    }

    // Actualizar beneficiario si se detectó un sub-usuario (hijo, esposo, etc.)
    if (extracted.beneficiaryName) {
      draft = DatabaseService.updateDraft(phone, {
        beneficiary_name: extracted.beneficiaryName,
        relationship: extracted.relationship || 'familiar'
      });
      DatabaseService.addOrUpdateBeneficiary(phone, extracted.beneficiaryName, extracted.relationship || 'familiar');
    }

    // Actualizar servicios múltiples o individuales
    if (extracted.multipleServices.length > 1) {
      const totalDur = SlotCalculator.sumDurations(extracted.multipleServices.map(s => s.durationMinutes));
      const combinedNames = extracted.multipleServices.map(s => s.name).join(' + ');
      draft = DatabaseService.updateDraft(phone, {
        service_id: extracted.multipleServices[0].id,
        service_name: combinedNames,
        duration_minutes: totalDur,
        total_duration_minutes: totalDur,
        services_json: JSON.stringify(extracted.multipleServices)
      });
    } else if (extracted.service) {
      draft = DatabaseService.updateDraft(phone, {
        service_id: extracted.service.id,
        service_name: extracted.service.name,
        duration_minutes: extracted.service.durationMinutes,
        total_duration_minutes: extracted.service.durationMinutes
      });
    }

    // Actualizar fecha si se detectó un día
    if (extracted.targetDateStr && extracted.dayName) {
      draft = DatabaseService.updateDraft(phone, { date_str: extracted.targetDateStr });
    }

    // Si aún no tenemos fecha en el borrador pero se mencionó en mensajes previos
    if (!draft.date_str) {
      const recent = DatabaseService.getRecentMessages(phone, 6);
      const days = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado', 'domingo', 'hoy', 'mañana'];
      for (let i = recent.length - 1; i >= 0; i--) {
        const msgLower = recent[i].content.toLowerCase();
        const foundDay = days.find(d => msgLower.includes(d));
        if (foundDay) {
          const normDay = foundDay.replace('miércoles', 'miercoles').replace('sábado', 'sabado');
          const resolved = this.resolveDateFromDay(normDay);
          draft = DatabaseService.updateDraft(phone, { date_str: resolved });
          break;
        }
      }
    }

    // Corregir intención si el mensaje contiene confirmación o selección de hora
    const lowerConfirm = text.toLowerCase();
    if (extracted.timeStr || lowerConfirm.includes('que sea') || lowerConfirm.includes('esta bien') || lowerConfirm.includes('perfecto') || lowerConfirm.includes('dale') || lowerConfirm.includes('me quedo')) {
      if (!lowerConfirm.includes('cancel') && !lowerConfirm.includes('anul')) {
        extracted.intent = 'agendar';
      }
    }

    let availabilitySummary = 'No consultada';
    let isTargetSlotAvailable: boolean | null = null;
    let alternativeSlots = '';

    const effectiveServiceName = draft.service_name || (extracted.service ? extracted.service.name : null);
    const effectiveDateStr = draft.date_str || extracted.targetDateStr;
    const duration = draft.total_duration_minutes || draft.duration_minutes || (extracted.service ? extracted.service.durationMinutes : 30);

    if (effectiveServiceName) {
      const avail = await CalendarService.checkAvailability(effectiveServiceName, effectiveDateStr || undefined);
      availabilitySummary = avail.summaryText;

      // Si el cliente especificó una hora (ej. "10:00" o "de 10 a 11:30")
      if (extracted.timeStr && effectiveDateStr) {
        const busy = await CalendarService.getBusyIntervalsForDate(effectiveDateStr);
        const freeSlots = SlotCalculator.calculateFreeSlots(effectiveDateStr, duration, busy);
        isTargetSlotAvailable = freeSlots.slots.some(s => s.start === extracted.timeStr);
        if (isTargetSlotAvailable) {
          const startMin = SlotCalculator.timeToMinutes(extracted.timeStr);
          const end24 = SlotCalculator.minutesToTime(startMin + duration);
          draft = DatabaseService.updateDraft(phone, {
            start_time: extracted.timeStr,
            end_time: end24
          });
        } else {
          alternativeSlots = SlotCalculator.formatFriendlyRanges(freeSlots.slots);
        }
      }
    }

    // Evaluar qué falta coordinar
    const missingFields: string[] = [];
    if (!draft.service_name) missingFields.push('servicio (qué tratamiento desea)');
    if (!draft.date_str) missingFields.push('día (para qué fecha desea su cita)');
    if (!draft.start_time) missingFields.push('hora (a qué hora prefiere asistir)');
    if (!draft.customer_name) missingFields.push('nombre (su nombre para registrar la cita)');

    const isComplete = missingFields.length === 0 && Boolean(draft.start_time) && Boolean(draft.date_str);

    let respuestaFija: string | null = null;
    if (isComplete && draft.date_str && draft.start_time && draft.end_time) {
      const dateInfo = SlotCalculator.formatDateEs(draft.date_str);
      const horaInicio12 = SlotCalculator.to12Hour(draft.start_time);
      const horaFin12 = SlotCalculator.to12Hour(draft.end_time);

      // Estructura fija con soporte de beneficiario y citas combinadas:
      if (draft.beneficiary_name && draft.beneficiary_name.toLowerCase() !== (draft.customer_name || '').toLowerCase()) {
        if (draft.service_name?.includes('+')) {
          respuestaFija = `Entonces señor o señora ${draft.customer_name}, quedamos para el día ${dateInfo.dayNumber} de ${dateInfo.monthName} de ${horaInicio12} a ${horaFin12} para atenderla a usted y a su ${draft.relationship || 'acompañante'} ${draft.beneficiary_name} para ${draft.service_name}. ¡Les esperamos con mucho gusto!`;
        } else {
          respuestaFija = `Entonces señor o señora ${draft.customer_name}, quedamos para el día ${dateInfo.dayNumber} de ${dateInfo.monthName} de ${horaInicio12} a ${horaFin12} para el servicio de ${draft.service_name} de su ${draft.relationship || 'familiar'} ${draft.beneficiary_name}. ¡Le esperamos con mucho gusto!`;
        }
      } else {
        respuestaFija = `Entonces señor o señora ${draft.customer_name}, quedamos para el día ${dateInfo.dayNumber} de ${dateInfo.monthName} de ${horaInicio12} a ${horaFin12} para ${draft.service_name}. ¡Le esperamos con mucho gusto!`;
      }
    }

    const dateInfo = draft.date_str ? SlotCalculator.formatDateEs(draft.date_str) : null;
    const formJson = {
      cliente_titular: draft.customer_name,
      beneficiario: draft.beneficiary_name,
      parentesco: draft.relationship,
      servicio: draft.service_name,
      duracion_minutos: duration,
      duracion_legible: SlotCalculator.formatDuration(duration),
      fecha: draft.date_str,
      dia_nombre: dateInfo ? dateInfo.dayName : null,
      dia_numero: dateInfo ? dateInfo.dayNumber : null,
      mes_nombre: dateInfo ? dateInfo.monthName : null,
      hora_inicio_24: draft.start_time,
      hora_fin_24: draft.end_time,
      hora_inicio_12: draft.start_time ? SlotCalculator.to12Hour(draft.start_time) : null,
      hora_fin_12: draft.end_time ? SlotCalculator.to12Hour(draft.end_time) : null,
      disponibilidad_real: availabilitySummary,
      hora_elegida_disponible: isTargetSlotAvailable,
      horarios_alternativos: alternativeSlots || 'Ninguno',
      faltantes: missingFields,
      completo: isComplete,
      respuesta_fija_confirmacion: respuestaFija
    };

    const formSummaryText = `
📋 FORMULARIO FACTUAL DE CITAS (Validado por Laya Decision Engine + Calendar):
- Cliente Titular (X): ${formJson.cliente_titular || 'Falta coordinar (aún no proporcionado)'}
${formJson.beneficiario ? `- Beneficiario / Paciente: ${formJson.beneficiario} (${formJson.parentesco || 'familiar'})` : ''}
- Tratamiento (M): ${formJson.servicio ? `${formJson.servicio} (${formJson.duracion_legible})` : 'Falta coordinar'}
- Día y Mes (Y de Z): ${formJson.dia_numero && formJson.mes_nombre ? `${formJson.dia_numero} de ${formJson.mes_nombre} (${formJson.dia_nombre})` : 'Falta coordinar día'}
- Horario en formato 12 horas am/pm (A a B): ${formJson.hora_inicio_12 && formJson.hora_fin_12 ? `${formJson.hora_inicio_12} a ${formJson.hora_fin_12}` : 'Falta coordinar hora'}
- Estado: ${isComplete ? '🎉 100% COMPLETO Y LISTO PARA CONFIRMAR' : `Falta coordinar: ${missingFields.join(', ')}`}
- Disponibilidad en calendario:
${availabilitySummary}
${alternativeSlots ? `- Horarios alternativos recomendados en formato am/pm: ${alternativeSlots}` : ''}
`.trim();

    return { formJson, formSummaryText, extracted };
  }
}

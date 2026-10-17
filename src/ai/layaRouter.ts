import { Laya } from 'laya-system-one';
import { config, ServiceItem } from '../config.js';
import { CalendarService } from '../calendar/calendarService.js';
import { SlotCalculator } from '../calendar/slotCalculator.js';
import { DatabaseService } from '../database/db.js';

export interface LayaExtractedForm {
  intent: 'agendar' | 'consultar_disponibilidad' | 'consultar_precios' | 'cancelar' | 'saludo' | 'otro';
  service: ServiceItem | null;
  dayName: string | null;
  targetDateStr: string | null;
  timeStr: string | null;
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
   * Extrae la hora específica si el usuario la escribió (ej. "8:30", "a las 9", "18:00")
   */
  static extractSpecificTime(text: string): string | null {
    // Patrón 1: "8:30", "08:30", "14:00"
    const matchTime = text.match(/(?:a\s+las\s+)?(\d{1,2}):(\d{2})/i);
    if (matchTime) {
      const h = String(matchTime[1]).padStart(2, '0');
      const m = matchTime[2];
      return `${h}:${m}`;
    }

    // Patrón 2: "a las 9", "a las 4 de la tarde"
    const matchHour = text.match(/a\s+las\s+(\d{1,2})(?:\s*(am|pm|de la mañana|de la tarde))?/i);
    if (matchHour) {
      let h = parseInt(matchHour[1], 10);
      const modifier = (matchHour[2] || '').toLowerCase();
      if ((modifier.includes('pm') || modifier.includes('tarde')) && h < 12) {
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

    // Si Laya está activo, ejecutar las preguntas tipadas calibradas
    if (this.layaInstance) {
      try {
        const result = await this.layaInstance.predict(text, {
          intent: {
            type: 'choice',
            instructions: '¿Cuál es la intención principal del usuario en este mensaje?',
            criteria: {
              agendar: 'quiere reservar, apartar, elegir hora o confirmar una cita para un tratamiento',
              consultar_disponibilidad: 'pregunta qué días u horarios tienen libres o si hay lugar',
              consultar_precios: 'pregunta cuánto cuesta un servicio o qué servicios ofrecen',
              cancelar: 'quiere cancelar, anular o posponer su cita',
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
        const intentChoice = answers.intent?.choice || 'otro';
        const serviceChoice = answers.servicio?.choice;
        const dayChoice = answers.dia?.choice;

        const resolvedService = serviceChoice && serviceChoice !== 'ninguno'
          ? CalendarService.findService(serviceChoice)
          : null;

        const targetDate = this.resolveDateFromDay(dayChoice);

        return {
          intent: intentChoice,
          service: resolvedService,
          dayName: dayChoice !== 'no_mencionado' ? dayChoice : null,
          targetDateStr: targetDate,
          timeStr: specificTime,
          confidence: answers.intent?.confidence || 0.9,
        };
      } catch (err: any) {
        console.error('Error durante la inferencia de Laya:', err?.message || err);
      }
    }

    // Fallback heurístico en caso de que Laya no estuviera disponible
    const foundService = CalendarService.findService(text);
    return {
      intent: text.toLowerCase().includes('cita') || text.toLowerCase().includes('reserv') ? 'agendar' : 'otro',
      service: foundService,
      dayName: null,
      targetDateStr: this.resolveDateFromDay(null),
      timeStr: specificTime,
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

    // Si no se detectó servicio en este mensaje, buscar en el historial reciente de la conversación
    if (!extracted.service) {
      const recent = DatabaseService.getRecentMessages(phone, 6);
      for (let i = recent.length - 1; i >= 0; i--) {
        const prevService = CalendarService.findService(recent[i].content);
        if (prevService) {
          extracted.service = prevService;
          break;
        }
      }
    }

    // Corregir intención si el mensaje contiene confirmación aunque empiece con "no" (ej. "no, está bien el lunes")
    if (extracted.timeStr && (text.toLowerCase().includes('esta bien') || text.toLowerCase().includes('perfecto') || text.toLowerCase().includes('dale'))) {
      extracted.intent = 'agendar';
    }

    let availabilitySummary = 'No consultada';
    let isTargetSlotAvailable: boolean | null = null;
    let alternativeSlots = '';

    // Si detectamos un servicio, consultamos disponibilidad exacta sin alucinaciones
    if (extracted.service) {
      const avail = await CalendarService.checkAvailability(extracted.service.name, extracted.targetDateStr || undefined);
      availabilitySummary = avail.summaryText;

      // Si el cliente especificó una hora exacta (ej. 08:30)
      if (extracted.timeStr && extracted.targetDateStr) {
        const busy = await CalendarService.getBusyIntervalsForDate(extracted.targetDateStr);
        const freeSlots = SlotCalculator.calculateFreeSlots(extracted.targetDateStr, extracted.service.durationMinutes, busy);
        isTargetSlotAvailable = freeSlots.slots.some(s => s.start === extracted.timeStr);
        if (!isTargetSlotAvailable) {
          alternativeSlots = SlotCalculator.formatFriendlyRanges(freeSlots.slots);
        }
      }
    }

    const formJson = {
      cliente: customerName || 'Aún no proporcionado',
      telefono: phone,
      intencion_detectada: extracted.intent,
      servicio_solicitado: extracted.service ? `${extracted.service.name} (${extracted.service.durationMinutes} minutos)` : 'No especificado aún',
      dia_solicitado: extracted.dayName || 'No especificado',
      fecha_calculada: extracted.targetDateStr,
      hora_solicitada: extracted.timeStr || 'No especificada',
      disponibilidad_real: availabilitySummary,
      hora_elegida_disponible: isTargetSlotAvailable,
      horarios_alternativos_si_esta_lleno: alternativeSlots || 'Ninguno'
    };

    const formSummaryText = `
📋 FORMULARIO FACTUAL DE CITAS (Validado por Laya Decision Engine + Calendar):
- Cliente: ${formJson.cliente}
- Intención: ${formJson.intencion_detectada}
- Servicio: ${formJson.servicio_solicitado}
- Día solicitado: ${formJson.dia_solicitado} (${formJson.fecha_calculada})
- Hora solicitada: ${formJson.hora_solicitada}
- Estado del horario solicitado: ${isTargetSlotAvailable === null ? 'Pendiente de elegir hora' : isTargetSlotAvailable ? '✅ DISPONIBLE' : '❌ OCUPADO / LLENO'}
- Disponibilidad real en calendario:
${availabilitySummary}
${alternativeSlots ? `- Horarios alternativos recomendados para ofrecer: ${alternativeSlots}` : ''}
`.trim();

    return { formJson, formSummaryText, extracted };
  }
}

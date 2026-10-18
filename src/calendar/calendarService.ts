import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { config, ServiceItem } from '../config.js';
import { DatabaseService } from '../database/db.js';
import { SlotCalculator } from './slotCalculator.js';
import { DayAvailability, BookingResult } from './types.js';

export class CalendarService {
  private static googleCalendar: any = null;
  private static isGoogleAuthReady = false;

  static initGoogleCalendar() {
    const keyPath = path.resolve(process.cwd(), config.calendar.serviceAccountKeyPath);
    if (fs.existsSync(keyPath)) {
      try {
        const auth = new google.auth.GoogleAuth({
          keyFile: keyPath,
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
        this.googleCalendar = google.calendar({ version: 'v3', auth });
        this.isGoogleAuthReady = true;
        console.log('✅ Google Calendar API conectado mediante Service Account.');
      } catch (err: any) {
        console.warn('⚠️ Error al autenticar con Google Calendar:', err?.message || err);
        this.isGoogleAuthReady = false;
      }
    } else {
      console.log('ℹ️ Modo Local Mock: credentials.json no encontrado. Operando con base de datos SQLite local.');
      this.isGoogleAuthReady = false;
    }
  }

  // Buscar un servicio por id, nombre o alias
  static findService(query: string): ServiceItem | null {
    const q = query.toLowerCase().trim();
    for (const s of config.servicesData.services) {
      if (s.id.toLowerCase() === q || s.name.toLowerCase().includes(q)) {
        return s;
      }
      for (const alias of s.aliases) {
        if (q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) {
          return s;
        }
      }
    }
    return null;
  }

  /**
   * Obtiene los intervalos ocupados para una fecha específica (YYYY-MM-DD).
   */
  static async getBusyIntervalsForDate(dateStr: string): Promise<{ start: string; end: string }[]> {
    const busy: { start: string; end: string }[] = [];

    // 1. Citas locales en SQLite
    const localAppts = DatabaseService.getAppointmentsForDate(dateStr);
    for (const a of localAppts) {
      const startTime = a.start_time.split('T')[1]?.substring(0, 5) || '00:00';
      const endTime = a.end_time.split('T')[1]?.substring(0, 5) || '00:00';
      busy.push({ start: startTime, end: endTime });
    }

    // 2. Si Google Calendar está activo, consultar eventos de la nube
    if (this.isGoogleAuthReady && this.googleCalendar) {
      try {
        const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
        const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();

        const res = await this.googleCalendar.events.list({
          calendarId: config.calendar.calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const items = res.data.items || [];
        for (const item of items) {
          const startDateTime = item.start?.dateTime;
          const endDateTime = item.end?.dateTime;
          if (startDateTime && endDateTime) {
            const startH = new Date(startDateTime).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: config.timezone
            });
            const endH = new Date(endDateTime).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: config.timezone
            });
            busy.push({ start: startH, end: endH });
          }
        }
      } catch (err: any) {
        console.error('Error al consultar Google Calendar:', err?.message || err);
      }
    }

    return busy;
  }

  /**
   * Consulta la disponibilidad para un servicio en una fecha dada o los próximos N días.
   */
  static async checkAvailability(
    serviceQuery: string,
    targetDateStr?: string,
    daysAhead = 7
  ): Promise<{ service: ServiceItem; days: DayAvailability[]; summaryText: string }> {
    const service = this.findService(serviceQuery) || config.servicesData.services[0];
    const results: DayAvailability[] = [];

    const baseDate = targetDateStr ? new Date(targetDateStr + 'T12:00:00') : new Date();

    for (let i = 0; i < (targetDateStr ? 1 : daysAhead); i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];

      const busy = await this.getBusyIntervalsForDate(dateStr);
      const dayAvail = SlotCalculator.calculateFreeSlots(dateStr, service.durationMinutes, busy);
      results.push(dayAvail);
    }

    // Generar resumen amigable para adultos mayores
    const availableDays = results.filter(r => !r.isFull && r.slots.length > 0);
    let summaryText = '';

    if (availableDays.length === 0) {
      summaryText = `No tenemos citas disponibles para ${service.name} en esas fechas.`;
    } else {
      const lines = availableDays.slice(0, 3).map(d => {
        const friendlyRange = SlotCalculator.formatFriendlyRanges(d.slots);
        const dateInfo = SlotCalculator.formatDateEs(d.date);
        return `${dateInfo.fullDateEs}: ${friendlyRange}`;
      });
      summaryText = `Para ${service.name} (${service.durationMinutes} min), tenemos disponible:\n` + lines.join('\n');
    }

    return { service, days: results, summaryText };
  }

  /**
   * Registra una cita tanto en Google Calendar como en la base de datos local SQLite.
   */
  static async bookAppointment(params: {
    phone: string;
    customerName: string;
    beneficiaryName?: string;
    relationship?: string;
    serviceQuery: string;
    durationMinutes?: number;
    price?: number;
    dateStr: string; // YYYY-MM-DD
    timeStr: string; // HH:mm
  }): Promise<BookingResult> {
    const service = this.findService(params.serviceQuery);
    const serviceName = service ? service.name : params.serviceQuery;
    const duration = params.durationMinutes || (service ? service.durationMinutes : 30);
    const price = params.price || (service ? service.price : 0);

    const startMinutes = SlotCalculator.timeToMinutes(params.timeStr);
    const endMinutes = startMinutes + duration;
    const endTimeStr = SlotCalculator.minutesToTime(endMinutes);

    const startIso = `${params.dateStr}T${params.timeStr}:00`;
    const endIso = `${params.dateStr}T${endTimeStr}:00`;

    // Validar conflicto de horario
    const busy = await this.getBusyIntervalsForDate(params.dateStr);
    const busyMinutes = busy.map(b => ({
      start: SlotCalculator.timeToMinutes(b.start),
      end: SlotCalculator.timeToMinutes(b.end)
    }));

    const hasConflict = busyMinutes.some(b => startMinutes < b.end && endMinutes > b.start);
    if (hasConflict) {
      return {
        success: false,
        message: `El horario de las ${params.timeStr} para el día ${params.dateStr} ya se encuentra ocupado. ¿Te gustaría ver otros horarios?`
      };
    }

    let googleEventId: string | undefined = undefined;

    // Crear en Google Calendar si está disponible
    if (this.isGoogleAuthReady && this.googleCalendar) {
      try {
        const startDateTime = new Date(`${startIso}`).toISOString();
        const endDateTime = new Date(`${endIso}`).toISOString();

        const summaryText = params.beneficiaryName && params.beneficiaryName !== params.customerName
          ? `Cita: ${serviceName} - ${params.beneficiaryName} (Titular: ${params.customerName})`
          : `Cita: ${serviceName} - ${params.customerName}`;

        const event = await this.googleCalendar.events.insert({
          calendarId: config.calendar.calendarId,
          requestBody: {
            summary: summaryText,
            description: `Titular: ${params.customerName}\nBeneficiario: ${params.beneficiaryName || params.customerName}\nTeléfono: ${params.phone}\nServicio: ${serviceName} (${duration} min)\nPrecio: S/. ${price}`,
            start: { dateTime: startDateTime, timeZone: config.timezone },
            end: { dateTime: endDateTime, timeZone: config.timezone },
          },
        });
        googleEventId = event.data.id || undefined;
      } catch (err: any) {
        console.warn('⚠️ No se pudo sincronizar evento con Google Calendar:', err?.message || err);
      }
    }

    // Guardar en SQLite local
    const apptId = DatabaseService.createAppointment({
      phone: params.phone,
      customer_name: params.customerName,
      beneficiary_name: params.beneficiaryName || params.customerName,
      relationship: params.relationship || 'titular',
      service_name: serviceName,
      duration_minutes: duration,
      price: price,
      start_time: startIso,
      end_time: endIso,
      google_event_id: googleEventId,
    });

    return {
      success: true,
      appointmentId: apptId,
      googleEventId,
      message: `¡Listo! Su cita para ${serviceName} ha quedado agendada para el ${params.dateStr} a las ${params.timeStr} hrs.`,
      details: {
        customerName: params.customerName,
        serviceName: serviceName,
        date: params.dateStr,
        startTime: params.timeStr,
        endTime: endTimeStr,
      }
    };
  }
}

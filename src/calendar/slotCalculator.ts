import { config, WorkingHourInterval } from '../config.js';
import { TimeSlot, DayAvailability } from './types.js';

export class SlotCalculator {
  // Convertir "HH:mm" a minutos desde medianoche
  static timeToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  }

  // Convertir minutos a "HH:mm"
  static minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Convertir "HH:mm" (24h) a formato de 12 horas am/pm usado en Perú (ej. "10:00 am", "02:30 pm")
  static to12Hour(time24: string): string {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const period = h >= 12 ? 'pm' : 'am';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${String(h).padStart(2, '0')}:${m} ${period}`;
  }

  // Obtener el día de la semana en español
  static getDayOfWeekKey(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  static getDayOfWeekNameEs(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[date.getDay()];
  }

  static formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0 && m > 0) {
      return `${h} hora${h > 1 ? 's' : ''} y ${m} minutos`;
    }
    if (h > 0) {
      return `${h} hora${h > 1 ? 's' : ''}`;
    }
    return `${m} minutos`;
  }

  static sumDurations(durations: number[]): number {
    return durations.reduce((acc, curr) => acc + curr, 0);
  }

  static formatDateEs(dateStr: string): { dayName: string; dayNumber: number; monthName: string; fullDateEs: string } {
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const [year, month, day] = dateStr.split('-').map(Number);
    const dayName = this.getDayOfWeekNameEs(dateStr);
    const monthName = months[month - 1] || 'Mes';
    return {
      dayName,
      dayNumber: day,
      monthName,
      fullDateEs: `${dayName} ${day} de ${monthName}`
    };
  }

  /**
   * Calcula los intervalos continuos libres para una fecha dada considerando:
   * 1. Horario de atención del negocio
   * 2. Citas ya reservadas
   * 3. Duración del tratamiento solicitado
   */
  static calculateFreeSlots(
    dateStr: string,
    durationMinutes: number,
    busyIntervals: { start: string; end: string }[]
  ): DayAvailability {
    const dayKey = this.getDayOfWeekKey(dateStr);
    const dayName = this.getDayOfWeekNameEs(dateStr);
    const businessHours: WorkingHourInterval[] = config.servicesData.business.workingHours[dayKey] || [];

    if (businessHours.length === 0) {
      return {
        date: dateStr,
        dayOfWeek: dayName,
        isFull: true,
        slots: [],
        suggestedAlternative: 'El negocio no atiende los ' + dayName.toLowerCase() + 's.'
      };
    }

    // Convertir ocupados a minutos
    const busyInMinutes = busyIntervals.map(b => ({
      start: this.timeToMinutes(b.start),
      end: this.timeToMinutes(b.end)
    }));

    const validSlots: TimeSlot[] = [];

    // Por cada turno de atención (ej. mañana 08:00-13:00, tarde 14:00-20:00)
    for (const shift of businessHours) {
      const shiftStart = this.timeToMinutes(shift.start);
      const shiftEnd = this.timeToMinutes(shift.end);

      // Evaluar en pasos de 30 minutos
      for (let slotStart = shiftStart; slotStart + durationMinutes <= shiftEnd; slotStart += 30) {
        const slotEnd = slotStart + durationMinutes;

        // Verificar si se solapa con alguna cita ocupada
        const hasConflict = busyInMinutes.some(busy => {
          return slotStart < busy.end && slotEnd > busy.start;
        });

        if (!hasConflict) {
          validSlots.push({
            start: this.minutesToTime(slotStart),
            end: this.minutesToTime(slotEnd)
          });
        }
      }
    }

    const isFull = validSlots.length === 0;

    return {
      date: dateStr,
      dayOfWeek: dayName,
      isFull,
      slots: validSlots
    };
  }

  /**
   * Agrupa los slots continuos en rangos amigables para adultos mayores:
   * Ej: ["08:00", "08:30", "09:00", "09:30"] -> "de 08:00 a 11:30"
   */
  static formatFriendlyRanges(slots: TimeSlot[]): string {
    if (slots.length === 0) return 'Sin disponibilidad';

    // Agrupar ventanas de inicio disponibles
    const startMinutes = slots.map(s => this.timeToMinutes(s.start)).sort((a, b) => a - b);
    const uniqueStarts = Array.from(new Set(startMinutes));

    const ranges: string[] = [];
    let currentStart = uniqueStarts[0];
    let prev = uniqueStarts[0];

    for (let i = 1; i < uniqueStarts.length; i++) {
      const current = uniqueStarts[i];
      if (current - prev > 30) {
        // Hubo salto, cerramos rango previo
        const start12 = this.to12Hour(this.minutesToTime(currentStart));
        const end12 = this.to12Hour(this.minutesToTime(prev + 30));
        ranges.push(`de ${start12} a ${end12}`);
        currentStart = current;
      }
      prev = current;
    }
    // Último rango
    if (uniqueStarts.length > 0) {
      const start12 = this.to12Hour(this.minutesToTime(currentStart));
      const end12 = this.to12Hour(this.minutesToTime(prev + 30));
      ranges.push(`de ${start12} a ${end12}`);
    }

    return ranges.join(' y ');
  }
}

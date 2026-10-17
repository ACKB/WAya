export interface TimeSlot {
  start: string; // HH:mm (ej. "08:00")
  end: string;   // HH:mm (ej. "10:00")
}

export interface DayAvailability {
  date: string;       // YYYY-MM-DD
  dayOfWeek: string;  // lunes, martes, etc.
  isFull: boolean;
  slots: TimeSlot[];
  suggestedAlternative?: string;
}

export interface BookingResult {
  success: boolean;
  appointmentId?: number;
  googleEventId?: string;
  message: string;
  details?: {
    customerName: string;
    serviceName: string;
    date: string;
    startTime: string;
    endTime: string;
  };
}

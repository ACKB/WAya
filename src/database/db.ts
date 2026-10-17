import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Asegurar que exista la carpeta data/
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'bot.db');
export const db = new DatabaseSync(dbPath);

// Inicializar tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    service_name TEXT NOT NULL,
    start_time TEXT NOT NULL, -- Formato ISO: YYYY-MM-DDTHH:mm:ss
    end_time TEXT NOT NULL,   -- Formato ISO: YYYY-MM-DDTHH:mm:ss
    status TEXT DEFAULT 'confirmed', -- confirmed, cancelled
    reminder_sent INTEGER DEFAULT 0,
    google_event_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone);
  CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_time);
`);

export interface UserRecord {
  phone: string;
  name: string | null;
  notes: string | null;
}

export interface MessageRecord {
  id: number;
  phone: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AppointmentRecord {
  id: number;
  phone: string;
  customer_name: string;
  service_name: string;
  start_time: string;
  end_time: string;
  status: string;
  reminder_sent: number;
  google_event_id: string | null;
}

export class DatabaseService {
  // Manejo de Usuarios
  static getUser(phone: string): UserRecord | null {
    const stmt = db.prepare('SELECT phone, name, notes FROM users WHERE phone = ?');
    const result = stmt.get(phone) as UserRecord | undefined;
    return result || null;
  }

  static upsertUserName(phone: string, name: string): void {
    const existing = this.getUser(phone);
    if (existing) {
      const stmt = db.prepare('UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?');
      stmt.run(name, phone);
    } else {
      const stmt = db.prepare('INSERT INTO users (phone, name) VALUES (?, ?)');
      stmt.run(phone, name);
    }
  }

  // Historial de Conversación
  static saveMessage(phone: string, role: 'user' | 'assistant', content: string): void {
    const stmt = db.prepare('INSERT INTO messages (phone, role, content) VALUES (?, ?, ?)');
    stmt.run(phone, role, content);
  }

  static getRecentMessages(phone: string, limit = 10): MessageRecord[] {
    const stmt = db.prepare(`
      SELECT id, phone, role, content, timestamp 
      FROM messages 
      WHERE phone = ? 
      ORDER BY id DESC 
      LIMIT ?
    `);
    const rows = stmt.all(phone, limit) as unknown as MessageRecord[];
    // Retornar en orden cronológico (más antiguo primero)
    return rows.reverse();
  }

  // Citas
  static createAppointment(data: {
    phone: string;
    customer_name: string;
    service_name: string;
    start_time: string;
    end_time: string;
    google_event_id?: string;
  }): number {
    const stmt = db.prepare(`
      INSERT INTO appointments (phone, customer_name, service_name, start_time, end_time, google_event_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      data.phone,
      data.customer_name,
      data.service_name,
      data.start_time,
      data.end_time,
      data.google_event_id || null
    );
    return Number(result.lastInsertRowid);
  }

  static getAppointmentsForDate(dateStr: string): AppointmentRecord[] {
    // dateStr en formato YYYY-MM-DD
    const stmt = db.prepare(`
      SELECT * FROM appointments 
      WHERE start_time LIKE ? AND status = 'confirmed'
      ORDER BY start_time ASC
    `);
    return stmt.all(`${dateStr}%`) as unknown as AppointmentRecord[];
  }

  static getUpcomingAppointmentsForReminder(fromIso: string, toIso: string): AppointmentRecord[] {
    const stmt = db.prepare(`
      SELECT * FROM appointments
      WHERE status = 'confirmed'
        AND reminder_sent = 0
        AND start_time >= ?
        AND start_time <= ?
    `);
    return stmt.all(fromIso, toIso) as unknown as AppointmentRecord[];
  }

  static markReminderSent(id: number): void {
    const stmt = db.prepare('UPDATE appointments SET reminder_sent = 1 WHERE id = ?');
    stmt.run(id);
  }

  static cancelAppointment(id: number): void {
    const stmt = db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?");
    stmt.run(id);
  }
}

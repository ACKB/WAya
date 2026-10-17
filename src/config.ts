import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

export interface WorkingHourInterval {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface ServiceItem {
  id: string;
  name: string;
  aliases: string[];
  durationMinutes: number;
  price: number;
  description: string;
}

export interface ServicesConfig {
  business: {
    name: string;
    timezone: string;
    workingHours: Record<string, WorkingHourInterval[]>;
  };
  services: ServiceItem[];
}

const servicesPath = path.resolve(process.cwd(), 'services.json');
let servicesData: ServicesConfig;

try {
  const raw = fs.readFileSync(servicesPath, 'utf-8');
  servicesData = JSON.parse(raw);
} catch (error) {
  console.warn('⚠️ No se pudo leer services.json, usando configuración por defecto.');
  servicesData = {
    business: {
      name: 'Salón de Belleza y Estética',
      timezone: 'America/Lima',
      workingHours: {
        monday: [{ start: '08:00', end: '13:00' }, { start: '14:00', end: '20:00' }],
        tuesday: [{ start: '08:00', end: '13:00' }, { start: '14:00', end: '20:00' }],
        wednesday: [{ start: '08:00', end: '13:00' }, { start: '14:00', end: '20:00' }],
        thursday: [{ start: '08:00', end: '13:00' }, { start: '14:00', end: '20:00' }],
        friday: [{ start: '08:00', end: '13:00' }, { start: '14:00', end: '20:00' }],
        saturday: [{ start: '09:00', end: '18:00' }],
        sunday: []
      }
    },
    services: [
      {
        id: 'tinte',
        name: 'Tinte de Cabello',
        aliases: ['tinte', 'color', 'mechas'],
        durationMinutes: 120,
        price: 80,
        description: 'Coloración capilar (2 horas)'
      },
      {
        id: 'corte',
        name: 'Corte de Cabello',
        aliases: ['corte', 'despunte'],
        durationMinutes: 30,
        price: 30,
        description: 'Corte de cabello (30 min)'
      }
    ]
  };
}

export const config = {
  ai: {
    provider: process.env.AI_PROVIDER || 'local',
    localBaseUrl: process.env.LOCAL_AI_BASE_URL || 'http://localhost:11434/v1',
    localModel: process.env.LOCAL_AI_MODEL || 'qwen2.5:7b',
    cloudApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.OPENAI_API_KEY || '',
  },
  calendar: {
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials.json',
  },
  timezone: process.env.TIMEZONE || servicesData.business.timezone || 'America/Lima',
  servicesData,
};

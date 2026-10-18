import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseService } from '../database/db.js';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);

export function startDashboardServer(): http.Server {
  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = parsedUrl.pathname;

    // Cabeceras CORS y JSON
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // --- API ENDPOINTS ---
    if (pathname === '/api/stats' && req.method === 'GET') {
      const stats = DatabaseService.getDashboardMetrics();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(stats));
      return;
    }

    if (pathname === '/api/appointments' && req.method === 'GET') {
      const appointments = DatabaseService.getAllAppointments(100);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(appointments));
      return;
    }

    if (pathname === '/api/beneficiaries' && req.method === 'GET') {
      const beneficiaries = DatabaseService.getAllBeneficiaries();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(beneficiaries));
      return;
    }

    if (pathname === '/api/services' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        businessName: config.servicesData.business.name,
        services: config.servicesData.services
      }));
      return;
    }

    if (pathname === '/api/appointments/cancel' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { id } = JSON.parse(body);
          if (id) {
            DatabaseService.cancelAppointment(Number(id));
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, message: 'Cita cancelada con éxito' }));
            return;
          }
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'ID de cita requerido' }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'JSON inválido' }));
        }
      });
      return;
    }

    // --- STATIC FILES ---
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    };

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard Web en vivo: http://localhost:${PORT}`);
    console.log(`📱 Vista para Kiosk/Tablet de recepción activa.`);
  });

  return server;
}

// Si se ejecuta directamente con `npx tsx src/dashboard/server.ts`
if (process.argv[1] && process.argv[1].endsWith('server.ts')) {
  startDashboardServer();
}

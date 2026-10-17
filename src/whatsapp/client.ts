import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'node:path';
import { BotOrchestrator } from '../bot/orchestrator.js';

export class WhatsAppClient {
  private static sock: WASocket | null = null;
  private static isConnecting = false;

  static async start(): Promise<void> {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const authFolder = path.resolve(process.cwd(), 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const logger = pino({ level: 'silent' }); // Evitar saturar la terminal con logs internos de Baileys

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false, // Manejamos el QR manualmente para mayor control y nitidez
      logger,
      browser: ['GestorCitasBot', 'Chrome', '1.0.0']
    });

    this.sock = sock;

    // Guardar credenciales cada vez que se actualicen
    sock.ev.on('creds.update', saveCreds);

    // Manejo de conexión y generación de QR
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n========================================================');
        console.log('📲 ESCANEA ESTE CÓDIGO QR CON WHATSAPP EN TU TELÉFONO:');
        console.log('   (Dispositivos vinculados > Vincular un dispositivo)');
        console.log('========================================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\nEsperando escaneo...');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`⚠️ Conexión de WhatsApp cerrada. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);

        this.sock = null;
        this.isConnecting = false;

        if (shouldReconnect) {
          setTimeout(() => this.start(), 3000);
        } else {
          console.log('❌ Sesión cerrada permanentemente. Borre la carpeta auth_info_baileys para volver a iniciar.');
        }
      } else if (connection === 'open') {
        this.isConnecting = false;
        console.log('\n🎉 ¡CONEXIÓN DE WHATSAPP ESTABLECIDA EXITOSAMENTE!');
        console.log('🤖 El bot de citas está listo para recibir y responder mensajes.\n');
      }
    });

    // Escuchar mensajes entrantes
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type !== 'notify') return;

      for (const msg of m.messages) {
        // Ignorar mensajes enviados por el propio bot
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

        // Ignorar grupos y difusiones de estado
        if (jid.endsWith('@g.us') || jid.includes('status@broadcast')) continue;

        // Extraer texto del mensaje
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        const phone = jid.split('@')[0];
        console.log(`📩 Mensaje recibido de ${phone}: "${text}"`);

        try {
          // Mostrar indicador de escribiendo...
          await sock.sendPresenceUpdate('composing', jid);

          // Procesar a través del orquestador del bot
          const reply = await BotOrchestrator.handleIncomingMessage(phone, text);

          // Enviar respuesta
          await sock.sendMessage(jid, { text: reply });
          await sock.sendPresenceUpdate('paused', jid);
        } catch (error: any) {
          console.error(`Error al procesar mensaje de ${phone}:`, error?.message || error);
        }
      }
    });
  }

  /**
   * Envía un mensaje proactivo a un número de WhatsApp (ej. recordatorios de 1 hora antes).
   */
  static async sendMessage(phone: string, text: string): Promise<boolean> {
    if (!this.sock) {
      console.warn('⚠️ No se puede enviar mensaje por WhatsApp: El cliente no está conectado.');
      return false;
    }

    try {
      const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
      await this.sock.sendMessage(jid, { text });
      return true;
    } catch (err: any) {
      console.error(`Error al enviar mensaje a ${phone}:`, err?.message || err);
      return false;
    }
  }
}

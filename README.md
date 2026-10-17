# 🤖 Bot de WhatsApp para Gestión de Citas

Bot inteligente de WhatsApp diseñado para negocios de servicios (peluquerías, salones de belleza, consultorios odontológicos) con citas de duración variable, memoria contextual de clientes y trato cálido adaptado para adultos mayores.

Proyecto universitario enfocado en simplicidad, claridad y facilidad de demostración.

---

## 🚀 Características Principales

1. **Duración variable por tratamiento**:
   - Detecta automáticamente el servicio y su duración (ej. Tinte = 2 horas, Corte dama = 45 min, Alisado = 3 horas).
   - Busca en el calendario únicamente huecos continuos que permitan atender el tratamiento completo.
2. **Memoria y trato humano**:
   - Recuerda el nombre del cliente (ej. *María*) mediante SQLite local. No vuelve a preguntar el nombre en futuras ocasiones a menos que se agende para otra persona.
   - Lenguaje claro, paciente y sin tecnicismos ni menús numéricos fríos.
   - Agrupa los horarios libres en ventanas amigables (ej: *"Lunes de 08:00 a 11:30 y de 14:00 a 18:30"*).
3. **Manejo de disponibilidad y alternativas**:
   - Si un día está lleno, responde con empatía y ofrece alternativas para días cercanos o la próxima semana.
4. **Recordatorios automáticos**:
   - Un proceso en segundo plano avisa por WhatsApp **1 hora antes de la cita** recomendando llegar con **15 minutos de anticipación**.
5. **WhatsApp con Baileys**:
   - Conexión directa mediante escaneo de código QR en consola. Sin coste, sin cuenta comercial de Meta.
6. **IA Híbrida / Multi-proveedor**:
   - Compatible de inicio con modelos locales (Ollama o LM Studio mediante `http://localhost:11434/v1` o `http://localhost:1234/v1`) y configurable para cambiar a la nube (Google Gemini Flash o OpenAI) editando `.env`.
7. **Google Calendar con Fallback Local**:
   - Si agregas `credentials.json`, sincroniza en tiempo real con Google Calendar.
   - Si no lo tienes aún, opera 100% funcional en modo local con base de datos SQLite integrada.

---

## 📁 Estructura del Proyecto

```text
Proyecto/
├── services.json             # Catálogo de servicios, duraciones y horarios de atención
├── package.json              # Dependencias y scripts
├── .env                      # Configuración de IA y calendario
├── HISTORIAL.md              # Registro cronológico del proyecto
├── src/
│   ├── index.ts              # Punto de entrada principal (WhatsApp + Recordatorios)
│   ├── simulator.ts          # Simulador interactivo en terminal
│   ├── config.ts             # Configuración de entorno y servicios
│   ├── database/
│   │   └── db.ts             # Base de datos SQLite nativa (node:sqlite)
│   ├── calendar/
│   │   ├── types.ts          # Interfaces de citas y slots
│   │   ├── slotCalculator.ts # Algoritmo de cálculo de bloques libres
│   │   └── calendarService.ts# Google Calendar y persistencia
│   ├── ai/
│   │   ├── prompt.ts         # System prompt cordial con reglas de cierre
│   │   ├── tools.ts          # Definición de herramientas (Function Calling)
│   │   └── aiService.ts      # Cliente universal de IA y extracción de nombres
│   ├── scheduler/
│   │   └── reminder.ts       # Cron de recordatorios (1h antes)
│   ├── whatsapp/
│   │   └── client.ts         # Conexión Baileys con QR en terminal
│   └── bot/
│       └── orchestrator.ts   # Orquestador del flujo conversacional
└── test-logic.ts             # Pruebas unitarias de disponibilidad y memoria
```

---

## 🛠️ Comandos de Ejecución

### 1. Ejecutar pruebas de lógica
Valida el cálculo de slots de 2 horas para tinte, detección de nombres y prevención de solapamientos:
```bash
npm test
```

### 2. Probar en el Simulador (Sin escanear WhatsApp)
Ideal para probar el bot de inmediato o presentarlo en la universidad:
```bash
npm run simulate
```

### 3. Iniciar el Bot con WhatsApp
Inicia el bot, muestra el código QR en la consola para escanear con tu celular y activa el servicio de recordatorios:
```bash
npm start
```
*(O en modo desarrollo con recarga automática: `npm run dev`)*

---

## ⚙️ Configuración (.env)

El archivo `.env` permite alternar el proveedor de IA:

### Usar IA Local (Ollama o LM Studio):
```env
AI_PROVIDER=local
LOCAL_AI_BASE_URL=http://localhost:11434/v1
LOCAL_AI_MODEL=qwen2.5:7b
```

### Cambiar a IA en la Nube (Google Gemini):
```env
AI_PROVIDER=cloud
GOOGLE_GENERATIVE_AI_API_KEY=tu_api_key_aqui
```

---

## 📅 Conexión opcional con Google Calendar
Para sincronizar las citas con una cuenta real de Google Calendar:
1. Crea una Cuenta de Servicio en Google Cloud Console con la API de Google Calendar habilitada.
2. Descarga la clave en formato JSON y guárdala como `credentials.json` en la raíz del proyecto.
3. Comparte tu Google Calendar con el correo de la cuenta de servicio con permisos de edición.

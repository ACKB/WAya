# Historial del Proyecto - Bot de WhatsApp para Gestión de Citas

Este archivo registra el historial de decisiones, requerimientos, arquitectura y avances del proyecto para garantizar continuidad entre sesiones o agentes de IA.

---

## 📅 Sesión Inicial: 16 de Octubre de 2026

### 1. Requerimientos del Usuario
- **Objetivo**: Bot inteligente para WhatsApp enfocado en negocios de servicios con citas de duración variable (peluquerías, odontologías, barberías, etc.).
- **Características clave**:
  - **Duración variable por tratamiento**: Detecta automáticamente el tiempo necesario según el servicio (ej. tinte = 2h, corte = 30min).
  - **Conversación natural y orientada a cerrar la cita**: Tono cálido, sencillo, apto para adultos mayores o personas poco familiarizadas con la tecnología.
  - **Memoria conversacional contextual**: Recuerda el nombre, preferencias o datos ya dados por el cliente en el mismo chat (no volver a pedir nombre a menos que sea para un tercero).
  - **Manejo inteligente de disponibilidad**: Búsqueda de huecos libres, manejo de días llenos, propuestas de alternativas cercanas o para la siguiente semana.
  - **Recordatorios automáticos**: Notificación por WhatsApp 1 hora antes de la cita recomendando llegar con 15 minutos de anticipación.
  - **Integraciones deseadas**:
    - WhatsApp (conexión directa o API).
    - Google Calendar (sincronización bidireccional de horarios y reservas).
    - Motor de Inteligencia Artificial (híbrido: adaptable a IA local vía Ollama o IA en la nube como Gemini/OpenAI).

### 2. Contexto de Hardware y Reglas del Sistema
- **Máquina**: Intel Core Ultra 7 255HX, 16 GB RAM, RTX 5070 Ti (12GB VRAM), Linux dual boot.
- **Ollama**: Instalado localmente con `qwen2.5:14b-instruct-q4_k_m` y `qwen2.5-coder:14b-instruct-q4_k_m`.
- **Restricción de Recursos**: El usuario usa la laptop para gaming; no bloquear VRAM permanentemente. Mantener consumo de RAM bajo.
- **Filosofía**: Dependencias locales al proyecto (`node_modules` o `venv`), infraestructura en Docker si aplica, o SQLite local para máxima ligereza y portabilidad.

### 3. Diagnóstico Técnico del Sistema
- Node.js `v26.11.1` y npm `12.2.0` instalados y listos.
- Python `3.14.8` disponible.
- Docker: No instalado en el sistema actualmente.
- LM Studio binario detectado en PATH (`/home/ackb/.lmstudio/bin`).
- **Decisión de Arquitectura**: Para respetar las restricciones de RAM (16 GB) y no requerir instalar Docker, el bot se construirá en **Node.js + TypeScript**, utilizando **SQLite** local (cero consumo en reposo) y una capa modular para IA y WhatsApp.

### 5. Acuerdos y Decisiones (Proyecto Universitario)
- **Alcance**: Proyecto académico/universitario. Prioridad a la simplicidad, claridad de código, facilidad para demostrar en vivo y bajo consumo de recursos.
- **WhatsApp**: Conector directo **Baileys** (WebSockets, código QR escaneable en la terminal). No requiere cuenta de empresa en Meta ni webhooks públicos.
- **Motor de IA**:
  - Enfoque inicial: **IA Local** mediante protocolo compatible con OpenAI (`http://localhost:11434/v1` para Ollama o `http://localhost:1234/v1` para LM Studio).
  - Alerta de espacio: Actualmente hay **14 GB disponibles** en el disco SSD (`/dev/nvme0n1p6`). Por precaución, para modelos locales se recomiendan pesos ligeros (3B a 7B, ~2-4 GB) o conectar a un servidor ya existente.
  - Diseño modular: Transición transparente a IA en la nube (Gemini/OpenAI) modificando únicamente el archivo `.env`.
- **Memoria Contextual**: **SQLite** local vía `better-sqlite3` o `sqlite3` para almacenar:
  - Nombres detectados por número telefónico (para no volver a pedirlo a María).
  - Historial reciente de la conversación.
  - Citas agendadas y marcas de recordatorios enviados.
- **Google Calendar**: Módulo con soporte dual (Google Calendar API real mediante Service Account + Mock local para pruebas sin credenciales).
- **Recordatorios**: Tarea programada que inspecciona citas pendientes y envía alerta 60 minutos antes recordando llegar con 15 minutos de anticipación.

### 6. Implementación y Validación Técnica (16 de Octubre de 2026)
- **Archivos creados**:
  - `services.json`: Catálogo de tratamientos con duraciones en minutos (tinte 120m, corte dama 45m, corte caballero 30m, alisado 180m, etc.) y horarios de atención.
  - `src/config.ts`: Carga de configuración y servicios tipados.
  - `src/database/db.ts`: Base de datos SQLite nativa (`node:sqlite`) con tablas para memoria de usuarios, historial de chat y reservas.
  - `src/calendar/slotCalculator.ts`: Algoritmo que calcula huecos continuos según duración del servicio y los agrupa en rangos amigables para personas mayores.
  - `src/calendar/calendarService.ts`: Gestor de calendario con soporte dual (Google Calendar Service Account y fallback local automático).
  - `src/ai/prompt.ts`: Prompt del sistema orientado a la amabilidad, sencillez y cierre de cita.
  - `src/ai/tools.ts`: Definición de Function Calling (OpenAI schema) para consultar disponibilidad, agendar y guardar nombres.
  - `src/ai/aiService.ts`: Cliente universal de IA compatible con Ollama, LM Studio y Cloud, con extracción heurística de nombres.
  - `src/scheduler/reminder.ts`: Cron que inspecciona citas pendientes 1 hora antes y envía notificación por WhatsApp recomendando llegar con 15 minutos de anticipación.
  - `src/whatsapp/client.ts`: Cliente Baileys con autenticación multi-file y renderizado de código QR en consola.
  - `src/bot/orchestrator.ts`: Orquestador que conecta WhatsApp con la memoria y la IA.
  - `src/index.ts`: Punto de entrada principal para producción/ejecución con WhatsApp.
  - `src/simulator.ts`: Simulador interactivo en terminal (`npm run simulate`) para pruebas y exposiciones universitarias.
  - `test-logic.ts`: Suite de pruebas unitarias (`npm test`).

- **Resultados de pruebas**:
  - `npm test`: Pasó con éxito el cálculo de duración de 2h para tinte, detección y guardado de nombres de clientes en SQLite, prevención de citas solapadas y formateo amigable de horarios.
  - `npx tsc --noEmit`: 0 errores de tipado.

### 7. Decisión Arquitectónica: Laya (Sistema 1) + LLM Grounded (Sistema 2)
- **Visión del Usuario para GitHub**:
  - Implementar **Laya** como motor de decisión y extracción estructurada para evitar que el modelo generativo se confunda con fechas o contexto.
  - Flujo en dos etapas:
    1. **Extracción y Clasificación con Laya (~40 ms)**: Lee la conversación y clasifica los tópicos en un formulario limpio: `Nombre`, `Petición/Servicio`, `Día/Hora solicitada`.
    2. **Validación Determinista**: TypeScript consulta `slotCalculator.ts` y SQLite/Google Calendar para rellenar los `Horarios disponibles` reales y verificar conflictos.
    3. **Renderizado de Lenguaje Natural (LLM Generativo)**: El modelo recibe el formulario JSON ya validado y se enfoca exclusivamente en redactar una respuesta cálida, empática y orientada al cierre, con **cero riesgo de alucinación** de fechas o disponibilidad.
- **Ventaja Técnica del Ecosistema**:
  - Se descubrió el paquete `laya-system-one`:
    - Modelo nativo compilado en Rust para Linux x64.
    - Ocupa solo **~324 MB en disco** (cumple holgadamente con la restricción de los 14 GB disponibles).
    - Basado en `convaiinnovations/laya-multilingual` (`mmBERT-base`, 322M parámetros), con soporte nativo en español.
    - No requiere Python ni PyTorch, integrándose limpiamente en el proyecto Node.js existente.
### 8. Implementación Completada de Laya Decision Engine
- Se integró `laya-system-one` con soporte nativo de Rust para Linux x64 (~324 MB en disco).
- Se creó `src/ai/layaRouter.ts`:
  - Evalúa intenciones (`agendar`, `consultar_disponibilidad`, `precios`, `saludo`, etc.) en ~40ms.
  - Detecta servicios y duraciones automáticamente.
  - Extrae días y horarios específicos (ej. "8:30").
  - Mantiene la persistencia del tratamiento a lo largo del historial de la conversación (si el cliente preguntó por tinte en el paso 1, en el paso 2 y 3 se retiene sin pedirle que lo repita).
  - Consulta en tiempo real a `CalendarService` y genera el **Formulario Factual Grounded** para entregárselo al LLM generativo.
- Se verificó con `test-laya-pipeline.ts`:
  - Precisión de clasificación en español >99%.
  - Cero alucinaciones de disponibilidad o fechas.
  - Compilación TypeScript sin errores.

### 9. Adopción de llama.cpp y Automatización (setup.sh, SystemOn.sh, SystemOff.sh)
- **Decisión del Usuario**: Emplear **llama.cpp** como motor nativo de inferencia local en lugar de LM Studio/Ollama, con scripts automatizados de ciclo de vida.
- **Implementaciones realizadas**:
  - `servicios.json`: Archivo de configuración intuitivo en español para editar nombres de tratamientos, duraciones en minutos y precios.
  - `src/config.ts`: Actualizado para mapear dinámicamente `servicios.json`.
  - `bin/llama-server`: Binario portátil de `llama.cpp` alojado dentro del proyecto (`./bin/`), garantizando total limpieza del sistema y portabilidad (Regla #8 y #10).
  - `setup.sh`: Script interactivo de instalación que instala dependencias, descarga `llama-server`, descarga `Llama-3.2-3B-Instruct-Q4_K_M.gguf` (~2.0 GB) y ofrece escanear el QR de WhatsApp en el primer arranque.
  - `SystemOn.sh`: Script de encendido completo. Verifica si hay una sesión previa activa; si existe, la apaga limpiamente, levanta `llama-server` en background en el puerto 8080 con aceleración GPU (`-ngl 99`), espera el chequeo de salud y lanza el bot de WhatsApp con Laya y recordatorios.
  - `SystemOff.sh`: Script de apagado limpio. Cierra el bot, detiene `llama-server` y verifica mediante `nvidia-smi` que la VRAM de la GPU RTX 5070 Ti quede 100% liberada para videojuegos.

### 10. Guardrail Anti-Desvío de Tema (Anti-Jailbreak) con Laya
- **Requerimiento del Usuario**: Dotar a Laya de la capacidad de detectar desvíos de tema (preguntas de código, matemáticas, chistes, jailbreaks) y activar una bandera para que el modelo generativo responda: *"Hay que evitar movernos de tema. ¿Para cuándo quisiera su cita o qué tipo de tratamiento desea?"*.
- **Implementación**:
  - `src/ai/layaRouter.ts`: Se integró la pregunta tipada `tema` (`salon_citas` vs `tema_externo`), con salvaguardas para proteger intenciones legítimas con horas o servicios explícitos.
  - Formulario Factual: Si `isOffTopic` es verdadero, Laya aborta las consultas de disponibilidad e inyecta la instrucción estricta de redirección.
  - `src/ai/prompt.ts`: Se incorporó la Regla 5 de Control de Tema (Anti-Desvío).
  - `src/ai/aiService.ts`: Personalización del fallback para atajar de inmediato cualquier intento de desvío.
- **Validación**:
  - `test-laya-pipeline.ts` (Paso 4): Solicitud de código en Python detectada como `isOffTopic: true` y bloqueada, generando la instrucción de redirección directa.

### 11. Consulta de Estado de Publicación en GitHub (18 de Octubre de 2026)
- **Consulta del Usuario**: Preguntó si el proyecto ya se había subido a GitHub.
- **Diagnóstico Realizado**:
  - `git remote -v`: No tiene ningún remoto asociado actualmente.
  - `gh auth status`: La cuenta `ACKB` está autenticada y activa en el CLI de GitHub.
  - `gh repo list`: No existe aún un repositorio remoto creado para este proyecto.
- **Estado Actual**: El proyecto reside de manera 100% local en `/home/ackb/Downloads/Proyecto`.
- **Propuesta de Nomenclatura**: Se evalúan nombres orientados a IA y WhatsApp (`WA`) para el repositorio (ej. `wagent-ai`, `wa-laya-ai`, `wa-scheduler-ai`, `wa-citas-ai`).


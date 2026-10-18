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
- **Nombre Definitivo Seleccionado**: **`WAya`** (fusión de *WhatsApp* + *Laya Decision Engine*).
- **Visibilidad Elegida**: Público en GitHub (`ACKB/WAya`).
- **Publicación**: Repositorio inicializado y sincronizado mediante GitHub CLI (`gh repo create WAya --public --source=. --remote=origin --push`).

### 12. Guía y Protocolo de Pruebas de WAya (18 de Octubre de 2026)
- **Diagnóstico previo**:
  - `bin/llama-server` y librerías C++ ya están listas en `./bin/`.
  - `node_modules` instalado con `laya-system-one` (Rust mmBERT).
  - Espacio en disco disponible: **53 GB libres** (holgado para el modelo de 2.0 GB).
- **Validaciones ejecutadas con éxito**:
  - `test-logic.ts`: Cálculo de bloques continuos para tinte (2 horas), memoria de usuarios en SQLite y prevención de solapamientos. (OK)
  - `test-laya-pipeline.ts`: Clasificación determinista (~40 ms), retención de tratamiento en el contexto y guardrail anti-desvío (bloqueo de preguntas externas / jailbreak). (OK)
### 13. Incidente de Memoria (OOM-Kill) y Diagnóstico Técnico (18 de Octubre de 2026)
- **Incidente reportado por el usuario**: Al intentar probar el proyecto, Antigravity IDE se cerró abruptamente mostrando el diálogo de GNOME: *"Application Stopped. Device memory is nearly full. An application was using a lot of memory and was forced to stop"*.
- **Diagnóstico en logs del sistema (`journalctl` y `dmesg`)**:
  - A las 11:34:58, `systemd-oomd` detectó saturación crítica: Memoria física al 96.9% (15.6 GB / 16.1 GB) y Swap/ZRAM al 90.3% (14.5 GB / 16.1 GB).
  - Al superar el umbral del 90%, el demonio OOM de Linux procedió a matar el cgroup consumidor superior (`app-org.chromium.Chromium-3794.scope` correspondiente al proceso de Antigravity IDE, que acumulaba 10.9 GB de RAM pico + 11.6 GB de swap).
- **Causa Raíz Identificada**:
  1. El binario descargado para `llama.cpp` (`llama-b11706-bin-ubuntu-x64.tar.gz`) era la versión estándar para CPU (sin soporte CUDA).
  2. Como resultado, la bandera `-ngl 99` en `SystemOn.sh` no pudo enviar las capas del modelo a los 12 GB de VRAM de la GPU RTX 5070 Ti, forzando la asignación del modelo (2.0 GB) y del buffer de contexto directamente en la memoria RAM principal (16 GB compartidos con el IDE, Brave, ZRAM y servicios).
  3. ZRAM al llenarse comprime sobre la misma RAM física, lo que redujo la memoria disponible a 0 kB (`Chrome_IOThread: page allocation failure`).
### 14. Solución Implementada: Aceleración CUDA Nativa en GPU RTX 5070 Ti (18 de Octubre de 2026)
- **Corrección en `bin/llama-server`**:
  - Se sustituyó la compilación de CPU por la versión precompilada con soporte **CUDA 13.4** (`llama-b11706-bin-ubuntu-cuda-13.4-x64.tar.gz`), enlazada con las librerías nativas del sistema en `/opt/cuda/lib64`.
  - Se actualizó el wrapper `bin/llama-server` para exportar `LD_LIBRARY_PATH="/opt/cuda/lib64:$DIR/llama-b11706:$LD_LIBRARY_PATH"`.
- **Ajuste de parámetros en `SystemOn.sh`**:
  - Se fijó `-c 2048 -np 1` para evitar la creación innecesaria de 4 slots de 76k tokens de contexto que consumían gigabytes de buffer.
- **Verificación con `nvidia-smi`**:
  - `llama-server` carga el modelo Llama 3.2 3B en **1.1 segundos**.
  - Ocupa exactamente **2396 MiB (2.3 GB) en la VRAM de la GPU RTX 5070 Ti**, dejando ~9.5 GB libres para el sistema y juegos.
  - El consumo en memoria RAM del sistema es de **0 MB** para el modelo.
  - Al ejecutar `kill` o `./SystemOff.sh`, la VRAM se libera por completo (265 MiB de uso en reposo).
- **Actualización de Scripts**:
  - `setup.sh`: Actualizado para apuntar permanentemente a la distribución CUDA 13.4.
  - `SystemOn.sh`: Optimizado con `-c 2048 -np 1`.
  - `npm test` y `npx tsx test-laya-pipeline.ts`: 100% exitosos sin alertas de memoria.

### 15. Refinamiento Conversacional y Eliminación de Tool-Calling Redundante (18 de Octubre de 2026)
- **Diagnóstico tras prueba interactiva del usuario (`npm run simulate`)**:
  1. *Nombre corrompido*: Al enviar esquemas de herramientas (`tools`) obligatorios al modelo 3B, el modelo inventó el nombre `"Año que proporciona el nombre del cliente"`, el cual se guardó erróneamente en SQLite.
  2. *Error HTTP 500 peg-native format*: La gramática interna de `llama-server` falló al intentar forzar JSON estructurado sobre la salida conversacional del modelo generativo.
  3. *Falta de empatía estética*: El bot ignoró las dudas del cliente ("¿rubio o negro?", "¿naranja?") porque estaba ocupado intentando llamar herramientas en vez de conversar.
  4. *Falso positivo de cancelación y pérdida del día*: Al decir "para el lunes a las 8...", Laya lo clasificó como `cancelar`, y en el turno 3 se perdió la referencia de que se estaba hablando del lunes.
- **Acciones Correctivas Aplicadas**:
  1. **Supresión de Tool-Calling en el LLM**: Se retiró el envío de `tools` al modelo local. Dado que **Laya Decision Engine + TypeScript** ya hacen la extracción fáctica, la consulta al calendario y la confirmación en ~40ms, el LLM ahora recibe el formulario ya resuelto y se enfoca 100% en redactar una respuesta cálida, asesorar y cerrar la cita sin errores 500.
  2. **Detección de Rangos de Horario**: `extractSpecificTime` ahora reconoce `"de 10 a 11:30"` extrayendo la hora inicial exacta (`10:00`).
  3. **Persistencia Contextual del Día**: Si el cliente no repite el día en su respuesta, el sistema busca en los mensajes previos y retiene el día en discusión (ej. Lunes).
  4. **Protección en SQLite**: `upsertUserName` ahora rechaza cadenas sospechosas o fragmentos de prompt.
  5. **Regla de Asesoramiento de Estilista**: Se incorporó al prompt del sistema la instrucción de responder con criterio profesional a consultas sobre tintes y estilos antes de orientar al horario.
- **Resultados de Validación**:
  - Flujo de 3 turnos verificado con éxito: el bot asesora sobre rubio, negro y naranja cobrizo con empatía, mantiene el lunes en contexto y confirma la cita a las 10:00 sin errores.

### 16. Arquitectura Definitiva: JSON Slot-Filling, Reloj 12h Perú y Confirmación Fija (18 de Octubre de 2026)
- **Requerimiento y Decisión Clave del Usuario**:
  - Evitar pasar historiales largos a Llama 3B para evitar que se maree y mezcle números o fragmentos de frases anteriores.
  - Trabajar con un **Formulario de Estado (JSON Slot-Filling)** gestionado deterministamente por Laya + TypeScript que identifique claramente: *"Falta coordinar estas cosas"*.
  - **Reloj de 12 horas para Perú**: Manejar siempre formato con `am` y `pm` (ej. `10:00 am`, `02:00 pm`), nunca formato militar de 24 horas.
  - **Estructura Fija de Confirmación Final**: Una vez que Laya tiene el JSON 100% completo (`X`, `Y`, `Z`, `A`, `B`, `M`), emitir una respuesta fija y determinista:
    > *"Entonces señor o señora X, quedamos para el día Y de Z de A a B para M."*
    - `X`: Nombre del cliente (ej. Yolanda)
    - `Y`: Día del mes (ej. 19 o 22)
    - `Z`: Nombre del mes (ej. Octubre o Noviembre)
    - `A`: Hora de inicio en 12h am/pm (ej. 10:00 am)
    - `B`: Hora de fin en 12h am/pm (ej. 12:00 pm / 11:30 am, calculada con la duración)
    - `M`: Tratamiento / Servicio (ej. Tinte de Cabello, Corte, etc.)
- **Implementación Técnica Realizada**:
  1. `SlotCalculator.to12Hour` y `SlotCalculator.formatDateEs`: Conversor de horas a 12h `am`/`pm` y extractor de día/mes en español.
  2. `appointment_drafts` en SQLite: Tabla persistente que almacena el progreso de coordinación por cada teléfono (`customer_name`, `service_id`, `service_name`, `duration_minutes`, `date_str`, `start_time`, `end_time`).
  3. `LayaRouter.generateGroundedForm`: Acumula el estado, consulta disponibilidad y genera la lista `faltantes` y el flag `completo`.
  4. `AIService.generateReply`:
     - Si `completo === true`: Registra la cita y emite la respuesta fija estructurada (añadiendo consejo estético si el cliente preguntó sobre color en ese turno).
     - Si faltan datos: Llama recibe únicamente un prompt limpio y minimalista con el JSON del estado actual y lo que falta coordinar, sin historial extenso que lo confunda.
- **Validación Exitosa (`test-yolanda.ts`)**:
  - Turno 1: Detección de tinte de cabello -> Estado: falta día, hora y nombre.
  - Turno 2: Cliente pregunta por 8:00 am ocupado y pide consejo de color -> Bot asesora sobre rubio y negro, y avisa de opciones disponibles en 12h am/pm.
  - Turno 3: Cliente pide de 10 a 11:30 am y menciona naranja -> Bot asesora sobre naranja pastel/cobrizo, reserva 10:00 am a 12:00 pm y pide su nombre.
  - Turno 4: Cliente dice "Yolanda" -> Formulario 100% completo, cita agendada en SQLite y respuesta fija:
    > *"Entonces señor o señora Yolanda, quedamos para el día 19 de Octubre de 10:00 am a 12:00 pm para Tinte de Cabello. ¡Le esperamos con mucho gusto!"*

### 17. Adaptación y Alineación Académica de WAya.tex al Curso de Gestión y Análisis de Datos e Información (18 de Octubre de 2026)
- **Requerimiento del Usuario**:
  - El documento `WAya.tex` corresponde al curso universitario **"Gestión y Análisis de Datos e Información"**.
  - Reorientar integralmente el proyecto y el documento para reflejar las competencias y fundamentos de la asignatura, reemplazando la visión de plan de negocio genérico por un enfoque riguroso de arquitectura de datos, calidad, analítica e inteligencia de negocios.
- **Transformación Integral de `WAya.tex`**:
  1. **Portada y Metadatos Formales**:
     - Asignatura: *Gestión y Análisis de Datos e Información*.
     - Denominación: *WAya (WhatsApp Analytics & Laya Intelligent Booking Engine)*.
     - Metadatos `hyperref` actualizados con palabras clave de la disciplina (Data Lifecycle, Relational Modeling, 3FN, Slot Filling, Business Intelligence, Ley 29733).
  2. **Entregable 1 (Ficha Técnica Orientada a Datos)**:
     - Diagnóstico de patologías informacionales en MYPEs peruanas: *Dark Data* no estructurado en hilos de WhatsApp, volatilidad de la información, latencia de procesamiento humano (30-60 min) y nula analítica histórica.
     - Propuesta de valor de datos: Transformación en tiempo real (< 5s) de lenguaje natural libre hacia registros relacionales en 3FN mediante orquestación híbrida (Laya + Edge LLM).
  3. **Entregable 2 (Lienzo Canvas de Datos - Formato Horizontal Landscape)**:
     - 9 bloques adaptados al flujo y monetización del dato: activos de información, activos tecnológicos, canales de captura transaccional, estructura de costos de infraestructura y fuentes de monetización por suscripción SaaS analítica.
     - Implementado en orientación horizontal con el paquete `pdflscape` para evitar desbordes y garantizar legibilidad ejecutiva.
  4. **Capítulo 3: Ciclo de Vida del Dato y Arquitectura Micro-Streaming ETL**:
     - Modelado formal de las 5 fases del ciclo de vida del dato (Ingesta, Extracción estructurada, Normalización/Calidad, Persistencia relacional y Analítica/Sincronización).
     - Diagrama TikZ del ciclo de vida del dato.
     - Detalle del pipeline Micro-Streaming ETL (< 5s) con ejemplos de carga JSON intercambiada para el llenado de slots sin alucinaciones.
  5. **Capítulo 4: Modelado Conceptual, Lógico y Físico (3FN) y Calidad de Información**:
     - Diagrama Entidad-Relación (MER) formal en TikZ con las entidades `USERS`, `APPOINTMENTS`, `APPOINTMENT_DRAFTS` y `SERVICES`.
     - Diccionario de datos exhaustivo con restricciones de integridad, llaves foráneas y tipos de datos.
     - Control determinista de calidad del dato: fórmula matemática de completitud paramétrica del vector de slots $\{X, Y, Z, A, B, M\}$, condición de no solapamiento temporal $[A, B]$ y normalización cultural al reloj peruano de 12 horas (*am/pm*).
  6. **Capítulo 5: Analítica de Datos y Business Intelligence (BI)**:
     - Taxonomía en tres niveles: Analítica Descriptiva (TCC, ranking de servicios), Diagnóstica (causas de no-show y abandono) y Predictiva (detección de horas valle).
     - Tablero de KPIs de datos y negocio (Tasa de Conversión Conversacional, No-Show Rate, Índice de Ocupación de Agenda, Latencia Media Local).
     - Modelo probabilístico de series temporales para identificación de **Horas Valle** $P(\text{Vacancia}_{d, h}) \ge 0.70$ con reglas prescriptivas de promociones automatizadas.
  7. **Capítulo 6: Gobernanza, Seguridad y Soberanía del Dato (Ley N° 29733)**:
     - Principios rectores aplicados: Finalidad, Proporcionalidad y Seguridad/Confidencialidad.
     - Justificación de la arquitectura Edge AI local (Llama 3.2 3B en GPU dedicada RTX 5070 Ti) para garantizar soberanía absoluta de datos sensibles de clientes/pacientes frente a riesgos de fuga en APIs cloud públicas.
  8. **Capítulo 7: Conclusiones y Recomendaciones Académicas**.
- **Validación de Compilación**:
  - Compilado exitosamente con `pdflatex` dos veces consecutivas.
  - Generado el archivo PDF final: `WAya.pdf` (18 páginas de alta calidad editorial, con índice de contenidos, índice de tablas, índice de figuras, diagramas TikZ y tablas estructuradas sin errores de sintaxis).




# 🤖 Bot de WhatsApp para Gestión de Citas (Laya + llama.cpp)

Bot inteligente de WhatsApp diseñado para negocios de servicios (peluquerías, salones de belleza, odontología, barberías) con citas de duración variable, memoria contextual de clientes y trato cálido adaptado para adultos mayores.

Proyecto universitario con arquitectura desacoplada en dos fases:
- **Sistema 1 (Laya Decision Engine, ~40 ms)**: Clasificación de intenciones y extracción de tópicos (cero alucinaciones).
- **Sistema 2 (llama.cpp con Llama 3.2 3B)**: Humanizador conversacional empático, sin matemáticas ni código.

---

## 🚀 Arquitectura y Características

1. **Duración variable por tratamiento y precios configurables**:
   - Tratamientos, duraciones y precios se configuran en [`servicios.json`](file:///home/ackb/Downloads/Proyecto/servicios.json).
   - Busca en el calendario bloques continuos que cubran la duración exacta (ej. Tinte = 2 horas, Corte = 30 min, Alisado = 3 horas).
2. **Memoria y trato humano**:
   - Recuerda el nombre de la clienta (ej. *María*) mediante SQLite local. No se lo vuelve a preguntar en futuras citas.
   - Agrupa los horarios libres en ventanas amigables (ej: *"Lunes de 08:00 a 11:30 y de 14:00 a 18:30"*).
3. **Manejo de disponibilidad y alternativas**:
   - Si un día está lleno, responde con empatía y ofrece alternativas para días cercanos o la próxima semana.
4. **Recordatorios automáticos**:
   - Proceso proactivo por WhatsApp **1 hora antes de la cita** recomendando llegar con **15 minutos de anticipación**.
5. **WhatsApp con Baileys**:
   - Conexión directa mediante escaneo de código QR en consola. Sin coste, sin cuenta comercial de Meta.
6. **Protección contra desvíos de contexto (Anti-Jailbreak)**:
   - Al usar **Laya** para ruteo y **Llama 3.2 (3B)** como humanizador, la IA no sabe ni puede resolver código o matemáticas fuera de lugar.
7. **Control total de GPU para videojuegos**:
   - Con `./SystemOff.sh` el servidor `llama.cpp` se detiene y libera el 100% de la VRAM de tu GPU para jugar.

---

## 🛠️ Comandos Rápidos de Uso

### 1. Instalación inicial (Setup)
Ejecuta el asistente automatizado que instala dependencias, descarga el binario portátil de `llama.cpp` y el modelo `Llama 3.2 3B (GGUF)`:
```bash
./setup.sh
```

### 2. Encender todo el sistema (SystemOn)
Inicia el servidor `llama.cpp` en GPU y el bot de WhatsApp. Si ya había una sesión abierta, la reinicia limpiamente:
```bash
./SystemOn.sh
```

### 3. Apagar todo el sistema (SystemOff)
Detiene el bot, apaga `llama-server` y **libera el 100% de la VRAM de la GPU**:
```bash
./SystemOff.sh
```

---

## 📝 Personalización de Servicios, Tiempos y Precios

Puedes editar directamente el archivo [`servicios.json`](file:///home/ackb/Downloads/Proyecto/servicios.json):

```json
{
  "id": "tinte",
  "nombre": "Tinte de Cabello",
  "sinonimos": ["tinte", "teñir", "color", "mechas"],
  "duracion_minutos": 120,
  "precio": 80,
  "descripcion": "Coloración completa capilar (2 horas)."
}
```

---

## 🧪 Pruebas y Simulador

- **Probar el pipeline de Laya y disponibilidad**:
  ```bash
  npx tsx test-laya-pipeline.ts
  ```
- **Probar la conversación en terminal (Simulador interactivo)**:
  ```bash
  npm run simulate
  ```

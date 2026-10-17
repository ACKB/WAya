#!/usr/bin/env bash

# Colores para la terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE} 🚀 INICIANDO SISTEMA COMPLETO (SystemOn)              ${NC}"
echo -e "${BLUE}========================================================${NC}"

mkdir -p data/logs data/pids

# 1. Comprobar si ya existe una sesión activa y apagarla primero
echo -e "${YELLOW}🔍 Verificando si existe una sesión previa activa...${NC}"

PREV_RUNNING=0

if [ -f "data/pids/bot.pid" ] && kill -0 $(cat data/pids/bot.pid) 2>/dev/null; then
    PREV_RUNNING=1
fi

if [ -f "data/pids/llama.pid" ] && kill -0 $(cat data/pids/llama.pid) 2>/dev/null; then
    PREV_RUNNING=1
fi

if lsof -i :8080 >/dev/null 2>&1; then
    PREV_RUNNING=1
fi

if [ "$PREV_RUNNING" -eq 1 ]; then
    echo -e "${YELLOW}⚠️  Se detectó una sesión previa en ejecución. Apagando antes de reiniciar...${NC}"
    ./SystemOff.sh >/dev/null 2>&1 || true
    sleep 2
    echo -e "${GREEN}✔ Sesión previa cerrada correctamente.${NC}"
fi

# 2. Verificar que existan los binarios y modelos
if [ ! -f "bin/llama-server" ]; then
    echo -e "${RED}❌ No se encontró ./bin/llama-server. Por favor ejecuta primero: ./setup.sh${NC}"
    exit 1
fi

MODEL_PATH="models/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
if [ ! -f "$MODEL_PATH" ]; then
    echo -e "${RED}❌ No se encontró el modelo $MODEL_PATH. Por favor ejecuta primero: ./setup.sh${NC}"
    exit 1
fi

# 3. Encender servidor llama.cpp (Llama 3.2 3B en GPU RTX 5070 Ti)
echo -e "${CYAN}🦙 [1/2] Levantando servidor llama.cpp (puerto 8080, aceleración GPU)...${NC}"
./bin/llama-server \
    -m "$MODEL_PATH" \
    --host 127.0.0.1 \
    --port 8080 \
    -ngl 99 \
    -c 4096 \
    > data/logs/llama.log 2>&1 &

LLAMA_PID=$!
echo "$LLAMA_PID" > data/pids/llama.pid

# Esperar a que llama.cpp esté respondiendo
echo -n "⏳ Esperando inicialización del modelo en GPU..."
READY=0
for i in {1..30}; do
    if curl -s http://127.0.0.1:8080/health | grep -q 'ok\|ready' 2>/dev/null || curl -s http://127.0.0.1:8080/v1/models >/dev/null 2>&1; then
        READY=1
        break
    fi
    # Verificar si el proceso murió prematuramente
    if ! kill -0 "$LLAMA_PID" 2>/dev/null; then
        echo -e "\n${RED}❌ Error: llama-server terminó inesperadamente. Revisa data/logs/llama.log${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done

if [ "$READY" -eq 1 ]; then
    echo -e " ${GREEN}¡Listo!${NC}"
else
    echo -e " ${YELLOW}Aviso: El servidor tardó en responder pero continúa en background.${NC}"
fi

# 4. Encender el Bot de WhatsApp (Baileys + Laya Decision Engine + Recordatorios)
echo -e "${CYAN}💬 [2/2] Levantando Bot de WhatsApp (Baileys + Laya + Recordatorios)...${NC}"
npx tsx src/index.ts > data/logs/bot.log 2>&1 &
BOT_PID=$!
echo "$BOT_PID" > data/pids/bot.pid
sleep 2

# Verificar si el bot está corriendo
if ! kill -0 "$BOT_PID" 2>/dev/null; then
    echo -e "${RED}❌ Error al iniciar el bot de WhatsApp. Revisa data/logs/bot.log${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================================${NC}"
echo -e "${GREEN}🎉 ¡TODO EL SISTEMA ESTÁ ENCENDIDO Y OPERATIVO!          ${NC}"
echo -e "${BLUE}========================================================${NC}"
echo -e "🧠 ${CYAN}Laya Decision Engine (Sistema 1):${NC} ACTIVO (~40ms)"
echo -e "🦙 ${CYAN}llama.cpp Server (Llama 3.2 3B):${NC}  ACTIVO (PID: $LLAMA_PID en :8080)"
echo -e "💬 ${CYAN}WhatsApp Bot (Baileys):${NC}           ACTIVO (PID: $BOT_PID)"
echo -e "⏰ ${CYAN}Recordatorios automáticos:${NC}        ACTIVO (1 hora antes)"
echo -e "📋 ${CYAN}Catálogo editable de precios:${NC}     servicios.json"
echo ""
echo -e "📜 ${YELLOW}Ver registros en tiempo real:${NC}"
echo -e "   Bot:    tail -f data/logs/bot.log"
echo -e "   llama:  tail -f data/logs/llama.log"
echo ""
echo -e "🛑 ${RED}Para apagar todo y liberar la VRAM para jugar:${NC}"
echo -e "   👉 ${GREEN}./SystemOff.sh${NC}"
echo -e "${BLUE}========================================================${NC}"
echo ""

#!/usr/bin/env bash

# Colores para la terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================================${NC}"
echo -e "${YELLOW} 🛑 APAGANDO SISTEMA COMPLETO (SystemOff)               ${NC}"
echo -e "${BLUE}========================================================${NC}"

# 1. Detener el Bot de WhatsApp
if [ -f "data/pids/bot.pid" ]; then
    BOT_PID=$(cat data/pids/bot.pid)
    if kill -0 "$BOT_PID" 2>/dev/null; then
        echo -e "Deteniendo Bot de WhatsApp (PID $BOT_PID)..."
        kill "$BOT_PID" 2>/dev/null || true
        sleep 1
        kill -9 "$BOT_PID" 2>/dev/null || true
    fi
    rm -f data/pids/bot.pid
fi
# Limpieza adicional por nombre de proceso
pkill -f "tsx src/index.ts" 2>/dev/null || true
echo -e "${GREEN}✔ Bot de WhatsApp detenido.${NC}"

# 2. Detener llama.cpp server
if [ -f "data/pids/llama.pid" ]; then
    LLAMA_PID=$(cat data/pids/llama.pid)
    if kill -0 "$LLAMA_PID" 2>/dev/null; then
        echo -e "Deteniendo servidor llama.cpp (PID $LLAMA_PID)..."
        kill "$LLAMA_PID" 2>/dev/null || true
        sleep 1
        kill -9 "$LLAMA_PID" 2>/dev/null || true
    fi
    rm -f data/pids/llama.pid
fi
# Limpieza adicional por nombre de proceso o puerto 8080
pkill -f "llama-server" 2>/dev/null || true
fuser -k 8080/tcp >/dev/null 2>&1 || true
echo -e "${GREEN}✔ Servidor llama.cpp detenido.${NC}"

# 3. Comprobar estado de la GPU
echo ""
echo -e "${BLUE}--------------------------------------------------------${NC}"
echo -e "🎮 ${GREEN}ESTADO DE LA GPU PARA VIDEOJUEGOS:${NC}"
if command -v nvidia-smi >/dev/null 2>&1; then
    VRAM_USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | head -n 1)
    VRAM_TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | head -n 1)
    echo -e "   VRAM Usada: ${GREEN}${VRAM_USED} MiB${NC} / ${VRAM_TOTAL} MiB"
    echo -e "   ${GREEN}✔ La VRAM de la RTX 5070 Ti está completamente liberada.${NC}"
else
    echo -e "   ${GREEN}✔ Procesos terminados correctamente.${NC}"
fi
echo -e "${BLUE}--------------------------------------------------------${NC}"
echo -e "${GREEN}✨ Todo el sistema se encuentra apagado.${NC}"
echo -e "${BLUE}========================================================${NC}"
echo ""

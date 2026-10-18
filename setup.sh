#!/usr/bin/env bash
set -e

# Colores para la terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE} 🚀 SETUP: BOT DE WHATSAPP + LAYA + LLAMA.CPP           ${NC}"
echo -e "${BLUE}========================================================${NC}"
echo ""

# 1. Crear directorios necesarios
echo -e "${YELLOW}[1/5] Preparando directorios del proyecto...${NC}"
mkdir -p bin models data/logs data/pids

# 2. Instalar dependencias de Node.js
echo -e "${YELLOW}[2/5] Instalando dependencias de Node.js y Laya Decision Engine...${NC}"
npm install

# 3. Descargar y verificar binario de llama.cpp (llama-server)
echo -e "${YELLOW}[3/5] Verificando servidor llama.cpp con aceleración CUDA (GPU RTX 5070 Ti)...${NC}"
if [ ! -f "bin/llama-server" ] || [ ! -d "bin/llama-b11706" ]; then
    echo "Descargando binario portátil de llama.cpp con CUDA 13.4..."
    curl -sL "https://github.com/ggml-org/llama.cpp/releases/download/b11706/llama-b11706-bin-ubuntu-cuda-13.4-x64.tar.gz" | tar -xz -C bin/
    cat << 'EOF' > bin/llama-server
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export LD_LIBRARY_PATH="/opt/cuda/lib64:$DIR/llama-b11706:$LD_LIBRARY_PATH"
exec "$DIR/llama-b11706/llama-server" "$@"
EOF
    chmod +x bin/llama-server
fi
echo -e "${GREEN}✔ llama-server (CUDA GPU) listo en ./bin/llama-server${NC}"

# 4. Descargar modelo Llama 3.2 3B Instruct (GGUF)
echo -e "${YELLOW}[4/5] Verificando modelo generativo Llama 3.2 3B (GGUF ~2.0 GB)...${NC}"
MODEL_PATH="models/Llama-3.2-3B-Instruct-Q4_K_M.gguf"
if [ ! -f "$MODEL_PATH" ]; then
    echo "Descargando Llama-3.2-3B-Instruct-Q4_K_M.gguf desde Hugging Face..."
    echo "(Este proceso se realiza una sola vez. Si se interrumpe, se reanudará automáticamente)."
    curl -C - -L --progress-bar \
        "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf" \
        -o "$MODEL_PATH"
fi
echo -e "${GREEN}✔ Modelo generativo listo en $MODEL_PATH${NC}"

# 5. Configurar .env
if [ ! -f ".env" ]; then
    cp .env.example .env
fi

echo ""
echo -e "${BLUE}========================================================${NC}"
echo -e "${GREEN}🎉 ¡INSTALACIÓN Y CONFIGURACIÓN COMPLETADA CON ÉXITO!    ${NC}"
echo -e "${BLUE}========================================================${NC}"
echo ""
echo -e "📝 ${YELLOW}CATÁLOGO Y PRECIOS:${NC}"
echo -e "   Puedes editar tratamientos, tiempos y precios en cualquier momento en:"
echo -e "   👉 ${GREEN}servicios.json${NC}"
echo ""
echo -e "📲 ${YELLOW}VINCULACIÓN CON WHATSAPP:${NC}"
read -p "¿Deseas vincular tu WhatsApp ahora escaneando el código QR? (s/n): " vincular

if [[ "$vincular" =~ ^[sS]$ ]]; then
    echo ""
    echo -e "${YELLOW}Iniciando generador de código QR...${NC}"
    echo "Abre WhatsApp en tu teléfono > Dispositivos vinculados > Vincular un dispositivo."
    echo "Una vez vinculado, presiona Ctrl+C para salir."
    echo ""
    npx tsx src/index.ts || true
fi

echo ""
echo -e "🚀 ${GREEN}¡TODO ESTÁ LISTO!${NC}"
echo -e "   Para encender el bot completo:  ${GREEN}./SystemOn.sh${NC}"
echo -e "   Para apagarlo y liberar la GPU: ${RED}./SystemOff.sh${NC}"
echo ""

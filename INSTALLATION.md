# Instalación detallada — projectNewPr (Entrada)

Requisitos previos (Raspberry Pi)
- Sistema: Debian/Raspbian/Ubuntu basado en Linux.
- Node.js LTS (recomendado >= 18). Instalar con `nvm` para facilidad.
- `git`, `curl`/`wget`.
- Habilitar interfaces de hardware si las usa: `i2c` y `serial` según sea necesario.

Preparación del sistema (pasos sugeridos)
1. Instalar nvm y Node.js LTS:
# 1) Dependencias (recomendado)
sudo apt-get update
sudo apt-get install -y curl ca-certificates git build-essential

# 2) Instalar NVM (elige una versión estable del instalador)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# 3) Cargar NVM en la terminal actual (sin cerrar sesión)

export NVM_DIR="$HOME/.config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
nvm -v

# 4) Verificar
nvm -v

# 5) Instalar Node (ejemplos)
nvm install 20
nvm use 20

# 6) Verificar Node/NPM
node -v
npm -v


2. Asegurar permisos de hardware (si usa GPIO/I2C/Serial):

```bash

sudo apt update && sudo apt install -y i2c-tools libusb-1.0-0-dev
# Añadir usuario (ej. pi) a grupos
sudo usermod -aG i2c,gpio,tty $USER

Clonar y preparar el proyecto

bash
# En la Raspberry
cd /home/pi/Desktop/coins
git clone <repo-url>  # o copia de la carpeta existente
cd projectNewPr
npm install
```

Configurar variables de entorno
- Copiar archivo de ejemplo y editar según tu entorno:

```bash
cp .env.example .env
# Editar .env: NEST_SERVER_URL, DEVICETYPE=IN, etc.
nano .env
```

Crear carpeta `config_files` y permisos (si no existe)

```bash
mkdir -p config_files
sudo usermod -aG i2c,gpio,tty $USER
```

Ejecutar en modo desarrollo

```bash
npm run dev
```

Modo kiosk

Para abrir Chromium en pantalla completa al iniciar el servidor, configura estas variables en `.env`:

```dotenv
KIOSK_MODE=true
KIOSK_URL=http://localhost:4000
```

El sistema debe tener instalado `chromium-browser` o `chromium`, y la sesion grafica debe estar disponible (`DISPLAY` y `XAUTHORITY`). Para desactivarlo, usa `KIOSK_MODE=false`.

Construir y ejecutar en producción

```bash
npm run build
npm start
```

Despliegue permanente (pm2)

```bash
npm install -g pm2
pm2 start dist/index.js --name projectNewPr
pm2 save
pm2 startup
```

Verificación local
- Asegúrate de que el hardware esté conectado correctamente. Luego revisa logs:

```bash
# Revisar logs de la aplicación
pm2 logs projectNewPr
```

Notas operativas
- Si el hardware está presente prueba `i2c-tools` para comprobar dispositivos I2C.

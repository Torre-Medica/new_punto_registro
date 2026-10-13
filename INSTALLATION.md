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

## Configuración local (`config_files/`) — NO se versiona

La carpeta `config_files/` (`devicesConfig.txt`, `dckConfig.txt`, `printerConfig.txt`, `uhfConfig.txt`) está en `.gitignore`: cada equipo conserva su propia configuración y un `git pull` no la toca. Si falta un archivo, el punto lo crea con valores por defecto al arrancar.

**Primer `git pull` en un equipo que aún versionaba `config_files/`:** el commit que los quita del repositorio hace que git los borre de la carpeta (o que el pull falle si fueron modificados). Hacer copia antes:

```bash
cp -r config_files config_files.bak
git pull
cp -r config_files.bak/. config_files/   # restaura la configuración real del equipo
```

Si se olvida la copia, se regeneran los valores por defecto (sin UHF, `LPR_AUTO_EXIT=false`, etc.) y hay que reconfigurar. Después de ese primer pull no vuelve a ocurrir.

## Salida automática por placa (`LPR_AUTO_EXIT`) — solo puntos de salida

En `config_files/devicesConfig.txt`:

```json
{
  "UHF_ANTENNA": true,
  "QR_SCANNER": true,
  "I2C_RELAY": false,
  "HASPRINTER": false,
  "DCK_RELAY": true,
  "PASSTHROUGHLPR": false,
  "LPR_AUTO_EXIT": true
}
```

- `LPR_AUTO_EXIT` (por defecto `false`) es independiente de `PASSTHROUGHLPR`, que no cambia. Debe ser el booleano `true` (no el texto `"true"`).
- Solo tiene efecto con `DEVICETYPE=OUT` en `.env`. En puntos `IN` se ignora.
- El punto lo informa al backend en el `auth` del socket **al conectarse**: tras cambiarlo hay que reiniciar (`pm2 restart projectNewPr`).
- El punto **no decide nada**: el backend lee la placa de la cámara de salida y, si el proceso puede salir, envía `openbarrier`. El punto activa el relé (I2C `OUT1` o DCK) y responde un ack `{opened:true|false}`. El backend solo cierra el proceso si recibe `opened:true` en 3 s.
- En el log aparece al iniciar: `LPR_AUTO_EXIT: true (DEVICETYPE=OUT)`.
- Si no hay relé configurado (ni I2C ni DCK), responde `opened:false` y el proceso no se cierra.
- Para apagarlo en un punto: `"LPR_AUTO_EXIT": false` y reiniciar.

Requiere que el backend tenga `LPR_AUTO_EXIT=true` y la cámara configurada (ver `docs/despliegue-lpr-salida-automatica.md` en `new-backend-nexo`).

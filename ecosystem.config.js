/**
 * Punto de registro (entrada) como app de PM2.
 * Compila con `npm run build` y ejecuta dist/index.js; lee el .env desde este cwd.
 * DISPLAY/XAUTHORITY permiten que KIOSK_MODE abra Chromium en la pantalla local.
 */
module.exports = {
  apps: [
    {
      name: 'punto-registro',
      script: 'dist/index.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        DISPLAY: ':0',
        XAUTHORITY: '/home/pi/.Xauthority',
      },
    },
  ],
};

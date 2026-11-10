// Catalogo de mensajes de la pantalla del punto de registro.
//
// Cada respuesta del servidor trae un codigo (statusCode) y el texto original
// (message). Primero se busca una regla por el texto (es mas especifico que el
// codigo: p. ej. "Pago pendiente" llega como ERROR), luego por el codigo.
//
//   title    -> titulo grande para el usuario
//   text     -> que debe hacer el usuario
//   operator -> explicacion corta para el operador (va en la franja inferior)
//   image    -> imagen propia del error en /img (ver ERROR_IMAGES); si no hay, icon
//   icon     -> recorte de una de las imagenes de /img (ver ICONS)
//   tone     -> ok | warn | error (color del titulo)
//   hold     -> la pantalla no vuelve sola al inicio (p. ej. servidor caido)
//
// Para ajustar un texto basta con editar este archivo; no hay que compilar.

// Recortes de iconos: size = tamaño real de la imagen, box = (x, y, ancho, alto)
const ICONS = {
  check: { src: "/img/ACCESS_GRANTED.png", size: [1024, 600], box: [390, 30, 240, 230] },
  cone: { src: "/img/ERROR.png", size: [1600, 1001], box: [670, 60, 260, 290] },
  clock: { src: "/img/INVALID_USER_TYPE.png", size: [1024, 768], box: [405, 40, 210, 190] },
  carP: { src: "/img/PROCESS_NOT_FOUND.png", size: [1024, 768], box: [410, 80, 250, 240] },
  server: { src: "/img/SERVER_ERROR.png", size: [1600, 1001], box: [630, 40, 340, 310] },
  denied: { src: "/img/USER_NOT_FOUND.png", size: [1024, 768], box: [350, 130, 320, 200] },
  noCar: { src: "/img/VEHICLE_TYPE_REQUIRED.png", size: [1280, 801], box: [540, 65, 225, 210] },
  warning: { src: "/img/ZONE_FULL.png", size: [1024, 768], box: [425, 40, 180, 170] },
  loading: { spinner: true },
};

// Imagenes de cada error (ya traen la explicacion para el operador)
const ERROR_IMAGES = {
  ingresoAbierto: "/img/01_ingreso_abierto_sin_salida.png",
  mensualidadVencida: "/img/02_mensualidad_vencida_o_sin_agendamiento.png",
  noRegistrado: "/img/03_qr_tarjeta_documento_no_registrado.png",
  tipoUsuario: "/img/04_tipo_de_usuario_no_valido.png",
  bloqueado: "/img/05_usuario_bloqueado.png",
  qrNoRegistrado: "/img/06_qr_no_registrado.png",
  zonaSinCupo: "/img/07_zona_sin_cupo.png",
  zonaPrivada: "/img/08_sin_permiso_zona_privada.png",
  convenio: "/img/09_convenio_de_alquiler_no_existe.png",
  sensor: "/img/10_sensor_no_detecta_vehiculo.png",
  datosIncompletos: "/img/11_datos_incompletos_en_lectura.png",
  impresora: "/img/12_fallo_de_impresora.png",
  sinConexion: "/img/13_sin_conexion_servidor.png",
  malConfigurado: "/img/14_punto_registro_mal_configurado.png",
  faltanZonas: "/img/15_faltan_zonas_o_servicios.png",
  noReconocida: "/img/16_respuesta_no_reconocida.png",
};

// Nombre del parqueadero que aparece en la bienvenida y en la pantalla de espera
const PARKING_NAME = "Torre Médica";

const ASSIST = "Solicita asistencia de un operador";
const VISITOR = "Oprime el botón para ingresar como visitante o solicita asistencia de un operador";

const vehicleWord = (detail) => (/moto/i.test(detail) ? "motos" : "carros");

// Reglas por texto del servidor (se comparan sin tildes ni mayusculas)
const DETAIL_RULES = [
  // --- Accesos concedidos ---
  {
    match: /ingreso con maestra/,
    message: { title: `¡Bienvenido a ${PARKING_NAME}!`, text: "Puedes avanzar", operator: "Acceso con llave maestra", icon: "check", tone: "ok" },
  },
  {
    match: /salida reciente/,
    message: { title: "Puedes salir", text: "La talanquera se abre de nuevo", operator: "Reapertura: la salida ya se había registrado hace poco", icon: "check", tone: "ok" },
  },
  {
    match: /lista blanca/,
    message: { title: `¡Bienvenido a ${PARKING_NAME}!`, text: "Puedes avanzar", operator: "Documento en lista blanca", icon: "check", tone: "ok" },
  },
  {
    match: /tiempo de gracia/,
    message: { title: "¡Gracias por tu visita!", text: "Puedes salir sin costo", operator: "Salida dentro del tiempo de gracia", icon: "check", tone: "ok" },
  },
  {
    match: /tiempo de salida activo/,
    message: { title: "¡Gracias por tu visita!", text: "Pago confirmado, puedes salir", operator: "Pago realizado; salida dentro del tiempo permitido", icon: "check", tone: "ok" },
  },
  {
    match: /salida privada validada/,
    message: { title: "Puedes continuar", text: "Salida de la zona privada registrada", operator: "Salida de zona privada validada", icon: "check", tone: "ok" },
  },
  {
    match: /salida por placa/,
    message: { title: "¡Gracias por tu visita!", text: "Puedes salir. ¡Buen viaje!", operator: "Salida automática por lectura de placa", icon: "check", tone: "ok" },
  },

  // --- Pagos ---
  {
    match: /no ingreso a la zona privada/,
    message: {
      title: "Tienes un pago pendiente",
      text: "No ingresaste a la zona privada, así que tu estadía se cobra como visitante. Paga en el punto de pago y vuelve a escanear",
      operator: "No pasó por la zona privada: se cobra como público",
      icon: "warning",
      tone: "warn",
    },
  },
  {
    match: /pago pendiente/,
    message: {
      title: "Tienes un pago pendiente",
      text: "Paga en el punto de pago y vuelve a escanear tu tiquete",
      operator: "Intento de salida sin pago registrado",
      icon: "warning",
      tone: "warn",
    },
  },

  // --- Procesos de ingreso / salida ---
  {
    match: /tiene un proceso de salida pendiente/,
    message: {
      title: "Ya tienes un ingreso activo",
      text: "Este QR o tarjeta tiene una entrada sin salida. " + ASSIST,
      operator: "Ingreso abierto sin salida: cerrar el proceso anterior en Control de acceso",
      icon: "carP", image: ERROR_IMAGES.ingresoAbierto,
      tone: "warn",
    },
  },
  {
    match: /proceso cerrado|qr ya fue utilizado/,
    message: { title: "Este tiquete ya fue usado", text: ASSIST, operator: "El proceso de este QR ya está cerrado (salida registrada)", icon: "denied", tone: "error" },
  },
  {
    match: /proceso no encontrado|no hay un proceso de entrada valido|income not found|no tiene ingreso asociado/,
    message: { title: "No encontramos tu ingreso", text: ASSIST, operator: "No hay un ingreso activo para este QR o tarjeta", icon: "cone", tone: "error" },
  },
  {
    match: /proceso no valido|status de proceso no valido|proceso sin fecha de inicio/,
    message: { title: "No pudimos validar tu tiquete", text: ASSIST, operator: "El proceso está en un estado no válido", icon: "cone", tone: "error" },
  },
  {
    match: /proceso sin paso por privado|proceso sin salida de privado/,
    message: { title: "No pudimos validar tu salida", text: ASSIST, operator: "Recorrido por la zona privada incompleto", icon: "cone", tone: "error" },
  },

  // --- Identificacion ---
  {
    match: /codigo qr invalido|qr no encontrado/,
    message: {
      title: "Código QR no válido",
      text: "Verifica que sea el tiquete de este parqueadero o solicita asistencia de un operador",
      operator: "El QR no está registrado en el sistema",
      image: ERROR_IMAGES.qrNoRegistrado,
      icon: "denied",
      tone: "error",
    },
  },
  {
    match: /usuario esta bloqueado/,
    message: { title: "Acceso no permitido", text: "Comunícate con la administración del parqueadero", operator: "Usuario bloqueado (lista negra)", image: ERROR_IMAGES.bloqueado, icon: "denied", tone: "error" },
  },
  {
    match: /no se encontro (el usuario )?en la base de datos/,
    message: { title: "Acceso no autorizado", text: VISITOR, operator: "QR, tarjeta o documento no registrado", image: ERROR_IMAGES.noRegistrado, icon: "denied", tone: "error" },
  },
  {
    match: /no posee un agendamiento valido/,
    message: { title: "Mensualidad o agendamiento vencido", text: VISITOR, operator: "La mensualidad está vencida o no hay agendamiento para hoy", image: ERROR_IMAGES.mensualidadVencida, icon: "clock", tone: "warn" },
  },
  {
    match: /tipo de usuario valido/,
    message: { title: "Acceso no autorizado", text: VISITOR, operator: "El usuario no tiene un tipo de usuario válido", image: ERROR_IMAGES.tipoUsuario, icon: "denied", tone: "error" },
  },
  {
    match: /identificador no valido para ingreso en privado/,
    message: { title: "No tienes acceso a esta zona", text: ASSIST, operator: "Identificación sin permiso para ingresar a la zona privada", image: ERROR_IMAGES.zonaPrivada, icon: "denied", tone: "error" },
  },
  {
    match: /identificador no valido para salida privada/,
    message: { title: "No pudimos registrar tu salida de esta zona", text: ASSIST, operator: "Identificación no válida para la salida de la zona privada", icon: "denied", tone: "error" },
  },
  {
    match: /convenio rental no encontrado/,
    message: { title: "Convenio no encontrado", text: ASSIST, operator: "El convenio de alquiler asociado no existe", image: ERROR_IMAGES.convenio, icon: "denied", tone: "error" },
  },

  // --- Cupo ---
  {
    match: /esta llena para|no hay cupo/,
    message: (detail) => ({
      title: `No hay celdas para ${vehicleWord(detail)}`,
      text: VISITOR,
      operator: "Zona sin cupo",
      image: ERROR_IMAGES.zonaSinCupo,
      icon: "warning",
      tone: "warn",
    }),
  },

  // --- Sensores y datos ---
  {
    match: /tipo de vehiculo/,
    message: {
      title: "Vehículo no detectado",
      text: "Ubica tu vehículo frente a la talanquera, sobre el sensor, o solicita asistencia de un operador",
      operator: "El sensor no detectó carro ni moto",
      image: ERROR_IMAGES.sensor,
      icon: "noCar",
      tone: "warn",
    },
  },
  {
    match: /faltan campos requeridos|falta el numero|plate is required|identificationid is required/,
    message: { title: "No pudimos leer tus datos", text: "Intenta de nuevo o solicita asistencia de un operador", operator: "Faltan datos en la lectura (placa o identificación)", image: ERROR_IMAGES.datosIncompletos, icon: "cone", tone: "error" },
  },

  // --- Configuracion ---
  {
    match: /devicestype no encontrado/,
    message: { title: "Punto fuera de servicio", text: ASSIST, operator: "Punto de registro mal configurado: revisar si es de entrada o salida", image: ERROR_IMAGES.malConfigurado, icon: "cone", tone: "error" },
  },
  {
    match: /zona .*no encontrada|zone not found|servicio no encontrado/,
    message: { title: "Punto fuera de servicio", text: ASSIST, operator: "Faltan zonas o servicios configurados en el servidor", image: ERROR_IMAGES.faltanZonas, icon: "cone", tone: "error" },
  },
];

// Pantalla de espera (sin lecturas en curso), segun el tipo de punto
const IDLE_MESSAGES = {
  IN: {
    title: `Bienvenido a ${PARKING_NAME}`,
    text: "Oprime el botón para recibir tu tiquete de ingreso",
    hint: "Si tienes mensualidad, acerca tu tarjeta o código QR al lector",
  },
  OUT: {
    title: "Salida del parqueadero",
    text: "Acerca tu tiquete o código QR al lector",
    hint: "Recuerda pagar en el punto de pago antes de salir",
  },
};

// Textos del servidor que llegan en ingles
const SERVER_TEXT_ES = [
  [/^income not found$/i, "Ingreso no encontrado"],
  [/^plate is required$/i, "Falta la placa"],
  [/^identificationid is required$/i, "Falta el número de identificación"],
  [/^zone not found$/i, "Zona no encontrada"],
  [/^not found$/i, "No encontrado"],
];

const serverTextInSpanish = (text) => {
  const clean = String(text || "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
  const found = SERVER_TEXT_ES.find(([pattern]) => pattern.test(clean));
  return found ? found[1] : clean;
};

// Respuesta por codigo cuando el texto no coincide con ninguna regla
const CODE_MESSAGES = {
  ACCESS_GRANTED: ({ deviceType, ticketPrinted }) =>
    ticketPrinted
      ? { title: `¡Bienvenido a ${PARKING_NAME}!`, text: "Retira tu tiquete y consérvalo para pagar antes de salir", operator: "Ingreso registrado, tiquete impreso", icon: "check", tone: "ok" }
      : deviceType === "IN"
        ? { title: `¡Bienvenido a ${PARKING_NAME}!`, text: "Puedes avanzar", operator: "Ingreso registrado", icon: "check", tone: "ok" }
        : { title: `¡Gracias por visitar ${PARKING_NAME}!`, text: "Puedes salir. ¡Buen viaje!", operator: "Salida registrada", icon: "check", tone: "ok" },
  PRINTING: { title: "Imprimiendo tu tiquete…", text: "Espera un momento", operator: "Ingreso registrado, enviando a la impresora", icon: "loading", tone: "ok" },
  PRINTER_ERROR: { title: "No pudimos imprimir tu tiquete", text: ASSIST, operator: "Falló la impresora: revisar papel y conexión", image: ERROR_IMAGES.impresora, icon: "cone", tone: "error" },
  USER_BLACKLISTED: { title: "Acceso no permitido", text: "Comunícate con la administración del parqueadero", operator: "Usuario bloqueado (lista negra)", image: ERROR_IMAGES.bloqueado, icon: "denied", tone: "error" },
  PROCESS_NOT_FOUND: { title: "No encontramos tu ingreso", text: ASSIST, operator: "No hay un proceso activo para esta lectura", icon: "cone", tone: "error" },
  INVALID_USER_TYPE: { title: "Mensualidad o agendamiento vencido", text: VISITOR, operator: "La mensualidad está vencida o no hay agendamiento para hoy", image: ERROR_IMAGES.mensualidadVencida, icon: "clock", tone: "warn" },
  ZONE_FULL: { title: "No hay celdas disponibles", text: VISITOR, operator: "Zona sin cupo", image: ERROR_IMAGES.zonaSinCupo, icon: "warning", tone: "warn" },
  USER_NOT_FOUND: { title: "Acceso no autorizado", text: VISITOR, operator: "QR, tarjeta o documento no registrado", image: ERROR_IMAGES.noRegistrado, icon: "denied", tone: "error" },
  VEHICLE_TYPE_REQUIRED: { title: "Vehículo no detectado", text: "Ubica tu vehículo frente a la talanquera o solicita asistencia de un operador", operator: "El sensor no detectó carro ni moto", image: ERROR_IMAGES.sensor, icon: "noCar", tone: "warn" },
  INVALID_PRIVATE_ENTRY_ID: { title: "No tienes acceso a esta zona", text: ASSIST, operator: "Identificación sin permiso para la zona privada", image: ERROR_IMAGES.zonaPrivada, icon: "denied", tone: "error" },
  INVALID_PRIVATE_EXIT_ID: { title: "No pudimos registrar tu salida de esta zona", text: ASSIST, operator: "Identificación no válida para la salida privada", icon: "denied", tone: "error" },
  INVALID_QR_CODE: { title: "Código QR no válido", text: "Verifica que sea el tiquete de este parqueadero o solicita asistencia de un operador", operator: "El QR no está registrado en el sistema", image: ERROR_IMAGES.qrNoRegistrado, icon: "denied", tone: "error" },
  UNKNOWN_DEVICE_TYPE: { title: "Punto fuera de servicio", text: ASSIST, operator: "Punto de registro mal configurado: revisar si es de entrada o salida", image: ERROR_IMAGES.malConfigurado, icon: "cone", tone: "error" },
  NO_OUTCOME_GENERATED: { title: "No pudimos registrar tu salida", text: ASSIST, operator: "El servidor no generó el registro de salida", icon: "cone", tone: "error" },
  SERVER_ERROR: { title: "Servidor fuera de servicio", text: ASSIST, operator: "Sin conexión con el servidor: revisar red o servidor central", image: ERROR_IMAGES.sinConexion, icon: "server", tone: "error", hold: true },
  ERROR: { title: "Ha ocurrido un problema", text: ASSIST, operator: "Respuesta no reconocida del servidor", image: ERROR_IMAGES.noReconocida, icon: "cone", tone: "error" },
};

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Devuelve el mensaje a mostrar para una respuesta del servidor
function resolveScreenMessage(payload) {
  const { statusCode, message } = payload || {};
  const detail = normalize(message);
  const granted = statusCode === "ACCESS_GRANTED";

  if (detail && statusCode !== "SERVER_ERROR" && statusCode !== "PRINTER_ERROR" && statusCode !== "PRINTING") {
    const rule = DETAIL_RULES.find((item) => item.match.test(detail));
    // Un acceso concedido nunca debe mostrar un texto de error y viceversa
    if (rule) {
      const found = typeof rule.message === "function" ? rule.message(detail) : rule.message;
      if ((found.tone === "ok") === granted) return found;
    }
  }

  const byCode = CODE_MESSAGES[statusCode] || CODE_MESSAGES.ERROR;
  return typeof byCode === "function" ? byCode(payload || {}) : byCode;
}

window.ICONS = ICONS;
window.ERROR_IMAGES = ERROR_IMAGES;
window.IDLE_MESSAGES = IDLE_MESSAGES;
window.serverTextInSpanish = serverTextInSpanish;
window.resolveScreenMessage = resolveScreenMessage;

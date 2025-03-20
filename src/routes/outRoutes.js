// src/routes/outRoutes.js
/**
 * Rutas para la API externa
 * Este archivo define todos los endpoints de la API que pueden ser consumidos por clientes externos.
 * Incluye autenticación, gestión de maquinarias, faenas y configuración del sistema.
 */
const express = require("express");
const router = express.Router();
const outController = require("../controllers/outController");
const apiAuthMiddleware = require("../middlewares/apiAuthMiddleware");
const apiValidationMiddleware = require("../middlewares/apiValidationMiddleware");

// ====================================================================
// Endpoints de Autenticación (sin autenticación)
// ====================================================================

/**
 * @route POST /api/out/login
 * @description Autentica a un usuario y devuelve un token JWT
 * @access Público
 * @body {String} email - Correo electrónico del usuario
 * @body {String} password - Contraseña del usuario
 * @returns {Object} Token JWT y datos del usuario
 */
router.post(
  "/login",
  apiValidationMiddleware.validateLogin,
  outController.login
);

/**
 *
 * * Proceso:
 * 1. Se autentica al usuario que realiza la petición con el middleware de autenticación
 * 2. Se verifica que el usuario autenticado tenga el permiso de editor
 * 3. Se valida que los datos del nuevo usuario sean correctos (email, nombre, contraseña, roles)
 * 4. Se crea el nuevo usuario en la base de datos
 * 5. Se devuelve el token JWT y los datos del nuevo usuario
 *
 *
 * @route POST /api/out/crear_usuarios
 * @description Crea un nuevo usuario en el sistema
 * @access Privado (solo editor)
 * @body {String} email - Correo electrónico del nuevo usuario
 * @body {String} name - Nombre y apellido del nuevo usuario
 * @body {String} password - Contraseña para el nuevo usuario
 * @body {String} roles - Roles del nuevo usuario (separados por comas, e.g. "editor,admin")
 * @returns {Object} Token JWT y datos del nuevo usuario
 */
router.post(
  "/crear_usuarios",
  apiAuthMiddleware.authenticate.bind(apiAuthMiddleware),
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateUsuario,
  outController.crearUsuario
);

/**
 * @route POST /api/out/request-password-reset
 * @description Solicita un token de reseteo de contraseña que será enviado por email
 * @access Público
 * @body {String} email - Correo electrónico del usuario
 * @returns {Object} Confirmación de procesamiento de la solicitud
 */
router.post(
  "/request-password-reset",
  apiValidationMiddleware.validateEmail,
  outController.solicitarResetPassword
);

/**
 * @route POST /api/out/reset-password
 * @description Aplica el cambio de contraseña utilizando el token recibido vía email
 * @access Público
 * @body {String} token - Token de reseteo recibido por email
 * @body {String} password - Nueva contraseña
 * @returns {Object} Confirmación de cambio de contraseña
 */
router.post(
  "/reset-password",
  apiValidationMiddleware.validateTokenAndPassword,
  outController.confirmarResetPassword
);

// ====================================================================
// Middleware de Autenticación (aplicado a todas las rutas siguientes)
// ====================================================================
router.use(apiAuthMiddleware.authenticate.bind(apiAuthMiddleware));

// ====================================================================
// Módulo de listado de maquinarias en tiempo real
// ====================================================================

/**
 * @route GET /api/out/maquinas
 * @description Obtiene un listado de todas las maquinarias y su estado actual
 * @access Privado
 * @query {Number} [id_cliente] - Filtra las maquinarias por cliente (opcional)
 * @returns {Object} Lista de maquinarias con su estado (activa/inactiva)
 */
router.get("/maquinas", outController.obtenerMaquinas);

/**
 * @route GET /api/out/maquinas/realtime
 * @description Obtiene datos en tiempo real (últimos 5 minutos) de máquinas con faenas activas
 * @access Privado
 * @query {String} [identificador_externo] - Identificador externo de la máquina (opcional)
 * @returns {Object} Datos en tiempo real para las máquinas solicitadas
 */
router.get(
  "/maquinas/realtime",
  apiValidationMiddleware.validateRealtimeQuery,
  outController.obtenerDatosRealtime
);

/**
 * @route GET /api/out/maquinas/historico
 * @description Busca información histórica para una maquinaria con filtros opcionales
 * @access Privado
 * @query {String} identificador_externo - Identificador externo de la maquinaria (obligatorio)
 * @query {Number} [fecha_inicio] - Timestamp UNIX en milisegundos para inicio del período (opcional)
 * @query {Number} [fecha_fin] - Timestamp UNIX en milisegundos para fin del período (opcional)
 * @query {Number} [id_faena] - ID de faena específica (opcional)
 * @returns {Object} Datos históricos de la maquinaria con información para gráficos
 * @notes Si no se proporcionan fechas, devuelve datos de los últimos 3 meses.
 *        Si solo se proporciona fecha_inicio, devuelve datos desde esa fecha hasta 3 meses después o la fecha actual.
 *        Si solo se proporciona fecha_fin, devuelve datos de los 3 meses anteriores a esa fecha.
 *        La diferencia entre fecha_inicio y fecha_fin no puede ser mayor a 3 meses.
 */
router.get(
  "/maquinas/historico",
  apiValidationMiddleware.validateHistoricoConsolidado,
  outController.obtenerHistoricoConsolidado
);

/**
 * @route GET /api/out/maquinas/:id
 * @description Obtiene información detallada de una maquinaria específica
 * @access Privado
 * @param {Number} id - ID de la maquinaria
 * @returns {Object} Detalles de la maquinaria, incluyendo equipo asociado y faena activa
 */
router.get(
  "/maquinas/:id",
  apiValidationMiddleware.validateMaquinaId,
  outController.obtenerMaquinaDetalle
);

/**
 * @route GET /api/out/maquinas/:id/status
 * @description Obtiene el estado actual de una maquinaria (semáforo, temperatura, etc.)
 * @access Privado
 * @param {Number} id - ID de la maquinaria
 * @returns {Object} Estado actual de la maquinaria, incluyendo semáforo y última lectura
 */
router.get(
  "/maquinas/:id/status",
  apiValidationMiddleware.validateMaquinaId,
  outController.obtenerMaquinaStatus
);

/**
 * @route PUT /api/out/maquinas/:id
 * @description Actualiza información de una maquinaria (identificador_externo o equipo asociado)
 * @access Privado (solo editor)
 * @param {Number} id - ID de la maquinaria
 * @body {String} [identificador_externo] - Nuevo identificador externo
 * @body {Number} [id_equipo] - Nuevo ID de equipo a asociar
 * @returns {Object} Confirmación de actualización y datos modificados
 */
router.put(
  "/maquinas/:id",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateMaquinaUpdate,
  outController.actualizarMaquina
);

// ====================================================================
// Módulo de Faenas
// ====================================================================

/**
 * @route GET /api/out/faenas
 * @description Obtiene el listado de faenas dentro de un rango de fechas específico
 * @access Privado
 * @query {Number} fecha_inicio - Timestamp en milisegundos para inicio del período (obligatorio)
 * @query {Number} fecha_fin - Timestamp en milisegundos para fin del período (obligatorio)
 * @query {Number} [id_cliente] - Filtra por cliente (opcional)
 * @query {String} [estado] - Filtra por estado ("ACTIVA" o "FINALIZADA", opcional)
 * @returns {Object} Lista de faenas que cumplen con los filtros
 * @notes La diferencia entre fecha_inicio y fecha_fin no puede ser mayor a 3 meses.
 */
router.get(
  "/faenas",
  apiValidationMiddleware.validateFaenasTimestamp,
  outController.obtenerFaenas
);

/**
 * @route GET /api/out/faenas/datos
 * @description Obtiene los datos de una faena identificada por su ID externo
 * @access Privado
 * @query {String} id_Faena_externo - Identificador externo de la faena
 * @returns {Object} Todos los datos asociados a la faena
 */
router.get(
  "/faenas/datos",
  apiValidationMiddleware.validateFaenaExterna,
  outController.obtenerDatosPorFaenaExterna
);

/**
 * @route GET /api/out/faenas/resumen
 * @description Obtiene el resumen de una faena identificada por su ID externo
 * @access Privado
 * @query {String} id_Faena_externo - Identificador externo de la faena
 * @returns {Object} Resumen de datos por tramos (5 segmentos del 20%)
 */
router.get(
  "/faenas/resumen",
  apiValidationMiddleware.validateFaenaExterna,
  outController.obtenerResumenPorFaenaExterna
);

/**
 * @route GET /api/out/faenas/:id
 * @description Obtiene información detallada de una faena específica
 * @access Privado
 * @param {Number} id - ID de la faena
 * @returns {Object} Detalles completos de la faena
 */
router.get(
  "/faenas/:id",
  apiValidationMiddleware.validateFaenaId,
  outController.obtenerFaenaDetalle
);

/**
 * @route PUT /api/out/faenas/:id_externo
 * @description Actualiza información de una faena usando su identificador externo
 * @access Privado (solo editor)
 * @param {String} id_externo - Identificador externo de la faena
 * @body {String} [id_Faena_externo] - Nuevo identificador externo de la faena
 * @body {Number} [id_cliente] - Nuevo ID de cliente (opcional)
 * @returns {Object} Confirmación de actualización y datos modificados
 */
router.put(
  "/faenas/:id_externo",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateFaenaExternoUpdate, // Necesitaremos crear este validador
  outController.actualizarFaenaByExterno
);
/**
 * @route GET /api/out/faenas/:id/export
 * @description Exporta los datos de una faena en formato CSV
 * @access Privado
 * @param {Number} id - ID de la faena
 * @returns {File} Archivo CSV con los datos de la faena
 */
router.get(
  "/faenas/:id/export",
  apiValidationMiddleware.validateFaenaId,
  outController.exportarDatosFaena
);
// ====================================================================
// Módulo de administración (solo para usuarios con permiso de editor)
// ====================================================================

/**
 * @route GET /api/out/configuracion
 * @description Obtiene la configuración general del sistema
 * @access Privado
 * @returns {Object} Configuración actual del sistema
 */
router.get("/configuracion", outController.obtenerConfiguracion);

/**
 * @route PUT /api/out/configuracion
 * @description Actualiza parámetros de configuración del sistema
 * @access Privado (solo editor)
 * @body {Object} parámetros - Objeto con parámetros a actualizar {id: {valor: nuevoValor}}
 * @returns {Object} Confirmación de actualización
 */
router.put(
  "/configuracion",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateConfiguracion,
  outController.actualizarConfiguracion
);

module.exports = router;

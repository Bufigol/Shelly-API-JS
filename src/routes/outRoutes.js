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
 * @route POST /api/out/usuarios
 * @description Crea un nuevo usuario en el sistema
 * @access Público
 * @body {String} email - Correo electrónico del usuario
 * @body {String} password - Contraseña del usuario
 * @returns {Object} Datos del usuario creado
 */
router.post(
  "/usuarios",
  apiValidationMiddleware.validateUsuario,
  outController.crearUsuario
);

/**
 * @route POST /api/out/reset-password
 * @description Solicita un reseteo de contraseña enviando un email con un token
 * @access Público
 * @body {String} email - Correo electrónico del usuario
 * @returns {Object} Confirmación de envío de email
 */
router.post(
  "/reset-password",
  apiValidationMiddleware.validateEmail,
  outController.solicitarResetPassword
);

/**
 * @route POST /api/out/reset-password/:token
 * @description Confirma un reseteo de contraseña utilizando el token recibido
 * @access Público
 * @param {String} token - Token de reseteo
 * @body {String} password - Nueva contraseña
 * @body {String} confirmPassword - Confirmación de la nueva contraseña
 * @returns {Object} Confirmación de cambio de contraseña
 */
router.post(
  "/reset-password/:token",
  apiValidationMiddleware.validateNewPassword,
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

/**
 * @route GET /api/out/maquinas/historico
 * @description Busca información histórica para una maquinaria con filtros opcionales
 * @access Privado
 * @query {String} identificador_externo - Identificador externo de la maquinaria (obligatorio)
 * @query {String} [fecha_inicio] - Fecha de inicio del período (ISO8601, opcional)
 * @query {String} [fecha_fin] - Fecha de fin del período (ISO8601, opcional)
 * @query {Number} [id_faena] - ID de faena específica (opcional)
 * @returns {Object} Datos históricos de la maquinaria con información para gráficos
 */
router.get(
  "/maquinas/historico",
  apiValidationMiddleware.validateHistoricoConsolidado,
  outController.obtenerHistoricoConsolidado
);

// ====================================================================
// Módulo de Faenas
// ====================================================================

/**
 * @route GET /api/out/faenas
 * @description Obtiene el listado de faenas con filtros opcionales
 * @access Privado
 * @query {Number} [id_cliente] - Filtra por cliente (opcional)
 * @query {String} [estado] - Filtra por estado ("ACTIVA" o "FINALIZADA", opcional)
 * @query {String} [fecha_inicio] - Filtra por fecha de inicio mínima (ISO8601, opcional)
 * @query {String} [fecha_fin] - Filtra por fecha de inicio máxima (ISO8601, opcional)
 * @returns {Object} Lista de faenas que cumplen con los filtros
 */
router.get("/faenas", outController.obtenerFaenas);

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
 * @route POST /api/out/faenas
 * @description Crea una nueva faena asociada a una maquinaria
 * @access Privado (solo editor)
 * @body {Number} id_maquina - ID de la maquinaria
 * @body {String} [nombre_faena] - Nombre de la faena (opcional)
 * @body {String} [fecha_inicio] - Fecha de inicio de la faena (ISO8601, opcional)
 * @body {Number} [id_cliente] - ID del cliente (opcional)
 * @returns {Object} Datos de la faena creada
 */
router.post(
  "/faenas",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateFaenaCreate,
  outController.crearFaena
);

/**
 * @route PUT /api/out/faenas/:id
 * @description Actualiza información de una faena (id_Faena_externo, fecha_fin, etc.)
 * @access Privado (solo editor)
 * @param {Number} id - ID de la faena
 * @body {String} [id_Faena_externo] - Nuevo identificador externo de la faena
 * @body {String} [fecha_fin] - Fecha de finalización de la faena (ISO8601, opcional)
 * @body {Number} [id_cliente] - Nuevo ID de cliente (opcional)
 * @returns {Object} Confirmación de actualización y datos modificados
 */
router.put(
  "/faenas/:id",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateFaenaUpdate,
  outController.actualizarFaena
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

/**
 * @route POST /api/out/equipos/asociar
 * @description Asocia un equipo con una maquinaria (compatibilidad con versión anterior)
 * @access Privado (solo editor)
 * @body {Number} id_equipo - ID del equipo a asociar
 * @body {String} identificador_externo - Identificador externo para la maquinaria
 * @returns {Object} Confirmación de asociación
 */
router.post(
  "/equipos/asociar",
  apiAuthMiddleware.checkPermissions(["editor"]),
  apiValidationMiddleware.validateAsociarEquipo,
  outController.asociarEquipoMaquina
);

module.exports = router;

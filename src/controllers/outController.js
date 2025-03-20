// src/controllers/outController.js
const authService = require("../services/out/authService");
const equipoService = require("../services/out/equipoService");
const faenaService = require("../services/out/faenaService");
const configService = require("../services/out/configService");
const maquinaService = require("../services/out/maquinaService");
const { ValidationError, NotFoundError } = require("../utils/errors");

// Funciones de utilidad para respuestas estándar
const sendSuccessResponse = (res, data, message = null, statusCode = 200) => {
  const response = {
    success: true,
    timestamp: new Date(),
  };

  if (data) response.data = data;
  if (message) response.message = message;

  res.status(statusCode).json(response);
};

const sendErrorResponse = (
  res,
  error,
  defaultMessage = "Error en el servidor"
) => {
  console.error(`Error en outController: ${error.message}`, error);

  // Determinar código de error y mensaje apropiados
  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  } else if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  res.status(500).json({
    success: false,
    message: defaultMessage,
    error: error.message,
  });
};

// ====================================================================
// AUTENTICACIÓN
// ====================================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
      });
    }

    return res.json({
      success: true,
      token: result.token,
      userId: result.userId,
      email: result.email,
      permissions: result.permissions,
    });
  } catch (error) {
    sendErrorResponse(res, error, "Error durante la autenticación");
  }
};

exports.crearUsuario = async (req, res) => {
  try {
    const { email, password, asignarEditor } = req.body;
    const idUsuarioCreador = req.user.id_Usuario; // Obtenemos el ID del usuario que está creando

    // Llamamos al servicio para crear el usuario con los parámetros adicionales
    const result = await authService.crearUsuario(
      email,
      password,
      asignarEditor,
      idUsuarioCreador
    );

    sendSuccessResponse(
      res,
      { id_Usuario: result.userId, permisos: result.permisos },
      "Usuario creado exitosamente",
      201
    );
  } catch (error) {
    sendErrorResponse(res, error, "Error al crear usuario");
  }
};

exports.solicitarResetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    await authService.solicitarResetPassword(email);

    sendSuccessResponse(
      res,
      null,
      "Si el correo existe, se ha enviado un token para resetear la contraseña. " +
        "Verifique su bandeja de entrada y use el token recibido junto a la nueva contraseña en el endpoint de reseteo."
    );
  } catch (error) {
    sendErrorResponse(res, error, "Error al solicitar reseteo de contraseña");
  }
};

exports.confirmarResetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const result = await authService.confirmarResetPassword(token, password);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        code: "INVALID_TOKEN",
      });
    }

    sendSuccessResponse(res, null, "Contraseña actualizada exitosamente");
  } catch (error) {
    sendErrorResponse(res, error, "Error al confirmar reseteo de contraseña");
  }
};

// ====================================================================
// EQUIPOS
// ====================================================================
exports.obtenerEquipos = async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const equipos = await equipoService.obtenerEquipos(id_cliente);
    sendSuccessResponse(res, equipos);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener equipos");
  }
};

exports.obtenerEquipoDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const equipo = await equipoService.obtenerEquipoDetalle(id);

    if (!equipo) {
      return res.status(404).json({
        success: false,
        message: "Equipo no encontrado",
      });
    }

    sendSuccessResponse(res, equipo);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener detalle del equipo");
  }
};

exports.obtenerEquipoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await equipoService.obtenerEquipoStatus(id);

    if (!status.exists) {
      return res.status(404).json({
        success: false,
        message: "Equipo no encontrado",
      });
    }

    sendSuccessResponse(res, status);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener status del equipo");
  }
};

exports.asociarEquipoMaquina = async (req, res) => {
  try {
    const { id_equipo, identificador_externo } = req.body;
    const result = await equipoService.asociarEquipoMaquina(
      id_equipo,
      identificador_externo
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    sendSuccessResponse(
      res,
      { id_Maquina: result.id_Maquina },
      result.message,
      201
    );
  } catch (error) {
    sendErrorResponse(res, error, "Error al asociar equipo");
  }
};

// ====================================================================
// MÁQUINAS
// ====================================================================
exports.obtenerMaquinas = async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const maquinas = await maquinaService.obtenerMaquinas(id_cliente);
    sendSuccessResponse(res, maquinas);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener máquinas");
  }
};

exports.obtenerDatosRealtime = async (req, res) => {
  try {
    const { identificador_externo } = req.query;
    const datos = await maquinaService.obtenerDatosRealtime(
      identificador_externo
    );
    res.json(datos);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener datos en tiempo real");
  }
};

// Modificación en outController.js - Reemplazar la función obtenerHistoricoConsolidado

exports.obtenerHistoricoConsolidado = async (req, res) => {
  try {
    const { identificador_externo, fecha_inicio, fecha_fin, id_faena } =
      req.query;

    // Si no se proporcionan ambas fechas, calcular fechas según las reglas especificadas
    let inicioEfectivo = null;
    let finEfectivo = null;
    const TRES_MESES_MS = 3 * 30 * 24 * 60 * 60 * 1000; // Aproximadamente 3 meses en milisegundos
    const ahora = Date.now();

    if (fecha_inicio && fecha_fin) {
      // Ambas fechas proporcionadas - usar directamente después de convertir a Number
      inicioEfectivo = parseInt(fecha_inicio, 10);
      finEfectivo = parseInt(fecha_fin, 10);
    } else if (fecha_inicio && !fecha_fin) {
      // Solo fecha de inicio - obtener desde esa fecha hasta 3 meses después o fecha actual
      inicioEfectivo = parseInt(fecha_inicio, 10);
      const posibleFin = inicioEfectivo + TRES_MESES_MS;
      finEfectivo = Math.min(posibleFin, ahora); // El menor entre posibleFin y ahora
    } else if (!fecha_inicio && fecha_fin) {
      // Solo fecha de fin - obtener 3 meses antes de esa fecha
      finEfectivo = parseInt(fecha_fin, 10);
      inicioEfectivo = finEfectivo - TRES_MESES_MS;
    } else {
      // Ninguna fecha proporcionada - obtener últimos 3 meses
      finEfectivo = ahora;
      inicioEfectivo = finEfectivo - TRES_MESES_MS;
    }

    // Convertir timestamps a objetos Date para el servicio (si es necesario)
    const fechaInicioDate = new Date(inicioEfectivo);
    const fechaFinDate = new Date(finEfectivo);

    // Llamar al servicio con las fechas calculadas
    const datos = await maquinaService.obtenerHistoricoConsolidado(
      identificador_externo,
      fechaInicioDate.toISOString(), // Convertir a ISO para compatibilidad con el servicio
      fechaFinDate.toISOString(),
      id_faena
    );

    // Añadir información sobre el rango de fechas utilizado en la respuesta
    const respuesta = {
      datos,
      metadatos: {
        rango_fechas: {
          inicio: inicioEfectivo,
          inicio_iso: fechaInicioDate.toISOString(),
          fin: finEfectivo,
          fin_iso: fechaFinDate.toISOString(),
        },
      },
    };

    sendSuccessResponse(res, respuesta);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener histórico consolidado");
  }
};

exports.obtenerMaquinaDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const maquina = await maquinaService.obtenerMaquinaDetalle(id);

    if (!maquina) {
      return res.status(404).json({
        success: false,
        message: "Máquina no encontrada",
      });
    }

    sendSuccessResponse(res, maquina);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener detalle de la máquina");
  }
};

exports.obtenerMaquinaStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await maquinaService.obtenerMaquinaStatus(id);

    if (!status.exists) {
      return res.status(404).json({
        success: false,
        message: "Máquina no encontrada",
      });
    }

    sendSuccessResponse(res, status);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener estado de la máquina");
  }
};

exports.actualizarMaquina = async (req, res) => {
  try {
    const { id } = req.params;
    const idUsuario = req.user.id_Usuario;

    const resultado = await maquinaService.actualizarMaquina(
      id,
      req.body,
      idUsuario
    );
    sendSuccessResponse(
      res,
      { id_Maquina: resultado.id_Maquina },
      resultado.message
    );
  } catch (error) {
    sendErrorResponse(res, error, "Error al actualizar máquina");
  }
};

// ====================================================================
// FAENAS
// ====================================================================
exports.obtenerFaenas = async (req, res) => {
  try {
    const { id_cliente, estado, fecha_inicio, fecha_fin } = req.query;
    const faenas = await faenaService.obtenerFaenas({
      id_cliente,
      estado,
      fecha_inicio,
      fecha_fin,
    });
    sendSuccessResponse(res, faenas);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener faenas");
  }
};

exports.obtenerFaenaDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const faena = await faenaService.obtenerFaenaDetalle(id);
    sendSuccessResponse(res, faena);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener detalle de faena");
  }
};

exports.actualizarFaena = async (req, res) => {
  try {
    const { id } = req.params;
    await faenaService.actualizarFaena(id, req.body);
    sendSuccessResponse(
      res,
      { id_Faena: id },
      "Faena actualizada exitosamente"
    );
  } catch (error) {
    sendErrorResponse(res, error, "Error al actualizar faena");
  }
};

exports.obtenerDatosPorFaenaExterna = async (req, res) => {
  try {
    const { id_Faena_externo } = req.query;
    const datos = await faenaService.obtenerDatosPorFaenaExterna(
      id_Faena_externo
    );
    sendSuccessResponse(res, datos);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener datos por faena externa");
  }
};

exports.obtenerResumenPorFaenaExterna = async (req, res) => {
  try {
    const { id_Faena_externo } = req.query;
    const resumen = await faenaService.obtenerResumenPorFaenaExterna(
      id_Faena_externo
    );
    sendSuccessResponse(res, resumen);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener resumen por faena externa");
  }
};

exports.exportarDatosFaena = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = await faenaService.exportarDatosFaena(id);

    if (!datos || datos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faena no encontrada o sin datos",
      });
    }

    // Establecer cabeceras para descarga de CSV
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="faena_${id}_datos.csv"`
    );

    // Enviar los datos CSV
    res.send(datos);
  } catch (error) {
    sendErrorResponse(res, error, "Error al exportar datos de faena");
  }
};

// ====================================================================
// CONFIGURACIÓN
// ====================================================================
exports.obtenerConfiguracion = async (req, res) => {
  try {
    const config = await configService.obtenerConfiguracion();
    sendSuccessResponse(res, config);
  } catch (error) {
    sendErrorResponse(res, error, "Error al obtener configuración");
  }
};

exports.actualizarConfiguracion = async (req, res) => {
  try {
    const result = await configService.actualizarConfiguracion(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        errors: result.errors,
      });
    }

    sendSuccessResponse(
      res,
      { actualizados: result.actualizados },
      "Configuración actualizada correctamente"
    );
  } catch (error) {
    sendErrorResponse(res, error, "Error al actualizar configuración");
  }
};
/**
 * Actualiza una faena identificada por su ID externo
 *
 * Este endpoint permite actualizar una faena existente en la base de datos
 * identificada por su ID externo. Los campos que se pueden actualizar son:
 * - id_Faena_externo: Identificador externo de la faena
 * - id_cliente_externo: Identificador externo del cliente asociado a la faena
 *
 * @param {Object} req - Objeto de solicitud Express
 * @param {Object} res - Objeto de respuesta Express
 * @param {String} req.params.id_externo - ID externo de la faena a actualizar
 * @param {Object} req.body - Contiene los campos a actualizar, solo se env?an los campos que se desean actualizar
 * @returns {Object} - Un objeto con el resultado de la actualizaci?n, incluye el ID de la faena actualizada y los campos actualizados
 */
exports.actualizarFaenaByExterno = async (req, res) => {
  try {
    const { id_externo } = req.params;
    const { id_Faena_externo, id_cliente_externo } = req.body;

    // Solo enviamos los campos que están presentes en el cuerpo
    const datosFaena = {};
    if (id_Faena_externo !== undefined)
      datosFaena.id_Faena_externo = id_Faena_externo;
    if (id_cliente_externo !== undefined)
      datosFaena.id_cliente_externo = id_cliente_externo;

    // Verificar que hay datos para actualizar
    if (Object.keys(datosFaena).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay datos válidos para actualizar",
      });
    }

    // Llamar al servicio para actualizar la faena por ID externo
    const resultado = await faenaService.actualizarFaenaPorIdExterno(
      id_externo,
      datosFaena
    );

    sendSuccessResponse(
      res,
      {
        id_Faena: resultado.id_Faena,
        id_Faena_externo: resultado.id_Faena_externo || id_externo,
        id_cliente_externo: resultado.id_cliente_externo,
      },
      "Faena actualizada exitosamente"
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    sendErrorResponse(res, error, "Error al actualizar faena");
  }
};

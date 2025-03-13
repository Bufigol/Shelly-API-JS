// src/controllers/outController.js
const authService = require("../services/out/authService");
const equipoService = require("../services/out/equipoService");
const faenaService = require("../services/out/faenaService");
const configService = require("../services/out/configService.js");
const maquinaService = require("../services/out/maquinaService");
const { ValidationError, NotFoundError } = require("../utils/errors");

// ====================================================================
// Funciones de autenticación
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

    res.json({
      success: true,
      token: result.token,
      userId: result.userId,
      email: result.email,
      permissions: result.permissions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.crearUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.crearUsuario(email, password);

    res.status(201).json({
      success: true,
      message: "Usuario creado exitosamente",
      id_Usuario: result.userId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error al crear usuario",
      error: error.message,
    });
  }
};

exports.solicitarResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Ya no necesitamos construir una URL base, solo pasamos el email
    await authService.solicitarResetPassword(email);

    // Mensaje actualizado para enfoque basado en API
    res.json({
      success: true,
      message:
        "Si el correo existe, se ha enviado un token para resetear la contraseña",
      details:
        "Verifique su bandeja de entrada y use el token recibido junto a la nueva contraseña en el endpoint de reseteo",
    });
  } catch (error) {
    console.error("Error al solicitar reseteo de contraseña:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.confirmarResetPassword = async (req, res) => {
  try {
    // El token ahora viene en el cuerpo de la solicitud, no como parámetro de URL
    const { token, password } = req.body;

    const result = await authService.confirmarResetPassword(token, password);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        code: "INVALID_TOKEN",
      });
    }

    res.json({
      success: true,
      message: "Contraseña actualizada exitosamente",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error al confirmar reseteo de contraseña:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// ====================================================================
// Funciones de equipos
// ====================================================================
exports.obtenerEquipos = async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const equipos = await equipoService.obtenerEquipos(id_cliente);

    res.json({
      success: true,
      data: equipos,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener equipos:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.json({
      success: true,
      data: equipo,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener detalle del equipo:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.json({
      success: true,
      data: status,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener status del equipo:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// ====================================================================
// Funciones de máquinas
// ====================================================================
exports.obtenerMaquinas = async (req, res) => {
  try {
    const { id_cliente } = req.query;
    const maquinas = await maquinaService.obtenerMaquinas(id_cliente);

    res.json({
      success: true,
      data: maquinas,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener máquinas:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.json({
      success: true,
      data: maquina,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener detalle de la máquina:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.json({
      success: true,
      data: status,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener estado de la máquina:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.json({
      success: true,
      message: resultado.message,
      id_Maquina: resultado.id_Maquina,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al actualizar máquina:", error);

    // Determinar el código de estado adecuado según el tipo de error
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
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerHistoricoConsolidado = async (req, res) => {
  try {
    const { identificador_externo, fecha_inicio, fecha_fin, id_faena } =
      req.query;

    const datos = await maquinaService.obtenerHistoricoConsolidado(
      identificador_externo,
      fecha_inicio,
      fecha_fin,
      id_faena
    );

    res.json({
      success: true,
      data: datos,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener histórico consolidado:", error);

    // Determinar el código de estado adecuado según el tipo de error
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// ====================================================================
// Funciones de faenas
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

    res.json({
      success: true,
      data: faenas,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener faenas:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerFaenaDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const faena = await faenaService.obtenerFaenaDetalle(id);

    res.json({
      success: true,
      data: faena,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener detalle de faena:", error);

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.crearFaena = async (req, res) => {
  try {
    const result = await faenaService.crearFaena(req.body);

    res.status(201).json({
      success: true,
      message: "Faena creada exitosamente",
      data: { id_Faena: result.id_Faena },
    });
  } catch (error) {
    console.error("Error al crear faena:", error);

    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.actualizarFaena = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await faenaService.actualizarFaena(id, req.body);

    res.json({
      success: true,
      message: "Faena actualizada exitosamente",
      id_Faena: id,
    });
  } catch (error) {
    console.error("Error al actualizar faena:", error);

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
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerDatosPorFaenaExterna = async (req, res) => {
  try {
    const { id_Faena_externo } = req.query;

    const datos = await faenaService.obtenerDatosPorFaenaExterna(
      id_Faena_externo
    );

    res.json({
      success: true,
      data: datos,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener datos por faena externa:", error);

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerResumenPorFaenaExterna = async (req, res) => {
  try {
    const { id_Faena_externo } = req.query;

    const resumen = await faenaService.obtenerResumenPorFaenaExterna(
      id_Faena_externo
    );

    res.json({
      success: true,
      data: resumen,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener resumen por faena externa:", error);

    if (error instanceof NotFoundError) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// ====================================================================
// Funciones de datos históricos
// ====================================================================
exports.obtenerHistoricoEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, id_faena } = req.query;

    const datos = await equipoService.obtenerHistoricoEquipo(
      id,
      fecha_inicio,
      fecha_fin,
      id_faena
    );

    res.json({
      success: true,
      data: datos,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener histórico:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerFaenasPorEquipo = async (req, res) => {
  try {
    const { id } = req.params;
    const faenas = await faenaService.obtenerFaenasPorEquipo(id);

    res.json({
      success: true,
      data: faenas,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener faenas por equipo:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerDatosFaena = async (req, res) => {
  try {
    const { id } = req.params;
    const datos = await faenaService.obtenerDatosFaena(id);

    res.json({
      success: true,
      data: datos,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener datos de faena:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

exports.obtenerResumenFaena = async (req, res) => {
  try {
    const { id } = req.params;
    const resumen = await faenaService.obtenerResumenFaena(id);

    if (!resumen || resumen.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Faena no encontrada o sin resumen",
      });
    }

    res.json({
      success: true,
      data: resumen,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener resumen de faena:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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
    console.error("Error al exportar datos de faena:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

// ====================================================================
// Funciones de configuración
// ====================================================================
exports.obtenerConfiguracion = async (req, res) => {
  try {
    const config = await configService.obtenerConfiguracion();

    res.json({
      success: true,
      data: config,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.json({
      success: true,
      message: "Configuración actualizada correctamente",
      actualizados: result.actualizados,
    });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
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

    res.status(201).json({
      success: true,
      message: result.message,
      data: { id_Maquina: result.id_Maquina },
    });
  } catch (error) {
    console.error("Error al asociar equipo:", error);
    res.status(500).json({
      success: false,
      message: "Error en el servidor",
      error: error.message,
    });
  }
};

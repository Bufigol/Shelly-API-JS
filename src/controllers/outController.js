// src/controllers/outController.js
const authService = require("../services/out/authService");
const equipoService = require("../services/out/equipoService");
const faenaService = require("../services/out/faenaService");
const configService = require("../services/out/configService.js");

// ====================================================================
// Funciones de autenticación
// ====================================================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    if (!result.success) {
      return res.status(401).json({ message: "Credenciales inválidas" });
    }
    
    res.json({ token: result.token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
      id_Usuario: result.userId 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: "Error al crear usuario", 
      error: error.message 
    });
  }
};

exports.solicitarResetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    await authService.solicitarResetPassword(email, baseUrl);
    
    // Siempre devolvemos el mismo mensaje para no revelar si el email existe
    res.json({ 
      success: true, 
      message: "Si el correo existe, se ha enviado un enlace para resetear la contraseña" 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor" 
    });
  }
};

exports.confirmarResetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    const result = await authService.confirmarResetPassword(token, password);
    
    if (!result.success) {
      return res.status(400).json({ 
        success: false,
        message: result.message
      });
    }
    
    res.json({ 
      success: true, 
      message: "Contraseña actualizada exitosamente" 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener equipos:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
        message: "Equipo no encontrado"
      });
    }
    
    res.json({
      success: true,
      data: equipo,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener detalle del equipo:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
        message: "Equipo no encontrado"
      });
    }
    
    res.json({
      success: true,
      data: status,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener status del equipo:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};

// ====================================================================
// Funciones de faenas
// ====================================================================
exports.obtenerFaenas = async (req, res) => {
  try {
    const { id_cliente, estado, fecha_inicio, fecha_fin } = req.query;
    const faenas = await faenaService.obtenerFaenas(id_cliente, estado, fecha_inicio, fecha_fin);
    
    res.json({
      success: true,
      data: faenas,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener faenas:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};

exports.obtenerFaenaDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const faena = await faenaService.obtenerFaenaDetalle(id);
    
    if (!faena) {
      return res.status(404).json({
        success: false,
        message: "Faena no encontrada"
      });
    }
    
    res.json({
      success: true,
      data: faena,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener detalle de faena:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};

exports.crearFaena = async (req, res) => {
  try {
    const result = await faenaService.crearFaena(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    res.status(201).json({
      success: true,
      message: "Faena creada exitosamente",
      data: { id_Faena: result.id_Faena }
    });
  } catch (error) {
    console.error("Error al crear faena:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};

exports.actualizarFaena = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await faenaService.actualizarFaena(id, req.body);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
      });
    }
    
    res.json({
      success: true,
      message: "Faena actualizada exitosamente"
    });
  } catch (error) {
    console.error("Error al actualizar faena:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
    
    const datos = await equipoService.obtenerHistoricoEquipo(id, fecha_inicio, fecha_fin, id_faena);
    
    res.json({
      success: true,
      data: datos,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener histórico:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener faenas por equipo:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener datos de faena:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};

exports.obtenerResumenFaena = async (req, res) => {
  try {
    const { id } = req.params;
    const resumen = await faenaService.obtenerResumenFaena(id);
    
    if (!resumen) {
      return res.status(404).json({
        success: false,
        message: "Faena no encontrada o sin resumen"
      });
    }
    
    res.json({
      success: true,
      data: resumen,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener resumen de faena:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
        message: "Faena no encontrada o sin datos"
      });
    }
    
    // Establecer cabeceras para descarga de CSV
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="faena_${id}_datos.csv"`);
    
    // Enviar los datos CSV
    res.send(datos);
  } catch (error) {
    console.error("Error al exportar datos de faena:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
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
        errors: result.errors
      });
    }
    
    res.json({
      success: true,
      message: "Configuración actualizada correctamente"
    });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};

exports.asociarEquipoMaquina = async (req, res) => {
  try {
    const { id_equipo, identificador_externo } = req.body;
    const result = await equipoService.asociarEquipoMaquina(id_equipo, identificador_externo);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    res.status(201).json({
      success: true,
      message: "Equipo asociado correctamente",
      data: { id_Maquina: result.id_Maquina }
    });
  } catch (error) {
    console.error("Error al asociar equipo:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en el servidor", 
      error: error.message 
    });
  }
};
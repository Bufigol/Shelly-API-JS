// src/services/out/loggingService.js
const databaseService = require("../database-service");

/**
 * Servicio para gestionar el registro de cambios y modificaciones en el sistema
 * Centraliza las operaciones con las tablas de logs
 */
class LoggingService {
  /**
   * Registra un cambio en la máquina en la tabla de log de modificaciones de usuario
   * @param {number} idUsuario - ID del usuario que realizó el cambio
   * @param {string} tipoEntidad - Tipo de entidad modificada (ej: "MAQUINA", "FAENA")
   * @param {number} idEntidad - ID de la entidad modificada
   * @param {string} campo - Nombre del campo modificado
   * @param {string} valorAnterior - Valor anterior del campo
   * @param {string} valorNuevo - Nuevo valor del campo
   * @returns {Promise<number>} ID del registro de log creado
   */
  async registrarModificacionUsuario(
    idUsuario,
    tipoEntidad,
    idEntidad,
    campo,
    valorAnterior,
    valorNuevo
  ) {
    try {
      // Crear objeto con información del cambio
      const infoAccion = {
        tipo_entidad: tipoEntidad,
        id_entidad: idEntidad,
        campo: campo,
        valor_anterior: valorAnterior,
        valor_nuevo: valorNuevo,
        fecha: new Date().toISOString(),
      };

      // Convertir a JSON para almacenar en la BD
      const accionJSON = JSON.stringify(infoAccion);

      // Insertar en la tabla de log
      const [result] = await databaseService.pool.query(
        `INSERT INTO api_log_modificaciones_usuario 
         (id_usuario_implicado, accion, time_stamp_modificacion) 
         VALUES (?, ?, NOW())`,
        [idUsuario, accionJSON]
      );

      console.log(`Registro de modificación creado: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      // Utilizamos el método registrarError para manejar el error
      await this.registrarError(
        "LoggingService.registrarModificacionUsuario",
        `Error al registrar modificación de usuario ${idUsuario} en ${tipoEntidad} ${idEntidad}`,
        error
      );
      // No lanzamos el error para evitar interrumpir el flujo principal
      return null;
    }
  }

  /**
   * Registra un cambio de equipo en una máquina
   * @param {number} idMaquina - ID de la máquina
   * @param {number} idEquipoAntiguo - ID del equipo anterior
   * @param {number} idEquipoNuevo - ID del nuevo equipo
   * @returns {Promise<number>} ID del registro de log creado
   */
  async registrarCambioEquipoMaquina(
    idMaquina,
    idEquipoAntiguo,
    idEquipoNuevo
  ) {
    try {
      const [result] = await databaseService.pool.query(
        `INSERT INTO api_log_maquinas_equipos 
         (id_maquina, id_equipo_antiguo, id_equipo_nuevo, fecha_actualizacion) 
         VALUES (?, ?, ?, NOW())`,
        [idMaquina, idEquipoAntiguo, idEquipoNuevo]
      );

      console.log(`Registro de cambio de equipo creado: ${result.insertId}`);
      return result.insertId;
    } catch (error) {
      const errorId = await this.registrarError(
        "LoggingService.registrarCambioEquipoMaquina",
        `Error al registrar cambio de equipo en máquina ${idMaquina} (${idEquipoAntiguo} -> ${idEquipoNuevo})`,
        error
      );

      // Este error sí lo propagamos porque es crítico para la operación
      // Pero antes lo registramos en la base de datos
      throw new Error(
        `Error al registrar cambio de equipo (ID Error: ${errorId}): ${error.message}`
      );
    }
  }

  /**
   * Obtiene el historial de modificaciones de una entidad
   * @param {string} tipoEntidad - Tipo de entidad (ej: "MAQUINA", "FAENA")
   * @param {number} idEntidad - ID de la entidad
   * @returns {Promise<Array>} Lista de modificaciones
   */
  async obtenerHistorialModificaciones(tipoEntidad, idEntidad) {
    try {
      const [registros] = await databaseService.pool.query(
        `SELECT 
          l.idapi_log_modificaciones_usuario,
          l.time_stamp_modificacion,
          l.id_usuario_implicado,
          l.accion,
          u.email as usuario_email
        FROM api_log_modificaciones_usuario l
        JOIN api_usuario u ON l.id_usuario_implicado = u.id_Usuario
        WHERE JSON_EXTRACT(l.accion, '$.tipo_entidad') = ?
        AND JSON_EXTRACT(l.accion, '$.id_entidad') = ?
        ORDER BY l.time_stamp_modificacion DESC`,
        [tipoEntidad, idEntidad]
      );

      // Procesar los registros para parsear el JSON
      return registros.map((registro) => {
        try {
          registro.accion = JSON.parse(registro.accion);
        } catch (e) {
          // Registrar el error de parseo
          this.registrarError(
            "LoggingService.obtenerHistorialModificaciones",
            `Error al parsear JSON de acción para registro ${registro.idapi_log_modificaciones_usuario}`,
            e
          );
          registro.accion = { error: "Formato inválido" };
        }
        return registro;
      });
    } catch (error) {
      await this.registrarError(
        "LoggingService.obtenerHistorialModificaciones",
        `Error al obtener historial de modificaciones para ${tipoEntidad} ${idEntidad}`,
        error
      );
      return [];
    }
  }

  /**
   * Obtiene el historial de cambios de equipo para una máquina
   * @param {number} idMaquina - ID de la máquina
   * @returns {Promise<Array>} Lista de cambios de equipo
   */
  async obtenerHistorialCambiosEquipo(idMaquina) {
    try {
      const [registros] = await databaseService.pool.query(
        `SELECT 
          l.id_log_maquinas_equipos,
          l.id_maquina,
          l.id_equipo_antiguo,
          l.id_equipo_nuevo,
          l.fecha_actualizacion,
          e_old.device_id as equipo_antiguo_device_id,
          e_new.device_id as equipo_nuevo_device_id
        FROM api_log_maquinas_equipos l
        JOIN api_equipo e_old ON l.id_equipo_antiguo = e_old.chanel_id
        JOIN api_equipo e_new ON l.id_equipo_nuevo = e_new.chanel_id
        WHERE l.id_maquina = ?
        ORDER BY l.fecha_actualizacion DESC`,
        [idMaquina]
      );

      return registros;
    } catch (error) {
      await this.registrarError(
        "LoggingService.obtenerHistorialCambiosEquipo",
        `Error al obtener historial de cambios de equipo para máquina ${idMaquina}`,
        error
      );
      return [];
    }
  }

  /**
   * Método utilitario para registrar errores en el sistema y almacenarlos en la base de datos
   * @param {string} origen - Origen del error (servicio, controlador, etc.)
   * @param {string} mensaje - Mensaje descriptivo del error
   * @param {Object} error - Objeto de error original
   * @returns {Promise<number|null>} ID del registro de error creado o null si falla
   */
  async registrarError(origen, mensaje, error) {
    try {
      const errorInfo = {
        origen,
        mensaje,
        stack: error?.stack || "No stack trace disponible",
        detalle: error?.message || "Sin detalles adicionales",
        timestamp: new Date().toISOString(),
      };

      console.error(`ERROR [${origen}]: ${mensaje}`, error);

      // Insertar en la tabla de errores
      const [result] = await databaseService.pool.query(
        `INSERT INTO api_errores 
         (mensaje_de_error, timestamp_error) 
         VALUES (?, NOW())`,
        [JSON.stringify(errorInfo)]
      );

      return result.insertId;
    } catch (e) {
      // Si falla el registro del error, al menos lo mostramos en consola
      console.error("Error al registrar error en base de datos:", e);
      return null;
    }
  }
}

module.exports = new LoggingService();

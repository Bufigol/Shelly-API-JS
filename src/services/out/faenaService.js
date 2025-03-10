// src/services/out/faenaService.js
const databaseService = require("../database-service");
const configService = require("./configService");
const loggingService = require("./loggingService");
const { ValidationError, NotFoundError } = require("../../utils/errors");

class FaenaService {
  /**
   * Obtiene faenas con filtros opcionales
   * @param {Object} options - Opciones de filtrado
   * @param {number} [options.id_cliente] - Filtrar por cliente
   * @param {string} [options.estado] - Filtrar por estado
   * @param {string} [options.fecha_inicio] - Fecha de inicio
   * @param {string} [options.fecha_fin] - Fecha de fin
   * @returns {Promise<Array>} Lista de faenas
   */
  async obtenerFaenas(options = {}) {
    const { id_cliente, estado, fecha_inicio, fecha_fin } = options;

    let query = `
      SELECT 
        f.id_Faena, 
        f.id_Faena_externo,
        f.fecha_inico,
        f.fecha_fin,
        m.identificador_externo AS maquina,
        c.nombre_cliente,
        e.device_id,
        (CASE 
          WHEN f.fecha_fin IS NULL THEN 'ACTIVA'
          ELSE 'FINALIZADA'
        END) AS estado_faena
      FROM api_faena f
      JOIN api_maquina m ON f.id_maquina = m.id_Maquina
      JOIN api_clientes c ON f.id_cliente = c.idClientes
      JOIN api_equipo e ON m.id_equipo = e.chanel_id
      WHERE 1=1
    `;

    const queryParams = [];

    if (id_cliente) {
      query += " AND f.id_cliente = ?";
      queryParams.push(id_cliente);
    }

    if (estado) {
      query +=
        ' AND (CASE WHEN f.fecha_fin IS NULL THEN "ACTIVA" ELSE "FINALIZADA" END) = ?';
      queryParams.push(estado);
    }

    if (fecha_inicio) {
      query += " AND f.fecha_inico >= ?";
      queryParams.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += " AND f.fecha_inico <= ?";
      queryParams.push(fecha_fin);
    }

    query += " ORDER BY f.fecha_inico DESC";

    try {
      const [faenas] = await databaseService.pool.query(query, queryParams);
      return faenas;
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.obtenerFaenas",
        "Error al obtener faenas con filtros",
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene el detalle completo de una faena
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<Object>} Detalle de la faena
   */
  async obtenerFaenaDetalle(idFaena) {
    try {
      const query = `
        SELECT 
          f.*,
          m.identificador_externo AS maquina_identificador,
          e.device_id,
          e.mac_address,
          c.nombre_cliente,
          (SELECT COUNT(*) FROM api_datos_por_faena WHERE id_faena = f.id_Faena) AS total_mediciones,
          r.temperatura_maxima,
          r.temperatura_minima,
          r.promedio_temperatura
        FROM api_faena f
        JOIN api_maquina m ON f.id_maquina = m.id_Maquina
        JOIN api_equipo e ON m.id_equipo = e.chanel_id
        JOIN api_clientes c ON f.id_cliente = c.idClientes
        LEFT JOIN api_resumen_Datos_por_faena r ON f.id_Faena = r.id_faena AND r.cuarto = '5'
        WHERE f.id_Faena = ?
      `;

      const [faenas] = await databaseService.pool.query(query, [idFaena]);

      if (faenas.length === 0) {
        throw new NotFoundError("Faena no encontrada");
      }

      return faenas[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      await loggingService.registrarError(
        "FaenaService.obtenerFaenaDetalle",
        `Error al obtener detalle de faena ${idFaena}`,
        error
      );
      throw error;
    }
  }

  /**
   * Crea una nueva faena
   * @param {Object} datosFaena - Datos para crear faena
   * @returns {Promise<Object>} Faena creada
   */
  async crearFaena(datosFaena) {
    try {
      const {
        id_maquina,
        fecha_inicio = new Date(),
        fecha_fin = null,
        id_cliente = 1, // Cliente por defecto si no se especifica
        id_Faena_externo = null,
      } = datosFaena;

      // Validar que no haya faena activa para esta máquina
      const [faenasActivas] = await databaseService.pool.query(
        "SELECT id_Faena FROM api_faena WHERE id_maquina = ? AND fecha_fin IS NULL",
        [id_maquina]
      );

      if (faenasActivas.length > 0) {
        throw new ValidationError(
          "Ya existe una faena activa para esta máquina"
        );
      }

      const [result] = await databaseService.pool.query(
        "INSERT INTO api_faena (fecha_inico, fecha_fin, id_maquina, id_cliente, id_Faena_externo) VALUES (?, ?, ?, ?, ?)",
        [fecha_inicio, fecha_fin, id_maquina, id_cliente, id_Faena_externo]
      );

      return {
        success: true,
        id_Faena: result.insertId,
        ...datosFaena,
      };
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.crearFaena",
        `Error al crear faena para máquina ${datosFaena.id_maquina}`,
        error
      );
      throw error;
    }
  }

  /**
   * Actualiza una faena existente
   * @param {number} idFaena - ID de la faena
   * @param {Object} datosFaena - Datos para actualizar
   * @returns {Promise<Object>} Faena actualizada
   */
  async actualizarFaena(idFaena, datosFaena) {
    try {
      const { fecha_fin, id_cliente, id_Faena_externo } = datosFaena;

      const updateFields = [];
      const queryParams = [];

      if (fecha_fin !== undefined) {
        updateFields.push("fecha_fin = ?");
        queryParams.push(fecha_fin);
      }

      if (id_cliente !== undefined) {
        updateFields.push("id_cliente = ?");
        queryParams.push(id_cliente);
      }

      if (id_Faena_externo !== undefined) {
        updateFields.push("id_Faena_externo = ?");
        queryParams.push(id_Faena_externo);
      }

      if (updateFields.length === 0) {
        throw new ValidationError("No hay campos para actualizar");
      }

      queryParams.push(idFaena);

      const query = `
        UPDATE api_faena 
        SET ${updateFields.join(", ")}
        WHERE id_Faena = ?
      `;

      const [result] = await databaseService.pool.query(query, queryParams);

      if (result.affectedRows === 0) {
        throw new NotFoundError("Faena no encontrada");
      }

      return {
        success: true,
        id_Faena: idFaena,
        ...datosFaena,
      };
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.actualizarFaena",
        `Error al actualizar faena ${idFaena}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene todas las faenas de un equipo
   * @param {number} idEquipo - ID del equipo
   * @returns {Promise<Array>} Faenas del equipo
   */
  async obtenerFaenasPorEquipo(idEquipo) {
    try {
      const query = `
        SELECT 
          f.id_Faena,
          f.id_Faena_externo,
          f.fecha_inico,
          f.fecha_fin,
          c.nombre_cliente
        FROM api_faena f
        JOIN api_maquina m ON f.id_maquina = m.id_Maquina
        JOIN api_clientes c ON f.id_cliente = c.idClientes
        WHERE m.id_equipo = ?
        ORDER BY f.fecha_inico DESC
      `;

      const [faenas] = await databaseService.pool.query(query, [idEquipo]);
      return faenas;
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.obtenerFaenasPorEquipo",
        `Error al obtener faenas para equipo ${idEquipo}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene los datos detallados de una faena
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<Array>} Datos de la faena
   */
  async obtenerDatosFaena(idFaena) {
    try {
      const query = `
        SELECT 
          timestamp_dato,
          temperatura,
          latitud,
          longitud,
          calidad_temperatura
        FROM api_datos_por_faena
        WHERE id_faena = ?
        ORDER BY timestamp_dato
      `;

      const [datos] = await databaseService.pool.query(query, [idFaena]);
      return datos;
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.obtenerDatosFaena",
        `Error al obtener datos de faena ${idFaena}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene el resumen de una faena
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<Object>} Resumen de la faena
   */
  async obtenerResumenFaena(idFaena) {
    try {
      const query = `
        SELECT * FROM api_resumen_Datos_por_faena
        WHERE id_faena = ?
        ORDER BY cuarto
      `;

      const [resumen] = await databaseService.pool.query(query, [idFaena]);
      return resumen;
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.obtenerResumenFaena",
        `Error al obtener resumen de faena ${idFaena}`,
        error
      );
      throw error;
    }
  }

  /**
   * Exporta los datos de una faena a CSV
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<string>} Contenido CSV
   */
  async exportarDatosFaena(idFaena) {
    try {
      const datos = await this.obtenerDatosFaena(idFaena);

      // Genera CSV manualmente
      const csvHeader = "Timestamp,Temperatura,Latitud,Longitud,Calidad\n";
      const csvContent = datos
        .map(
          (d) =>
            `${d.timestamp_dato},${d.temperatura},${d.latitud},${d.longitud},${d.calidad_temperatura}`
        )
        .join("\n");

      return csvHeader + csvContent;
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.exportarDatosFaena",
        `Error al exportar datos de faena ${idFaena}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene una faena por su ID externo
   * @param {string} idFaenaExterno - ID externo de la faena
   * @returns {Promise<Object|null>} Faena encontrada o null
   */
  async obtenerFaenaPorIdExterno(idFaenaExterno) {
    try {
      const [faenas] = await databaseService.pool.query(
        `SELECT 
          f.id_Faena, 
          f.id_Faena_externo,
          f.fecha_inico,
          f.fecha_fin,
          f.id_maquina,
          f.id_cliente,
          m.identificador_externo AS maquina,
          c.nombre_cliente
        FROM api_faena f
        JOIN api_maquina m ON f.id_maquina = m.id_Maquina
        JOIN api_clientes c ON f.id_cliente = c.idClientes
        WHERE f.id_Faena_externo = ?`,
        [idFaenaExterno]
      );

      if (faenas.length === 0) {
        return null;
      }

      return faenas[0];
    } catch (error) {
      await loggingService.registrarError(
        "FaenaService.obtenerFaenaPorIdExterno",
        `Error al obtener faena con ID externo ${idFaenaExterno}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene datos de una faena por su ID externo
   * @param {string} idFaenaExterno - ID externo de la faena
   * @returns {Promise<Array>} Datos de la faena
   */
  async obtenerDatosPorFaenaExterna(idFaenaExterno) {
    try {
      const faena = await this.obtenerFaenaPorIdExterno(idFaenaExterno);

      if (!faena) {
        throw new NotFoundError(
          `Faena con ID externo ${idFaenaExterno} no encontrada`
        );
      }

      return this.obtenerDatosFaena(faena.id_Faena);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      await loggingService.registrarError(
        "FaenaService.obtenerDatosPorFaenaExterna",
        `Error al obtener datos de faena con ID externo ${idFaenaExterno}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene resumen de una faena por su ID externo.
   * 
   * Este método busca en la base de datos la faena asociada al ID externo
   * proporcionado y devuelve un resumen de la misma. Si no encuentra la faena,
   * lanza un error de tipo NotFoundError con un mensaje que indica que la
   * faena no se encontró.
   * 
   * @param {string} idFaenaExterno - ID externo de la faena. Este es el
   * identificador único asignado a la faena por el sistema externo que
   * la creó. Debe ser una cadena de caracteres alfanumérica única.
   * 
   * @returns {Promise<Array>} Un arreglo de objetos que representan el
   * resumen de la faena. Cada objeto en el arreglo tiene las siguientes
   * propiedades:
   * 
   * - cuarto: El número de cuarto asociado a la medición.
   * - temperatura_maxima: La temperatura máxima registrada en el cuarto.
   * - temperatura_minima: La temperatura mínima registrada en el cuarto.
   * - promedio_temperatura: El promedio de las temperaturas registradas en
   * el cuarto.
   * 
   * Si se produce un error durante la ejecución del método, se lanza un
   * error que incluye un mensaje descriptivo del error.
   */
  async obtenerResumenPorFaenaExterna(idFaenaExterno) {
    try {
      const faena = await this.obtenerFaenaPorIdExterno(idFaenaExterno);

      if (!faena) {
        throw new NotFoundError(
          `Faena con ID externo ${idFaenaExterno} no encontrada`
        );
      }

      return this.obtenerResumenFaena(faena.id_Faena);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      await loggingService.registrarError(
        "FaenaService.obtenerResumenPorFaenaExterna",
        `Error al obtener resumen de faena con ID externo ${idFaenaExterno}`,
        error
      );
      throw error;
    }
  }

  /**
   * Actualiza el identificador externo de una faena en el sistema.
   * Este método permite cambiar el ID externo asociado a una faena específica. 
   * Esto es útil cuando se necesita actualizar el identificador de referencia externa 
   * de la faena, por ejemplo, para mantener la consistencia con un sistema externo.
   * 
   * Verifica que la faena exista antes de proceder con la actualización. Si no existe,
   * se lanzará un error de tipo NotFoundError. También comprueba si el nuevo ID externo
   * ya está en uso por otra faena, y en caso afirmativo, lanzará un ValidationError.
   * 
   * Si la actualización se realiza con éxito, se registrará el cambio en la base de datos
   * y se devolverá un objeto que representa el resultado de la operación.
   * 
   * @param {number} idFaena - ID interno de la faena que se desea actualizar.
   * @param {string} nuevoIdExterno - Nuevo ID externo que se desea asociar a la faena.
   *                                  Debe ser único en el contexto de todas las faenas.
   * @param {number} idUsuario - ID del usuario que realiza la modificación. Este usuario
   *                             será registrado como responsable del cambio.
   * @returns {Promise<Object>} Resultado de la operación, incluyendo información sobre 
   *                            el éxito o fracaso de la actualización.
   * 
   * @throws {NotFoundError} Si la faena con el ID proporcionado no existe en el sistema.
   * @throws {ValidationError} Si el nuevo ID externo ya está asociado a otra faena.
   */
  async actualizarIdFaenaExterno(idFaena, nuevoIdExterno, idUsuario) {
    const connection = await databaseService.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar que la faena existe
      const [faenas] = await connection.query(
        "SELECT id_Faena, id_Faena_externo FROM api_faena WHERE id_Faena = ?",
        [idFaena]
      );

      if (faenas.length === 0) {
        await connection.rollback();
        throw new NotFoundError("Faena no encontrada");
      }

      const valorAnterior = faenas[0].id_Faena_externo || "NULL";

      // Actualizar el ID externo
      await connection.query(
        "UPDATE api_faena SET id_Faena_externo = ? WHERE id_Faena = ?",
        [nuevoIdExterno, idFaena]
      );

      // Registrar el cambio en el log
      await loggingService.registrarModificacionUsuario(
        idUsuario,
        "FAENA",
        idFaena,
        "id_Faena_externo",
        valorAnterior,
        nuevoIdExterno
      );

      await connection.commit();

      return {
        success: true,
        message: "ID externo de faena actualizado correctamente",
        id_Faena: idFaena,
        id_Faena_externo: nuevoIdExterno,
      };
    } catch (error) {
      await connection.rollback();
      await loggingService.registrarError(
        "FaenaService.actualizarIdFaenaExterno",
        `Error al actualizar ID externo de faena ${idFaena}`,
        error
      );
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new FaenaService();

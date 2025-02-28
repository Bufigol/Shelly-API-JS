// src/services/out/faenaService.js
const databaseService = require("../database-service");
const configService = require("./configService");
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

    const [faenas] = await databaseService.pool.query(query, queryParams);
    return faenas;
  }

  /**
   * Obtiene el detalle completo de una faena
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<Object>} Detalle de la faena
   */
  async obtenerFaenaDetalle(idFaena) {
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
  }

  /**
   * Crea una nueva faena
   * @param {Object} datosFaena - Datos para crear faena
   * @returns {Promise<Object>} Faena creada
   */
  async crearFaena(datosFaena) {
    const {
      id_maquina,
      fecha_inicio = new Date(),
      fecha_fin = null,
      id_cliente = 1, // Cliente por defecto si no se especifica
    } = datosFaena;

    // Validar que no haya faena activa para esta máquina
    const [faenasActivas] = await databaseService.pool.query(
      "SELECT id_Faena FROM api_faena WHERE id_maquina = ? AND fecha_fin IS NULL",
      [id_maquina]
    );

    if (faenasActivas.length > 0) {
      throw new ValidationError("Ya existe una faena activa para esta máquina");
    }

    const [result] = await databaseService.pool.query(
      "INSERT INTO api_faena (fecha_inico, fecha_fin, id_maquina, id_cliente) VALUES (?, ?, ?, ?)",
      [fecha_inicio, fecha_fin, id_maquina, id_cliente]
    );

    return {
      id_Faena: result.insertId,
      ...datosFaena,
    };
  }

  /**
   * Actualiza una faena existente
   * @param {number} idFaena - ID de la faena
   * @param {Object} datosFaena - Datos para actualizar
   * @returns {Promise<Object>} Faena actualizada
   */
  async actualizarFaena(idFaena, datosFaena) {
    const { fecha_fin, id_cliente } = datosFaena;

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

    return { id_Faena: idFaena, ...datosFaena };
  }

  /**
   * Obtiene todas las faenas de un equipo
   * @param {number} idEquipo - ID del equipo
   * @returns {Promise<Array>} Faenas del equipo
   */
  async obtenerFaenasPorEquipo(idEquipo) {
    const query = `
      SELECT 
        f.id_Faena,
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
  }

  /**
   * Obtiene los datos detallados de una faena
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<Array>} Datos de la faena
   */
  async obtenerDatosFaena(idFaena) {
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
  }

  /**
   * Obtiene el resumen de una faena
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<Object>} Resumen de la faena
   */
  async obtenerResumenFaena(idFaena) {
    const query = `
      SELECT * FROM api_resumen_Datos_por_faena
      WHERE id_faena = ?
      ORDER BY cuarto
    `;

    const [resumen] = await databaseService.pool.query(query, [idFaena]);
    return resumen;
  }

  /**
   * Exporta los datos de una faena a CSV
   * @param {number} idFaena - ID de la faena
   * @returns {Promise<string>} Contenido CSV
   */
  async exportarDatosFaena(idFaena) {
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
  }
}

module.exports = new FaenaService();

// src/services/out/equipoService.js
const databaseService = require("../database-service");

/**
 * Servicio que maneja todas las operaciones relacionadas con equipos
 */
class EquipoService {
  /**
   * Obtiene los rangos de temperatura configurados en el sistema
   * @returns {Object|null} Objeto con los rangos de temperatura
   */
  async obtenerRangosTemperatura() {
    try {
      const [rangos] = await databaseService.pool.query(`
        SELECT 
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 2) AS rojo_bajo,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 4) AS amarillo_bajo,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 8) AS amarillo_alto,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 10) AS rojo_alto
      `);

      if (rangos.length === 0) {
        return null;
      }

      // Convertir los valores a números
      const resultado = {
        rojo_bajo: parseFloat(rangos[0].rojo_bajo),
        amarillo_bajo: parseFloat(rangos[0].amarillo_bajo),
        amarillo_alto: parseFloat(rangos[0].amarillo_alto),
        rojo_alto: parseFloat(rangos[0].rojo_alto),
      };

      return resultado;
    } catch (error) {
      console.error("Error al obtener rangos de temperatura:", error);
      return null;
    }
  }

  /**
   * Obtiene la lista de equipos disponibles
   * @param {number} idCliente - ID de cliente para filtrar (opcional)
   * @returns {Array} Lista de equipos con su información básica
   */
  async obtenerEquipos(idCliente) {
    let query = `
      SELECT 
        e.chanel_id AS id_equipo,
        e.device_id,
        e.mac_address,
        e.firmware,
        e.status,
        m.id_Maquina,
        m.identificador_externo,
        CASE 
          WHEN f.id_Faena IS NOT NULL AND f.fecha_fin IS NULL THEN 'ACTIVO'
          ELSE 'INACTIVO'
        END AS estado
      FROM api_equipo e
      JOIN api_maquina m ON e.chanel_id = m.id_equipo
      LEFT JOIN (
        SELECT f.id_Faena, f.id_maquina, f.fecha_fin
        FROM api_faena f
        WHERE f.fecha_fin IS NULL OR f.fecha_fin = (
          SELECT MAX(f2.fecha_fin) FROM api_faena f2 WHERE f2.id_maquina = f.id_maquina
        )
      ) f ON m.id_Maquina = f.id_maquina
    `;

    const queryParams = [];

    // Si hay filtro por cliente, lo añadimos a la consulta
    if (idCliente) {
      query += ` 
        LEFT JOIN api_faena af ON m.id_Maquina = af.id_maquina
        WHERE af.id_cliente = ? OR af.id_cliente IS NULL
        GROUP BY e.chanel_id
      `;
      queryParams.push(idCliente);
    }

    query += " ORDER BY m.identificador_externo";

    const [equipos] = await databaseService.pool.query(query, queryParams);

    // Obtener la última lectura para cada equipo
    for (const equipo of equipos) {
      const [ultimaLectura] = await databaseService.pool.query(
        `
        SELECT 
          cf.field7 AS temperatura,
          cf.latitude AS latitud,
          cf.longitude AS longitud,
          cf.created_at AS fecha_lectura
        FROM api_channel_feeds cf
        WHERE cf.channel_id = ?
        ORDER BY cf.created_at DESC
        LIMIT 1
      `,
        [equipo.id_equipo]
      );

      equipo.ultima_lectura =
        ultimaLectura.length > 0 ? ultimaLectura[0] : null;

      // Determinar semáforo según los rangos configurados
      if (equipo.ultima_lectura && equipo.ultima_lectura.temperatura !== null) {
        const rangos = await this.obtenerRangosTemperatura();

        if (rangos) {
          const temperatura = equipo.ultima_lectura.temperatura;

          if (temperatura < rangos.rojo_bajo) {
            equipo.semaforo = "ROJO_BAJO";
          } else if (temperatura < rangos.amarillo_bajo) {
            equipo.semaforo = "AMARILLO_BAJO";
          } else if (temperatura < rangos.amarillo_alto) {
            equipo.semaforo = "VERDE";
          } else if (temperatura < rangos.rojo_alto) {
            equipo.semaforo = "AMARILLO_ALTO";
          } else {
            equipo.semaforo = "ROJO_ALTO";
          }
        }
      }
    }

    return equipos;
  }

  /**
   * Obtiene información detallada de un equipo específico
   * @param {number} idEquipo - ID del equipo a consultar
   * @returns {Object|null} Información detallada del equipo o null si no existe
   */
  async obtenerEquipoDetalle(idEquipo) {
    // Obtener información del equipo
    const [equipos] = await databaseService.pool.query(
      `
      SELECT 
        e.chanel_id AS id_equipo,
        e.device_id,
        e.mac_address,
        e.firmware,
        e.status,
        e.fecha_creacion,
        e.fecha_actualizacion,
        m.id_Maquina,
        m.identificador_externo
      FROM api_equipo e
      JOIN api_maquina m ON e.chanel_id = m.id_equipo
      WHERE e.chanel_id = ?
    `,
      [idEquipo]
    );

    if (equipos.length === 0) {
      return null;
    }

    const equipo = equipos[0];

    // Obtener faena activa si existe
    const [faenaActiva] = await databaseService.pool.query(
      `
      SELECT 
        f.id_Faena,
        f.id_Faena_externo,
        f.fecha_inico AS fecha_inicio,
        f.fecha_fin,
        c.nombre_cliente,
        c.idClientes AS id_cliente
      FROM api_faena f
      JOIN api_clientes c ON f.id_cliente = c.idClientes
      WHERE f.id_maquina = ? AND f.fecha_fin IS NULL
      LIMIT 1
    `,
      [equipo.id_Maquina]
    );

    equipo.faena_activa = faenaActiva.length > 0 ? faenaActiva[0] : null;

    // Obtener últimas 10 lecturas
    const [ultimasLecturas] = await databaseService.pool.query(
      `
      SELECT 
        cf.field7 AS temperatura,
        cf.latitude AS latitud,
        cf.longitude AS longitud,
        cf.created_at AS fecha_lectura
      FROM api_channel_feeds cf
      WHERE cf.channel_id = ?
      ORDER BY cf.created_at DESC
      LIMIT 10
    `,
      [idEquipo]
    );

    equipo.ultimas_lecturas = ultimasLecturas;

    // Obtener historial de cambios de equipos
    const [historialCambios] = await databaseService.pool.query(
      `
      SELECT 
        l.id_equipo_antiguo,
        l.id_equipo_nuevo,
        l.fecha_actualizacion
      FROM api_log_maquinas_equipos l
      WHERE l.id_maquina = ?
      ORDER BY l.fecha_actualizacion DESC
    `,
      [equipo.id_Maquina]
    );

    equipo.historial_cambios = historialCambios;

    return equipo;
  }

  /**
   * Obtiene el estado actual del equipo (semáforo)
   * @param {number} idEquipo - ID del equipo a consultar
   * @returns {Object} Estado del equipo incluyendo semáforo y última lectura
   */
  async obtenerEquipoStatus(idEquipo) {
    // Verificar si el equipo existe
    const [equipos] = await databaseService.pool.query(
      `
      SELECT chanel_id FROM api_equipo WHERE chanel_id = ?
    `,
      [idEquipo]
    );

    if (equipos.length === 0) {
      return { exists: false };
    }

    // Obtener la última lectura para el equipo
    const [ultimaLectura] = await databaseService.pool.query(
      `
      SELECT 
        cf.field7 AS temperatura,
        cf.latitude AS latitud,
        cf.longitude AS longitud,
        cf.created_at AS fecha_lectura,
        cf.status
      FROM api_channel_feeds cf
      WHERE cf.channel_id = ?
      ORDER BY cf.created_at DESC
      LIMIT 1
    `,
      [idEquipo]
    );

    if (ultimaLectura.length === 0) {
      return {
        exists: true,
        estado: "SIN_DATOS",
        semaforo: "GRIS",
        ultima_lectura: null,
      };
    }

    const lectura = ultimaLectura[0];

    // Determinar estado online/offline basado en la última lectura
    const tiempoTranscurrido =
      Date.now() - new Date(lectura.fecha_lectura).getTime();
    const estadoConexion =
      tiempoTranscurrido < 5 * 60 * 1000 ? "ONLINE" : "OFFLINE"; // 5 minutos

    // Obtener rangos de temperatura
    const rangos = await this.obtenerRangosTemperatura();

    let semaforo = "GRIS";

    if (rangos && lectura.temperatura !== null) {
      const temperatura = lectura.temperatura;

      if (temperatura < rangos.rojo_bajo) {
        semaforo = "ROJO_BAJO";
      } else if (temperatura < rangos.amarillo_bajo) {
        semaforo = "AMARILLO_BAJO";
      } else if (temperatura < rangos.amarillo_alto) {
        semaforo = "VERDE";
      } else if (temperatura < rangos.rojo_alto) {
        semaforo = "AMARILLO_ALTO";
      } else {
        semaforo = "ROJO_ALTO";
      }
    }

    // Obtener maquina asociada
    const [maquina] = await databaseService.pool.query(
      `
      SELECT id_Maquina, identificador_externo
      FROM api_maquina
      WHERE id_equipo = ?
    `,
      [idEquipo]
    );

    // Verificar si hay faena activa
    let faenaActiva = null;
    if (maquina.length > 0) {
      const [faena] = await databaseService.pool.query(
        `
        SELECT id_Faena
        FROM api_faena
        WHERE id_maquina = ? AND fecha_fin IS NULL
        LIMIT 1
      `,
        [maquina[0].id_Maquina]
      );

      faenaActiva = faena.length > 0;
    }

    return {
      exists: true,
      estado: estadoConexion,
      semaforo: semaforo,
      ultima_lectura: lectura,
      maquina: maquina.length > 0 ? maquina[0] : null,
      faena_activa: faenaActiva,
    };
  }

  /**
   * Obtiene datos históricos de un equipo
   * @param {number} idEquipo - ID del equipo
   * @param {string} fechaInicio - Fecha de inicio del rango
   * @param {string} fechaFin - Fecha de fin del rango
   * @param {number} idFaena - ID de faena (opcional)
   * @returns {Object} Datos históricos organizados
   */
  async obtenerHistoricoEquipo(idEquipo, fechaInicio, fechaFin, idFaena) {
    // Verificar si el equipo existe
    const [equipos] = await databaseService.pool.query(
      `
      SELECT e.chanel_id, m.id_Maquina
      FROM api_equipo e
      JOIN api_maquina m ON e.chanel_id = m.id_equipo
      WHERE e.chanel_id = ?
    `,
      [idEquipo]
    );

    if (equipos.length === 0) {
      throw new Error("Equipo no encontrado");
    }

    const idMaquina = equipos[0].id_Maquina;

    // Construir consulta base
    let query = `
      SELECT 
        f.id_Faena,
        f.id_Faena_externo,
        f.fecha_inico AS fecha_inicio,
        f.fecha_fin,
        df.timestamp_dato,
        df.temperatura,
        df.latitud,
        df.longitud,
        df.calidad_temperatura
      FROM api_faena f
      JOIN api_datos_por_faena df ON f.id_Faena = df.id_faena
      WHERE f.id_maquina = ?
    `;

    const queryParams = [idMaquina];

    // Aplicar filtros
    if (idFaena) {
      query += " AND f.id_Faena = ?";
      queryParams.push(idFaena);
    } else {
      if (fechaInicio) {
        query += " AND df.timestamp_dato >= ?";
        queryParams.push(fechaInicio);
      }

      if (fechaFin) {
        query += " AND df.timestamp_dato <= ?";
        queryParams.push(fechaFin);
      }
    }

    query += " ORDER BY df.timestamp_dato";

    const [datos] = await databaseService.pool.query(query, queryParams);

    // Agrupar datos por faena
    const datosPorFaena = {};

    for (const dato of datos) {
      if (!datosPorFaena[dato.id_Faena]) {
        datosPorFaena[dato.id_Faena] = {
          id_Faena: dato.id_Faena,
          id_Faena_externo: dato.id_Faena_externo,
          fecha_inicio: dato.fecha_inicio,
          fecha_fin: dato.fecha_fin,
          datos: [],
        };
      }

      datosPorFaena[dato.id_Faena].datos.push({
        timestamp: dato.timestamp_dato,
        temperatura: dato.temperatura,
        latitud: dato.latitud,
        longitud: dato.longitud,
        calidad_temperatura: dato.calidad_temperatura,
      });
    }

    return {
      id_equipo: idEquipo,
      id_maquina: idMaquina,
      faenas: Object.values(datosPorFaena),
    };
  }

  /**
   * Asocia un equipo con una máquina
   * @param {number} idEquipo - ID del equipo a asociar
   * @param {string} identificadorExterno - Identificador externo para la máquina
   * @returns {Object} Resultado de la operación
   */
  async asociarEquipoMaquina(idEquipo, identificadorExterno) {
    const connection = await databaseService.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar que el equipo existe
      const [equipos] = await connection.query(
        "SELECT chanel_id FROM api_equipo WHERE chanel_id = ?",
        [idEquipo]
      );

      if (equipos.length === 0) {
        await connection.rollback();
        return {
          success: false,
          message: "Equipo no encontrado",
        };
      }

      // Verificar si el identificador externo ya existe
      const [maquinasExistentes] = await connection.query(
        "SELECT id_Maquina FROM api_maquina WHERE identificador_externo = ?",
        [identificadorExterno]
      );

      if (maquinasExistentes.length > 0) {
        await connection.rollback();
        return {
          success: false,
          message: "Ya existe una máquina con este identificador",
        };
      }

      // Verificar si el equipo ya está asociado a otra máquina
      const [maquinasAsociadas] = await connection.query(
        "SELECT id_Maquina FROM api_maquina WHERE id_equipo = ?",
        [idEquipo]
      );

      // Si el equipo ya está asociado, generamos registro en log
      if (maquinasAsociadas.length > 0) {
        // Crear nueva máquina
        const [result] = await connection.query(
          "INSERT INTO api_maquina (identificador_externo, id_equipo, fecha_creacion) VALUES (?, ?, NOW())",
          [identificadorExterno, idEquipo]
        );

        const idNuevaMaquina = result.insertId;

        // Registrar el cambio en el log
        await connection.query(
          "INSERT INTO api_log_maquinas_equipos (id_maquina, id_equipo_antiguo, id_equipo_nuevo, fecha_actualizacion) VALUES (?, ?, ?, NOW())",
          [
            maquinasAsociadas[0].id_Maquina,
            maquinasAsociadas[0].id_equipo,
            idEquipo,
          ]
        );

        await connection.commit();

        return {
          success: true,
          id_Maquina: idNuevaMaquina,
          message: "Nueva máquina creada y equipo reasignado",
        };
      }

      // Crear nueva máquina
      const [result] = await connection.query(
        "INSERT INTO api_maquina (identificador_externo, id_equipo, fecha_creacion) VALUES (?, ?, NOW())",
        [identificadorExterno, idEquipo]
      );

      await connection.commit();

      return {
        success: true,
        id_Maquina: result.insertId,
        message: "Equipo asociado correctamente",
      };
    } catch (error) {
      await connection.rollback();
      console.error("Error al asociar equipo a máquina:", error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new EquipoService();

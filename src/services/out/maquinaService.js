// src/services/out/maquinaService.js
const databaseService = require("../database-service");
const loggingService = require("./loggingService");
const equipoService = require("./equipoService");
const configService = require("./configService");
const { ValidationError, NotFoundError } = require("../../utils/errors");

/**
 * Servicio para gestionar todas las operaciones relacionadas con máquinas
 */
class MaquinaService {
  /**
   * Obtiene la lista de todas las máquinas con su estado actual
   * @param {number} idCliente - ID del cliente para filtrar (opcional)
   * @returns {Promise<Array>} Lista de máquinas con su información básica y estado
   */
  async obtenerMaquinas(idCliente) {
    let query = `
      SELECT 
        m.id_Maquina,
        m.identificador_externo,
        m.fecha_creacion,
        m.fecha_actualizacion,
        e.chanel_id AS id_equipo,
        e.device_id,
        e.mac_address,
        e.status AS estado_equipo,
        CASE 
          WHEN f.id_Faena IS NOT NULL AND f.fecha_fin IS NULL THEN 'ACTIVA'
          ELSE 'INACTIVA'
        END AS estado_faena,
        c.nombre_cliente
      FROM api_maquina m
      JOIN api_equipo e ON m.id_equipo = e.chanel_id
      LEFT JOIN (
        SELECT f.id_Faena, f.id_maquina, f.fecha_fin, f.id_cliente
        FROM api_faena f
        WHERE f.fecha_fin IS NULL OR f.fecha_fin = (
          SELECT MAX(f2.fecha_fin) FROM api_faena f2 WHERE f2.id_maquina = f.id_maquina
        )
      ) f ON m.id_Maquina = f.id_maquina
      LEFT JOIN api_clientes c ON f.id_cliente = c.idClientes
    `;

    const queryParams = [];

    // Si hay filtro por cliente, lo añadimos
    if (idCliente) {
      query += ` WHERE f.id_cliente = ?`;
      queryParams.push(idCliente);
    }

    query += " ORDER BY m.identificador_externo";

    const [maquinas] = await databaseService.pool.query(query, queryParams);

    // Obtener la última lectura y determinar el semáforo para cada máquina
    for (const maquina of maquinas) {
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
        [maquina.id_equipo]
      );

      maquina.ultima_lectura =
        ultimaLectura.length > 0 ? ultimaLectura[0] : null;

      // Determinar semáforo según los rangos configurados
      if (
        maquina.ultima_lectura &&
        maquina.ultima_lectura.temperatura !== null
      ) {
        const rangos = await equipoService.obtenerRangosTemperatura();

        if (rangos) {
          const temperatura = maquina.ultima_lectura.temperatura;

          if (temperatura < rangos.rojo_bajo) {
            maquina.semaforo = "ROJO_BAJO";
          } else if (temperatura < rangos.amarillo_bajo) {
            maquina.semaforo = "AMARILLO_BAJO";
          } else if (temperatura < rangos.amarillo_alto) {
            maquina.semaforo = "VERDE";
          } else if (temperatura < rangos.rojo_alto) {
            maquina.semaforo = "AMARILLO_ALTO";
          } else {
            maquina.semaforo = "ROJO_ALTO";
          }
        }
      }
    }

    return maquinas;
  }

  /**
   * Obtiene información detallada de una máquina específica
   * @param {number} idMaquina - ID de la máquina a consultar
   * @returns {Promise<Object|null>} Información detallada de la máquina o null si no existe
   */
  async obtenerMaquinaDetalle(idMaquina) {
    // Obtener información de la máquina
    const [maquinas] = await databaseService.pool.query(
      `
      SELECT 
        m.id_Maquina,
        m.identificador_externo,
        m.fecha_creacion,
        m.fecha_actualizacion,
        e.chanel_id AS id_equipo,
        e.device_id,
        e.mac_address,
        e.firmware,
        e.status,
        e.fecha_creacion AS fecha_creacion_equipo
      FROM api_maquina m
      JOIN api_equipo e ON m.id_equipo = e.chanel_id
      WHERE m.id_Maquina = ?
    `,
      [idMaquina]
    );

    if (maquinas.length === 0) {
      return null;
    }

    const maquina = maquinas[0];

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
      [idMaquina]
    );

    maquina.faena_activa = faenaActiva.length > 0 ? faenaActiva[0] : null;

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
      [maquina.id_equipo]
    );

    maquina.ultimas_lecturas = ultimasLecturas;

    // Obtener historial de cambios de equipos
    maquina.historial_cambios =
      await loggingService.obtenerHistorialCambiosEquipo(idMaquina);

    // Obtener historial de modificaciones generales
    maquina.historial_modificaciones =
      await loggingService.obtenerHistorialModificaciones("MAQUINA", idMaquina);

    return maquina;
  }

  /**
   * Obtiene el estado actual de una máquina (semáforo, temperatura, etc.)
   * @param {number} idMaquina - ID de la máquina
   * @returns {Promise<Object>} Estado actual de la máquina
   */
  async obtenerMaquinaStatus(idMaquina) {
    // Verificar si la máquina existe
    const [maquinas] = await databaseService.pool.query(
      `
      SELECT 
        m.id_Maquina, 
        m.identificador_externo,
        e.chanel_id AS id_equipo
      FROM api_maquina m
      JOIN api_equipo e ON m.id_equipo = e.chanel_id
      WHERE m.id_Maquina = ?
    `,
      [idMaquina]
    );

    if (maquinas.length === 0) {
      return { exists: false };
    }

    const maquina = maquinas[0];

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
      [maquina.id_equipo]
    );

    if (ultimaLectura.length === 0) {
      return {
        exists: true,
        estado: "SIN_DATOS",
        semaforo: "GRIS",
        ultima_lectura: null,
        maquina,
      };
    }

    const lectura = ultimaLectura[0];

    // Determinar estado online/offline basado en la última lectura
    const tiempoTranscurrido =
      Date.now() - new Date(lectura.fecha_lectura).getTime();
    const estadoConexion =
      tiempoTranscurrido < 5 * 60 * 1000 ? "ONLINE" : "OFFLINE"; // 5 minutos

    // Obtener rangos de temperatura
    const rangos = await equipoService.obtenerRangosTemperatura();

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

    // Verificar si hay faena activa
    const [faena] = await databaseService.pool.query(
      `
      SELECT id_Faena, id_Faena_externo, id_cliente
      FROM api_faena
      WHERE id_maquina = ? AND fecha_fin IS NULL
      LIMIT 1
    `,
      [maquina.id_Maquina]
    );

    const faenaActiva = faena.length > 0 ? faena[0] : null;

    return {
      exists: true,
      estado: estadoConexion,
      semaforo: semaforo,
      ultima_lectura: lectura,
      maquina: maquina,
      faena_activa: faenaActiva,
    };
  }

  /**
   * Actualiza información de una máquina (identificador_externo o equipo asociado)
   * @param {number} idMaquina - ID de la máquina a actualizar
   * @param {Object} datos - Datos a actualizar
   * @param {string} [datos.identificador_externo] - Nuevo identificador externo
   * @param {number} [datos.id_equipo] - Nuevo ID de equipo a asociar
   * @param {number} idUsuario - ID del usuario que realiza la modificación
   * @returns {Promise<Object>} Resultado de la operación
   */
  async actualizarMaquina(idMaquina, datos, idUsuario) {
    const connection = await databaseService.pool.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar que la máquina existe
      const [maquina] = await connection.query(
        "SELECT m.id_Maquina, m.identificador_externo, m.id_equipo FROM api_maquina m WHERE m.id_Maquina = ?",
        [idMaquina]
      );

      if (maquina.length === 0) {
        await connection.rollback();
        throw new NotFoundError("Máquina no encontrada");
      }

      const maquinaActual = maquina[0];
      const idEquipoAntiguo = maquinaActual.id_equipo;

      // Actualizar el identificador externo si se proporcionó
      if (
        datos.identificador_externo &&
        datos.identificador_externo !== maquinaActual.identificador_externo
      ) {
        // Verificar que el nuevo identificador no exista para otra máquina
        const [maquinasExistentes] = await connection.query(
          "SELECT id_Maquina FROM api_maquina WHERE identificador_externo = ? AND id_Maquina != ?",
          [datos.identificador_externo, idMaquina]
        );

        if (maquinasExistentes.length > 0) {
          await connection.rollback();
          throw new ValidationError(
            "Ya existe una máquina con este identificador"
          );
        }

        // Actualizar el identificador
        await connection.query(
          "UPDATE api_maquina SET identificador_externo = ?, fecha_actualizacion = NOW() WHERE id_Maquina = ?",
          [datos.identificador_externo, idMaquina]
        );

        // Registrar el cambio en el log
        await loggingService.registrarModificacionUsuario(
          idUsuario,
          "MAQUINA",
          idMaquina,
          "identificador_externo",
          maquinaActual.identificador_externo,
          datos.identificador_externo
        );
      }

      // Actualizar el equipo si se proporcionó
      if (datos.id_equipo && datos.id_equipo !== idEquipoAntiguo) {
        // Verificar que el equipo existe
        const [equipos] = await connection.query(
          "SELECT chanel_id FROM api_equipo WHERE chanel_id = ?",
          [datos.id_equipo]
        );

        if (equipos.length === 0) {
          await connection.rollback();
          throw new ValidationError("Equipo no encontrado");
        }

        // Verificar si el equipo ya está asociado a otra máquina
        const [maquinasAsociadas] = await connection.query(
          "SELECT id_Maquina FROM api_maquina WHERE id_equipo = ? AND id_Maquina != ?",
          [datos.id_equipo, idMaquina]
        );

        if (maquinasAsociadas.length > 0) {
          await connection.rollback();
          throw new ValidationError(
            "El equipo ya está asociado a otra máquina"
          );
        }

        // Actualizar el equipo
        await connection.query(
          "UPDATE api_maquina SET id_equipo = ?, fecha_actualizacion = NOW() WHERE id_Maquina = ?",
          [datos.id_equipo, idMaquina]
        );

        // Registrar el cambio en el log de equipos
        await loggingService.registrarCambioEquipoMaquina(
          idMaquina,
          idEquipoAntiguo,
          datos.id_equipo
        );
      }

      await connection.commit();

      return {
        success: true,
        message: "Máquina actualizada correctamente",
        id_Maquina: idMaquina,
      };
    } catch (error) {
      await connection.rollback();
      // Registrar el error
      await loggingService.registrarError(
        "MaquinaService.actualizarMaquina",
        `Error al actualizar máquina ${idMaquina}`,
        error
      );
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtiene datos históricos consolidados para una máquina por su identificador externo
   * @param {string} identificadorExterno - Identificador externo de la máquina
   * @param {string} fechaInicio - Fecha de inicio del rango (opcional)
   * @param {string} fechaFin - Fecha de fin del rango (opcional)
   * @param {number} idFaena - ID de faena específica (opcional)
   * @returns {Promise<Object>} Datos históricos organizados para visualización
   */
  async obtenerHistoricoConsolidado(
    identificadorExterno,
    fechaInicio,
    fechaFin,
    idFaena
  ) {
    try {
      // Verificar si la máquina existe
      const [maquinas] = await databaseService.pool.query(
        `
      SELECT m.id_Maquina, m.id_equipo
      FROM api_maquina m
      WHERE m.identificador_externo = ?
    `,
        [identificadorExterno]
      );

      if (maquinas.length === 0) {
        throw new NotFoundError("Máquina no encontrada");
      }

      const idMaquina = maquinas[0].id_Maquina;
      const idEquipo = maquinas[0].id_equipo;

      // Implementar la lógica de fechas según los requisitos
      let fechaInicioActual = fechaInicio;
      let fechaFinActual = fechaFin;

      const hoy = new Date();

      // Caso 1: Solo hay fecha de inicio
      if (fechaInicioActual && !fechaFinActual) {
        const fechaInicioObj = new Date(fechaInicioActual);
        const fechaTresMesesDespues = new Date(fechaInicioObj);
        fechaTresMesesDespues.setMonth(fechaTresMesesDespues.getMonth() + 3);

        // Si la fecha calculada es posterior a hoy, usar hoy
        if (fechaTresMesesDespues > hoy) {
          fechaFinActual = hoy.toISOString().split("T")[0];
        } else {
          fechaFinActual = fechaTresMesesDespues.toISOString().split("T")[0];
        }
      }

      // Caso 2: Solo hay fecha de fin
      if (!fechaInicioActual && fechaFinActual) {
        const fechaFinObj = new Date(fechaFinActual);
        const fechaTresMesesAntes = new Date(fechaFinObj);
        fechaTresMesesAntes.setMonth(fechaTresMesesAntes.getMonth() - 3);

        fechaInicioActual = fechaTresMesesAntes.toISOString().split("T")[0];
      }

      // Construir consulta base para faenas
      let queryFaenas = `
      SELECT 
        f.id_Faena,
        f.id_Faena_externo,
        f.fecha_inico AS fecha_inicio,
        f.fecha_fin,
        c.nombre_cliente
      FROM api_faena f
      JOIN api_clientes c ON f.id_cliente = c.idClientes
      WHERE f.id_maquina = ?
    `;

      const queryParamsFaenas = [idMaquina];

      // Aplicar filtros para las faenas con las fechas actualizadas
      if (idFaena) {
        queryFaenas += " AND f.id_Faena = ?";
        queryParamsFaenas.push(idFaena);
      } else {
        if (fechaInicioActual) {
          queryFaenas += " AND (f.fecha_fin >= ? OR f.fecha_fin IS NULL)";
          queryParamsFaenas.push(fechaInicioActual);
        }

        if (fechaFinActual) {
          queryFaenas += " AND f.fecha_inico <= ?";
          queryParamsFaenas.push(fechaFinActual);
        }
      }

      queryFaenas += " ORDER BY f.fecha_inico";

      const [faenas] = await databaseService.pool.query(
        queryFaenas,
        queryParamsFaenas
      );

      // Si no hay faenas que coincidan con los criterios
      if (faenas.length === 0) {
        return {
          success: true,
          identificador_externo: identificadorExterno,
          id_maquina: idMaquina,
          periodo: {
            fecha_inicio: fechaInicioActual,
            fecha_fin: fechaFinActual,
          },
          faenas: [],
          datos: [],
        };
      }

      // Obtener datos para cada faena o para el rango específico
      let datosPorFaena = [];

      for (const faena of faenas) {
        // Consulta para datos por faena
        let queryDatos = `
        SELECT 
          df.timestamp_dato,
          df.temperatura,
          df.latitud,
          df.longitud,
          df.calidad_temperatura,
          ? AS id_faena
        FROM api_datos_por_faena df
        WHERE df.id_faena = ?
      `;

        const queryParamsDatos = [faena.id_Faena, faena.id_Faena];

        // Aplicar filtros adicionales de fecha si no es una faena específica
        if (!idFaena) {
          if (fechaInicioActual) {
            queryDatos += " AND df.timestamp_dato >= ?";
            queryParamsDatos.push(fechaInicioActual);
          }

          if (fechaFinActual) {
            queryDatos += " AND df.timestamp_dato <= ?";
            queryParamsDatos.push(fechaFinActual);
          }
        }

        queryDatos += " ORDER BY df.timestamp_dato";

        const [datos] = await databaseService.pool.query(
          queryDatos,
          queryParamsDatos
        );

        // Agregar datos a la faena
        faena.datos = datos;
        datosPorFaena = datosPorFaena.concat(datos);
      }

      // Si se pidió una faena específica, obtener también su resumen
      let resumen = null;
      if (idFaena) {
        const [datosResumen] = await databaseService.pool.query(
          `
        SELECT *
        FROM api_resumen_Datos_por_faena
        WHERE id_faena = ?
        ORDER BY cuarto
      `,
          [idFaena]
        );

        resumen = datosResumen;
      }

      return {
        success: true,
        identificador_externo: identificadorExterno,
        id_maquina: idMaquina,
        id_equipo: idEquipo,
        periodo: {
          fecha_inicio: fechaInicioActual,
          fecha_fin: fechaFinActual,
        },
        faenas: faenas,
        datos_consolidados: datosPorFaena,
        resumen: resumen,
      };
    } catch (error) {
      await loggingService.registrarError(
        "MaquinaService.obtenerHistoricoConsolidado",
        `Error al obtener histórico consolidado para máquina ${identificadorExterno}`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene datos en tiempo real (últimos 5 minutos) de máquinas con faenas activas
   * @param {string} [identificadorExterno] - Identificador externo de la máquina (opcional)
   * @returns {Promise<Object>} Datos en tiempo real de las máquinas
   */
  async obtenerDatosRealtime(identificadorExterno) {
    try {
      // Base de la consulta para obtener máquinas con faenas activas
      let queryMaquinas = `
        SELECT 
          m.id_Maquina,
          m.identificador_externo,
          f.id_Faena,
          f.id_Faena_externo,
          f.fecha_inico AS fecha_inicio,
          c.nombre_cliente
        FROM api_maquina m
        JOIN api_faena f ON m.id_Maquina = f.id_maquina
        JOIN api_clientes c ON f.id_cliente = c.idClientes
        WHERE f.fecha_fin IS NULL
      `;

      const queryParamsMaquinas = [];

      // Si se proporciona identificador externo, filtrar por él
      if (identificadorExterno) {
        queryMaquinas += " AND m.identificador_externo = ?";
        queryParamsMaquinas.push(identificadorExterno);
      }

      // Ejecutar consulta para obtener máquinas con faenas activas
      const [maquinas] = await databaseService.pool.query(
        queryMaquinas,
        queryParamsMaquinas
      );

      // Si no hay máquinas con faenas activas que coincidan con los criterios
      if (maquinas.length === 0) {
        return {
          success: true,
          message:
            "No hay máquinas con faenas activas que coincidan con los criterios",
          data: [],
          timestamp: new Date(),
        };
      }

      // Obtener rangos de temperatura para calcular el semáforo
      const rangos = await equipoService.obtenerRangosTemperatura();

      // Obtener datos de los últimos 5 minutos para cada máquina con faena activa
      const resultado = {
        success: true,
        data: [],
        timestamp: new Date(),
      };

      for (const maquina of maquinas) {
        // Consulta para obtener datos recientes (últimos 5 minutos) de la tabla api_datos_por_faena
        const queryDatos = `
          SELECT 
            df.timestamp_dato AS timestamp,
            df.temperatura,
            df.latitud,
            df.longitud,
            df.calidad_temperatura
          FROM api_datos_por_faena df
          WHERE df.id_faena = ?
          AND df.timestamp_dato >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
          ORDER BY df.timestamp_dato DESC
        `;

        const [datos] = await databaseService.pool.query(queryDatos, [
          maquina.id_Faena,
        ]);

        // Calcular el semáforo para cada lectura basado en los rangos de temperatura
        const datosConSemaforo = datos.map((dato) => {
          let semaforo = "GRIS";

          if (rangos && dato.temperatura !== null) {
            const temperatura = dato.temperatura;

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

          return {
            ...dato,
            semaforo,
          };
        });

        // Añadir la información de la máquina y sus datos al resultado
        resultado.data.push({
          id_Maquina: maquina.id_Maquina,
          identificador_externo: maquina.identificador_externo,
          faena: {
            id_Faena: maquina.id_Faena,
            id_Faena_externo: maquina.id_Faena_externo,
            fecha_inicio: maquina.fecha_inicio,
            nombre_cliente: maquina.nombre_cliente,
          },
          lecturas: datosConSemaforo,
          total_lecturas: datosConSemaforo.length,
          ultima_lectura:
            datosConSemaforo.length > 0 ? datosConSemaforo[0] : null,
        });
      }

      return resultado;
    } catch (error) {
      await loggingService.registrarError(
        "MaquinaService.obtenerDatosRealtime",
        `Error al obtener datos en tiempo real ${
          identificadorExterno ? "para " + identificadorExterno : ""
        }`,
        error
      );
      throw error;
    }
  }
}

module.exports = new MaquinaService();

// src/services/ubibotService.js

const mysql = require("mysql2/promise");
const configLoader = require("../config/js_files/config-loader"); // Corregido: usar configLoader directamente
const { convertToMySQLDateTime } = require("../utils/transformUtils");
const moment = require("moment-timezone");
const notificationController = require("../controllers/notificationController");

// Variable para el pool, se inicializará después de cargar la config
let pool = null;

// Función para inicializar el pool (se llamará una vez)
function initializePool() {
  if (pool) return; // Evitar reinicialización
  try {
    const dbConfig = configLoader.getConfig().database;
    pool = mysql.createPool({
      host: dbConfig.host,
      user: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: dbConfig.pool?.max_size || 10,
      queueLimit: 0,
    });
    console.log("[UbibotService] Pool de conexiones MySQL inicializado.");
  } catch (error) {
    console.error("❌ [UbibotService] Error CRÍTICO al inicializar el pool de conexiones:", error.message);
    // Si falla el pool, el servicio no puede funcionar. Podríamos lanzar el error.
    throw error;
  }
}

class UbibotService {
  constructor() {
    // Cargar configuración específica de Ubibot
    try {
      const { ubibot: ubibotConfig, alertSystem } = configLoader.getConfig();

      // *** CORRECCIÓN AQUÍ: Usar snake_case y validar ***
      const accountKeyValue = ubibotConfig?.account_key;
      const tokenFilePathValue = ubibotConfig?.token_file;

      // Validar que ambos valores existen y no están vacíos
      if (!accountKeyValue || typeof accountKeyValue !== 'string' || accountKeyValue.trim() === '') {
        // Ya no es solo advertencia, si el servicio necesita la key, debería ser error
        console.error("❌ [UbibotService] Configuración crítica faltante o vacía: ubibot.account_key en constructor.");
        // Lanzar error si este servicio REALMENTE necesita la key directamente
        // throw new Error("Falta account_key de Ubibot en la configuración para UbibotService.");
        this.accountKey = null; // Marcar como nulo si falta
      } else {
        this.accountKey = accountKeyValue.trim(); // Guardar sin espacios
      }

      if (!tokenFilePathValue || typeof tokenFilePathValue !== 'string' || tokenFilePathValue.trim() === '') {
        // Ya no es solo advertencia
        console.error("❌ [UbibotService] Configuración crítica faltante o vacía: ubibot.token_file en constructor.");
        // Lanzar error si este servicio REALMENTE necesita la ruta directamente
        // throw new Error("Falta token_file de Ubibot en la configuración para UbibotService.");
        this.tokenFile = null; // Marcar como nulo si falta
      } else {
        this.tokenFile = tokenFilePathValue;
      }
      // *** FIN DE LA CORRECCIÓN ***

      this.timeZone = alertSystem?.timeZone || "America/Santiago";

      // Asegurar que el pool se inicialice
      if (!pool) {
        initializePool();
      }

      console.log("✅ UbibotService inicializado/instanciado.");
      // Loguear valores leídos (opcional)
      // console.log(`  -> Service Account Key: ${this.accountKey ? 'Leída' : 'Faltante'}`);
      // console.log(`  -> Service Token File Path: ${this.tokenFile ? 'Leído' : 'Faltante'}`);


    } catch (error) {
      console.error("💥 [UbibotService] Error CRÍTICO en el constructor:", error.message);
      throw error;
    }
  }

  /**
   * Obtiene una conexión del pool.
   * @private
   * @returns {Promise<mysql.PoolConnection>} Conexión a la base de datos.
   * @throws {Error} Si el pool no está inicializado.
   */
  async _getConnection() {
    if (!pool) {
      console.error("❌ [UbibotService] Intento de obtener conexión pero el pool no está inicializado.");
      throw new Error("Pool de base de datos no inicializado para UbibotService.");
    }
    return await pool.getConnection();
  }


  /**
   * Convierte una fecha/hora UTC a una fecha/hora en la zona horaria configurada.
   * @param {string|Date} utcTime - Fecha/hora en UTC.
   * @returns {moment.Moment} Fecha/hora local.
   */
  getLocalTime(utcTime) {
    return moment.utc(utcTime).tz(this.timeZone);
  }

  /**
   * Procesa los datos de un canal de Ubibot recibidos de la API.
   * Actualiza la información del canal en la base de datos, incluyendo su estado de conexión.
   * @param {Object} channelData - Datos del canal obtenidos de la API de Ubibot.
   * @returns {Promise<boolean>} true si el procesamiento fue exitoso.
   */
  async processChannelData(channelData) {
    if (!channelData || !channelData.channel_id) {
      console.warn("[UbibotService] processChannelData: Se recibieron datos de canal inválidos o sin channel_id.");
      return false;
    }
    console.log(`[UbibotService] processChannelData: Procesando canal ${channelData.channel_id} (${channelData.name || 'Sin Nombre'})...`);

    const connection = await this._getConnection(); // Obtener conexión
    try {
      // 1. Buscar canal existente en la BD
      const [existingChannelRows] = await connection.query(
        "SELECT * FROM channels_ubibot WHERE channel_id = ?",
        [channelData.channel_id]
      );
      const existingChannel = existingChannelRows[0]; // Puede ser undefined si no existe

      // 2. Preparar información básica y estado actual de la API
      const basicInfo = {
        product_id: channelData.product_id,
        device_id: channelData.device_id,
        latitude: channelData.latitude,
        longitude: channelData.longitude,
        firmware: channelData.firmware,
        mac_address: channelData.mac_address,
        // Convertir fechas a objetos Date para comparación y guardado
        last_entry_date: channelData.last_entry_date ? new Date(channelData.last_entry_date) : null,
        created_at: channelData.created_at ? new Date(channelData.created_at) : null,
        // Añadir 'name' también a basicInfo para actualizarlo si cambia
        name: channelData.name || `Canal ${channelData.channel_id}`,
      };
      // Determinar estado online/offline según API
      const isOnline = channelData.net === "1" || channelData.net === 1;
      const currentTime = new Date(); // Timestamp para 'ahora'

      // 3. Insertar o Actualizar Canal
      if (!existingChannel) {
        // Canal Nuevo: Insertar con estado inicial
        console.log(`[UbibotService] processChannelData: Canal ${channelData.channel_id} es nuevo. Insertando...`);
        const newChannelData = {
          ...basicInfo,
          channel_id: channelData.channel_id,
          // name: ya está en basicInfo
          is_currently_out_of_range: isOnline ? 0 : 1,
          out_of_range_since: isOnline ? null : currentTime, // Marcar inicio de offline si aplica
          last_alert_sent: null, // Nuevo canal, sin alertas previas
          esOperativa: 1, // Default a operativo
          id_parametrizacion: 7, // Default o buscar uno adecuado? Por ahora 7
          ubicacion_real: 1, // Default o buscar uno adecuado? Por ahora 1
        };
        await connection.query("INSERT INTO channels_ubibot SET ?", newChannelData);
        console.log(`[UbibotService] processChannelData: Canal ${channelData.channel_id} insertado.`);
        // Para un canal nuevo, SÍ queremos notificar si nace offline y es operativo
        if (!isOnline && newChannelData.esOperativa === 1) {
          await this.updateConnectionStatus(connection, channelData.channel_id, newChannelData.name, isOnline, false /*wasOffline=false*/, true /*isOperational=true*/, null /*currentChannel=null*/, currentTime);
        }

      } else {
        // Canal Existente: Actualizar info básica y estado de conexión
        console.log(`[UbibotService] processChannelData: Canal ${channelData.channel_id} existe. Verificando actualizaciones...`);
        const wasOffline = existingChannel.is_currently_out_of_range === 1;
        const isOperational = existingChannel.esOperativa === 1; // Leer estado operativo de la BD

        // Actualizar información básica solo si ha cambiado
        // Comparación cuidadosa, especialmente con fechas y nulos
        const fieldsToUpdate = {};
        let hasChanges = false;
        for (const key in basicInfo) {
          let apiValue = basicInfo[key];
          let dbValue = existingChannel[key];

          // Tratar fechas como timestamps para comparación robusta
          if (apiValue instanceof Date) apiValue = apiValue.getTime();
          if (dbValue instanceof Date) dbValue = dbValue.getTime();
          // Considerar nulos equivalentes a string vacío o 0 si aplica? Depende del campo.
          // Por ahora, comparación directa (con manejo de fechas)
          if (apiValue !== dbValue) {
            // Loguear qué cambió
            // console.log(` -> Cambio detectado en ${key}: DB='${dbValue}', API='${apiValue}'`);
            fieldsToUpdate[key] = basicInfo[key]; // Usar el valor original (con objeto Date si es fecha)
            hasChanges = true;
          }
        }

        if (hasChanges) {
          console.log(`[UbibotService] processChannelData: Actualizando ${Object.keys(fieldsToUpdate).length} campos básicos para canal ${channelData.channel_id}...`);
          await connection.query(
            "UPDATE channels_ubibot SET ? WHERE channel_id = ?",
            [fieldsToUpdate, channelData.channel_id]
          );
        } else {
          console.log(`[UbibotService] processChannelData: Sin cambios en datos básicos para canal ${channelData.channel_id}.`);
        }

        // Actualizar estado de conexión (esto llamará a notificationController si es necesario)
        await this.updateConnectionStatus(
          connection,
          channelData.channel_id,
          existingChannel.name, // Usar nombre de BD para consistencia en logs
          isOnline,
          wasOffline,
          isOperational, // Pasar estado operativo leído de BD
          existingChannel, // Pasar datos actuales de BD
          currentTime
        );
      }
      return true; // Indicar éxito
    } catch (error) {
      console.error(`❌ [UbibotService] Error en processChannelData para canal ${channelData.channel_id}:`, error.message);
      // console.error(error.stack); // Opcional: log stack trace
      return false; // Indicar fallo
    } finally {
      // Asegurar que la conexión se libera siempre
      if (connection) connection.release();
      console.log(`[UbibotService] processChannelData: Conexión liberada para canal ${channelData.channel_id}.`);
    }
  }

  /**
   * Actualiza el estado de conexión de un canal en la BD y notifica al controlador si es operativo.
   * @param {mysql.PoolConnection} connection - Conexión activa a la base de datos.
   * @param {string} channelId - ID del canal.
   * @param {string} channelName - Nombre del canal.
   * @param {boolean} isOnline - Si el canal está en línea según API.
   * @param {boolean} wasOffline - Si el canal estaba previamente marcado como offline en BD.
   * @param {boolean} isOperational - Si el canal está marcado como operativo en BD.
   * @param {Object|null} currentChannel - Datos actuales del canal leídos de la BD (o null si es nuevo).
   * @param {Date} currentTime - Timestamp del evento actual.
   * @returns {Promise<boolean>} - true si la operación fue exitosa (o ignorada correctamente).
   */
  async updateConnectionStatus(
    connection,
    channelId,
    channelName,
    isOnline,
    wasOffline,
    isOperational,
    currentChannel,
    currentTime
  ) {
    console.log(`[UbibotService] updateConnectionStatus: Canal ${channelId}, isOnline=${isOnline}, wasOffline=${wasOffline}, isOperational=${isOperational}`);

    try {
      // *** PASO 1: IGNORAR SI NO ES OPERATIVO ***
      if (!isOperational) {
        console.log(`[UbibotService] updateConnectionStatus: Canal ${channelId} (${channelName ?? 'N/A'}) está marcado como NO operativo. Evento ignorado para notificaciones.`);
        // Aún así, actualizar el estado en la BD para reflejar la realidad
        if (isOnline && wasOffline) {
          await connection.query("UPDATE channels_ubibot SET is_currently_out_of_range = 0 WHERE channel_id = ?", [channelId]);
        } else if (!isOnline && !wasOffline) {
          await connection.query("UPDATE channels_ubibot SET is_currently_out_of_range = 1, out_of_range_since = ? WHERE channel_id = ?", [currentTime, channelId]);
        }
        return true; // Ignorado correctamente
      }
      // *** FIN PASO 1 ***

      // --- Lógica de Actualización BD y Notificación (SOLO SI ES OPERATIVO) ---
      let stateChanged = false;
      let eventTimestampForNotification = currentTime;

      if (isOnline) {
        // Evento ONLINE recibido
        if (wasOffline) {
          // Cambio: Offline -> Online (Reconexión)
          stateChanged = true;
          console.log(`[UbibotService] updateConnectionStatus: Detectada RECONEXIÓN para canal ${channelId}.`);
          await connection.query(
            "UPDATE channels_ubibot SET is_currently_out_of_range = 0 WHERE channel_id = ?",
            [channelId]
          );
          console.log(`  -> Estado en BD actualizado a ONLINE.`);
          // La hora de reconexión es 'currentTime'
          eventTimestampForNotification = currentTime;
        } else {
          // Ya estaba Online, no hay cambio de estado relevante para notificar conexión/desconexión
          console.log(`[UbibotService] updateConnectionStatus: Canal ${channelId} ya estaba ONLINE. Sin cambios de estado.`);
        }
      } else {
        // Evento OFFLINE recibido
        if (!wasOffline) {
          // Cambio: Online -> Offline (Nueva Desconexión)
          stateChanged = true;
          console.log(`[UbibotService] updateConnectionStatus: Detectada NUEVA DESCONEXIÓN para canal ${channelId}.`);
          await connection.query(
            "UPDATE channels_ubibot SET is_currently_out_of_range = 1, out_of_range_since = ? WHERE channel_id = ?",
            [currentTime, channelId]
          );
          console.log(`  -> Estado en BD actualizado a OFFLINE. out_of_range_since = ${currentTime.toISOString()}`);
          // La hora de desconexión es 'currentTime'
          eventTimestampForNotification = currentTime;
        } else {
          // Ya estaba Offline, no hay cambio de estado, pero el evento podría ser relevante si la notificación falló?
          // Por ahora, no notificamos de nuevo si ya estaba offline.
          console.log(`[UbibotService] updateConnectionStatus: Canal ${channelId} ya estaba OFFLINE. Sin cambios de estado.`);
        }
      }

      // Notificar al controlador SOLO si hubo un cambio de estado relevante Y es operativo
      if (stateChanged) {
        console.log(`[UbibotService] updateConnectionStatus: Hubo cambio de estado, llamando a notificationController para canal ${channelId}...`);
        await notificationController.processConnectionStatusChange(
          channelId,
          channelName ?? `Canal ${channelId}`, // Nombre
          isOnline,                            // Estado actual
          wasOffline,                          // Estado anterior
          // Timestamp del evento relevante:
          // - Si se reconectó, pasar el 'out_of_range_since' original de la BD (cuándo empezó el offline)
          // - Si se desconectó ahora, pasar 'currentTime'
          isOnline ? currentChannel?.out_of_range_since : currentTime,
          currentChannel?.last_alert_sent,     // Pasar el último estado de alerta
          isOperational                        // Pasar true (ya validado)
        );
        console.log(`[UbibotService] updateConnectionStatus: Llamada a notificationController completada para canal ${channelId}.`);
      }

      return true; // Indicar éxito

    } catch (error) {
      console.error(`❌ [UbibotService] Error en updateConnectionStatus para canal ${channelId}:`, error.message);
      // console.error(error.stack); // Opcional
      return false; // Indicar fallo
    }
  }


  /**
   * Procesa las lecturas de sensores (temperatura, etc.) y las inserta en la BD.
   * Llama a la verificación de parámetros para posibles alertas de temperatura.
   * @param {string} channelId - ID del canal.
   * @param {Object} lastValues - Objeto con los últimos valores leídos (ya parseado).
   * @returns {Promise<boolean>} true si el procesamiento fue exitoso.
   */
  async processSensorReadings(channelId, lastValues) {
    // Validar entrada
    if (!channelId || !lastValues || typeof lastValues !== 'object') {
      console.warn(`[UbibotService] processSensorReadings: Datos inválidos para canal ${channelId}.`);
      return false;
    }
    // Verificar timestamp clave (ej. field1)
    if (!lastValues.field1?.created_at) {
      console.warn(`[UbibotService] processSensorReadings: Timestamp faltante en field1 para canal ${channelId}.`);
      return false;
    }
    console.log(`[UbibotService] processSensorReadings: Procesando lecturas para canal ${channelId}...`);

    const connection = await this._getConnection();
    try {
      // Convertir timestamp principal a objetos Date y Moment
      const utcTimestamp = moment.utc(lastValues.field1.created_at);
      if (!utcTimestamp.isValid()) {
        console.error(`[UbibotService] processSensorReadings: Timestamp inválido en field1 para canal ${channelId}: ${lastValues.field1.created_at}`);
        return false;
      }
      const santiagoTime = this.getLocalTime(utcTimestamp);
      const utcDateObject = utcTimestamp.toDate();

      // Preparar datos para inserción, asegurando valores numéricos o null
      const dataToInsert = {
        channel_id: channelId,
        timestamp: utcDateObject, // Guardar como objeto Date (o string ISO si prefieres)
        temperature: lastValues.field1?.value !== undefined ? parseFloat(lastValues.field1.value) : null,
        humidity: lastValues.field2?.value !== undefined ? parseFloat(lastValues.field2.value) : null,
        light: lastValues.field3?.value !== undefined ? parseFloat(lastValues.field3.value) : null,
        voltage: lastValues.field4?.value !== undefined ? parseFloat(lastValues.field4.value) : null,
        wifi_rssi: lastValues.field5?.value !== undefined ? parseInt(lastValues.field5.value, 10) : null, // RSSI suele ser entero
        external_temperature: lastValues.field8?.value !== undefined ? parseFloat(lastValues.field8.value) : null,
        external_temperature_timestamp: lastValues.field8?.created_at ? convertToMySQLDateTime(lastValues.field8.created_at) : null, // Formato MySQL
        insercion: santiagoTime.format("YYYY-MM-DD HH:mm:ss"), // Hora local para referencia
      };

      // Reemplazar NaN con null después de parseFloat/parseInt
      for (const key in dataToInsert) {
        if (Number.isNaN(dataToInsert[key])) {
          dataToInsert[key] = null;
        }
      }

      // Insertar en la base de datos
      await connection.query("INSERT INTO sensor_readings_ubibot SET ?", dataToInsert);
      console.log(`[UbibotService] processSensorReadings: Datos insertados para canal ${channelId} (Timestamp UTC: ${utcTimestamp.format()})`);

      // Verificar parámetros para alertas de temperatura (usando los datos parseados)
      await this.checkParametersAndNotify(channelId, lastValues); // Pasar lastValues original aquí

      return true; // Éxito

    } catch (error) {
      console.error(`❌ [UbibotService] Error en processSensorReadings para canal ${channelId}:`, error.message);
      // console.error(error.stack); // Opcional
      return false; // Fallo
    } finally {
      if (connection) connection.release();
      console.log(`[UbibotService] processSensorReadings: Conexión liberada para canal ${channelId}.`);
    }
  }

  /**
   * Verifica si la temperatura externa está fuera de los rangos definidos y notifica.
   * @param {string} channelId - ID del canal.
   * @param {Object} lastValues - Objeto con los últimos valores leídos (ya parseado).
   * @returns {Promise<boolean>} true si la verificación se completó (no indica si hubo alerta).
   */
  async checkParametersAndNotify(channelId, lastValues) {
    // Validar que tenemos datos de temperatura externa (field8)
    if (!lastValues?.field8?.value || !lastValues.field8.created_at) {
      // console.log(`[UbibotService] checkParametersAndNotify: Canal ${channelId} sin datos de temperatura externa (field8) válidos.`);
      return false; // No podemos verificar sin datos
    }
    console.log(`[UbibotService] checkParametersAndNotify: Verificando parámetros para canal ${channelId}...`);

    const connection = await this._getConnection();
    try {
      // Obtener la información del canal y sus parámetros de temperatura
      const [channelInfoRows] = await connection.query(
        `SELECT c.name, c.esOperativa, p.minimo AS minima_temp_camara, p.maximo AS maxima_temp_camara
           FROM channels_ubibot c
           LEFT JOIN parametrizaciones p ON c.id_parametrizacion = p.param_id
           WHERE c.channel_id = ?`, // Usar LEFT JOIN por si no tiene parametrización
        [channelId]
      );

      if (channelInfoRows.length === 0) {
        console.warn(`[UbibotService] checkParametersAndNotify: Canal ${channelId} no encontrado en BD. No se puede verificar.`);
        return false;
      }
      const channelInfo = channelInfoRows[0];
      const { name: channelName, esOperativa, minima_temp_camara, maxima_temp_camara } = channelInfo;

      // Convertir estado operativo a booleano
      const isOperational = esOperativa === 1;

      // 1. IGNORAR SI NO ES OPERATIVO
      if (!isOperational) {
        console.log(`[UbibotService] checkParametersAndNotify: Canal ${channelId} (${channelName}) NO operativo. Verificación de temperatura ignorada.`);
        return true; // Completado (ignorando)
      }

      // 2. VALIDAR PARÁMETROS DE TEMPERATURA
      if (minima_temp_camara === null || maxima_temp_camara === null) {
        console.warn(`[UbibotService] checkParametersAndNotify: Canal ${channelId} (${channelName}) no tiene umbrales de temperatura definidos en parametrizaciones. No se puede verificar.`);
        return false; // No se puede verificar sin umbrales
      }

      // 3. OBTENER Y VALIDAR TEMPERATURA ACTUAL
      const temperature = parseFloat(lastValues.field8.value);
      if (isNaN(temperature)) {
        console.warn(`[UbibotService] checkParametersAndNotify: Valor de temperatura inválido para canal ${channelId}: ${lastValues.field8.value}`);
        return false; // No se puede verificar temperatura inválida
      }
      // Obtener timestamp asociado a esta lectura de temperatura
      const timestamp = moment(lastValues.field8.created_at).tz(this.timeZone).format("YYYY-MM-DD HH:mm:ss");

      console.log(`[UbibotService] checkParametersAndNotify: Canal ${channelId} (${channelName}): Temp=${temperature.toFixed(2)}°C, Rango=[${minima_temp_camara}°C, ${maxima_temp_camara}°C]`);

      // 4. PROCESAR LECTURA CON NOTIFICATION CONTROLLER
      // Es responsabilidad del notificationController decidir si está fuera de rango y si debe generar alerta
      await notificationController.processTemperatureReading(
        channelId,
        channelName ?? `Canal ${channelId}`,
        temperature,
        timestamp, // Timestamp de la lectura de temperatura externa
        parseFloat(minima_temp_camara), // Asegurar que los umbrales son números
        parseFloat(maxima_temp_camara),
        isOperational // Pasar el estado operativo (sabemos que es true aquí)
      );
      console.log(`[UbibotService] checkParametersAndNotify: Lectura procesada por notificationController para ${channelId}.`);

      return true; // Verificación completada

    } catch (error) {
      console.error(`❌ [UbibotService] Error en checkParametersAndNotify para canal ${channelId}:`, error.message);
      // console.error(error.stack); // Opcional
      return false; // Indicar fallo
    } finally {
      if (connection) connection.release();
      // console.log(`[UbibotService] checkParametersAndNotify: Conexión liberada para canal ${channelId}.`); // Log opcional
    }
  }

  /**
   * Obtiene el timestamp de la última lectura registrada para un canal.
   * @param {string} channelId - ID del canal.
   * @returns {Promise<Object|null>} Objeto con { external_temperature_timestamp } o null.
   */
  async getLastSensorReading(channelId) {
    // console.log(`[UbibotService] getLastSensorReading: Buscando última lectura para canal ${channelId}...`); // Log opcional
    if (!channelId) return null;
    const connection = await this._getConnection();
    try {
      // Optimizar para seleccionar solo el campo necesario
      const [rows] = await connection.query(
        "SELECT MAX(external_temperature_timestamp) AS external_temperature_timestamp FROM sensor_readings_ubibot WHERE channel_id = ?",
        [channelId]
      );
      // rows[0] contendrá { external_temperature_timestamp: fecha } o { external_temperature_timestamp: null }
      // console.log(`[UbibotService] getLastSensorReading: Resultado para ${channelId}:`, rows[0]); // Log opcional
      return rows[0]; // Devolver el objeto directamente (puede tener valor null)
    } catch (error) {
      console.error(`❌ [UbibotService] Error en getLastSensorReading para canal ${channelId}:`, error.message);
      return null; // Devolver null en caso de error
    } finally {
      if (connection) connection.release();
    }
  }
}

// Exportar instancia única del servicio
module.exports = new UbibotService();
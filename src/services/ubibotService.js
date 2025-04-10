// src/services/ubibotService.js

const mysql = require("mysql2/promise");
const config = require("../config/js_files/config-loader");
const { convertToMySQLDateTime } = require("../utils/transformUtils");
const moment = require("moment-timezone");
const notificationController = require("../controllers/notificationController");

// Creación del pool de conexiones
const pool = mysql.createPool({
  host: config.getConfig().database.host,
  user: config.getConfig().database.username,
  password: config.getConfig().database.password,
  database: config.getConfig().database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

class UbibotService {
  constructor() {
    const { ubibot: ubibotConfig } = config.getConfig();
    this.accountKey = ubibotConfig.accountKey;
    this.tokenFile = ubibotConfig.tokenFile;
    this.timeZone = "America/Santiago";

    console.log("✅ UbibotService inicializado");
  }

  /**
   * Convierte una fecha/hora UTC a una fecha/hora en la zona horaria de Santiago
   */
  getSantiagoTime(utcTime) {
    return moment.utc(utcTime).tz(this.timeZone);
  }

  /**
   * Procesa los datos de un canal de Ubibot.
   * Actualiza la información del canal incluyendo su estado de conexión.
   */
  async processChannelData(channelData) {
    const connection = await pool.getConnection();
    try {
      const [existingChannel] = await connection.query(
        "SELECT * FROM channels_ubibot WHERE channel_id = ?",
        [channelData.channel_id]
      );

      const basicInfo = {
        product_id: channelData.product_id,
        device_id: channelData.device_id,
        latitude: channelData.latitude,
        longitude: channelData.longitude,
        firmware: channelData.firmware,
        mac_address: channelData.mac_address,
        last_entry_date: new Date(channelData.last_entry_date),
        created_at: new Date(channelData.created_at),
      };

      // Determinar estado de conexión (1 = online, cualquier otro valor = offline)
      const isOnline = channelData.net === "1" || channelData.net === 1;
      const currentTime = new Date();

      if (existingChannel.length === 0) {
        // Si es un canal nuevo, inicializar con valores predeterminados
        await connection.query("INSERT INTO channels_ubibot SET ?", {
          ...basicInfo,
          channel_id: channelData.channel_id,
          name: channelData.name,
          is_currently_out_of_range: isOnline ? 0 : 1,
          out_of_range_since: isOnline ? null : currentTime,
          last_alert_sent: null,
        });
      } else {
        // Canal existente - actualizar información básica
        const currentChannel = existingChannel[0];
        const wasOffline = currentChannel.is_currently_out_of_range === 1;
        const isOperational = currentChannel.esOperativa === 1;

        // Actualizar información básica primero
        const hasChanges = Object.keys(basicInfo).some((key) =>
          basicInfo[key] instanceof Date
            ? basicInfo[key].getTime() !==
            new Date(currentChannel[key]).getTime()
            : basicInfo[key] !== currentChannel[key]
        );

        if (hasChanges) {
          await connection.query(
            "UPDATE channels_ubibot SET ? WHERE channel_id = ?",
            [basicInfo, channelData.channel_id]
          );
        }

        // Ahora manejamos la lógica de estado de conexión
        await this.updateConnectionStatus(
          connection,
          channelData.channel_id,
          channelData.name,
          isOnline,
          wasOffline,
          isOperational,
          currentChannel,
          currentTime
        );
      }
    } finally {
      connection.release();
    }
  }

  /**
   * Actualiza el estado de conexión de un canal
   * @param {Object} connection - Conexión a la base de datos
   * @param {string} channelId - ID del canal
   * @param {string} channelName - Nombre del canal
   * @param {boolean} isOnline - Si el canal está en línea
   * @param {boolean} wasOffline - Si el canal estaba previamente fuera de línea
   * @param {boolean} isOperational - Si el canal está operativo
   * @param {Object} currentChannel - Datos actuales del canal
   * @param {Date} currentTime - Tiempo actual
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
    try {
      if (isOnline) {
        // Si el canal está en línea ahora
        if (wasOffline) {
          // Si estaba offline, actualizar el estado a online
          await connection.query(
            "UPDATE channels_ubibot SET is_currently_out_of_range = 0 WHERE channel_id = ?",
            [channelId]
          );
          console.log(
            `Canal ${channelId} (${channelName}) está nuevamente en línea.`
          );
        }
      } else {
        // Canal está offline
        if (!wasOffline) {
          // Si acaba de quedar offline, actualizar out_of_range_since
          await connection.query(
            "UPDATE channels_ubibot SET is_currently_out_of_range = 1, out_of_range_since = ? WHERE channel_id = ?",
            [currentTime, channelId]
          );
          console.log(
            `Canal ${channelId} (${channelName}) ha quedado fuera de línea a las ${currentTime.toISOString()}.`
          );
        }
      }

      // Notificar al controlador sobre el cambio de estado de conexión
      await notificationController.processConnectionStatusChange(
        channelId,
        channelName,
        isOnline,
        wasOffline,
        currentChannel.out_of_range_since,
        currentChannel.last_alert_sent,
        isOperational
      );
    } catch (error) {
      console.error(
        `Error al actualizar estado de conexión para canal ${channelId}:`,
        error
      );
    }
  }

  /**
   * Procesa las lecturas del sensor y las inserta en la base de datos
   */
  async processSensorReadings(channelId, lastValues) {
    const connection = await pool.getConnection();
    try {
      if (!lastValues || !lastValues.field1 || !lastValues.field1.created_at) {
        console.error(
          `Ubibot: No se encontraron valores o timestamp para el canal ${channelId}`
        );
        return;
      }

      const utcTimestamp = moment.utc(lastValues.field1.created_at);
      const santiagoTime = this.getSantiagoTime(utcTimestamp);

      console.log("UTC Timestamp:", utcTimestamp.format());
      console.log("Santiago Time:", santiagoTime.format());

      await connection.query(
        "INSERT INTO sensor_readings_ubibot (channel_id, timestamp, temperature, humidity, light, voltage, wifi_rssi, external_temperature, external_temperature_timestamp, insercion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          channelId,
          utcTimestamp.toDate(),
          lastValues.field1.value,
          lastValues.field2.value,
          lastValues.field3.value,
          lastValues.field4.value,
          lastValues.field5.value,
          lastValues.field8 ? lastValues.field8.value : null,
          lastValues.field8
            ? convertToMySQLDateTime(lastValues.field8.created_at)
            : null,
          santiagoTime.format("YYYY-MM-DD HH:mm:ss"),
        ]
      );

      console.log("Inserted data:", {
        channel_id: channelId,
        timestamp: utcTimestamp.toDate(),
        insercion: santiagoTime.format("YYYY-MM-DD HH:mm:ss"),
      });

      // Verificar parámetros después de la inserción
      await this.checkParametersAndNotify(channelId, lastValues);
    } finally {
      connection.release();
    }
  }

  /**
   * Verifica los parámetros del canal y notifica si la temperatura está fuera de rango
   */
  async checkParametersAndNotify(channelId, lastValues) {
    let connection;
    try {
      connection = await pool.getConnection();

      // Obtener la información del canal
      const [channelInfo] = await connection.query(
        "SELECT c.name, c.esOperativa, p.minimo AS minima_temp_camara, p.maximo AS maxima_temp_camara " +
        "FROM channels_ubibot c " +
        "JOIN parametrizaciones p ON c.id_parametrizacion = p.param_id " +
        "WHERE c.channel_id = ?",
        [channelId]
      );

      if (channelInfo.length === 0) {
        console.log(
          `Ubibot: Canal ${channelId} no encontrado. Abortando la verificación.`
        );
        return;
      }

      const {
        name: channelName,
        esOperativa,
        minima_temp_camara,
        maxima_temp_camara,
      } = channelInfo[0];

      // Convertir a booleano explícitamente
      const isOperational = esOperativa === 1;

      // Si el canal no está operativo, ignorarlo temprano
      if (!isOperational) {
        console.log(
          `Ubibot: Canal ${channelId} (${channelName}) no operativo. Ignorando lectura.`
        );
        return;
      }

      const temperature = lastValues.field8
        ? parseFloat(lastValues.field8.value)
        : null;

      if (temperature === null) {
        console.log(
          `Ubibot: No se pudo obtener la temperatura para el canal ${channelId}. Abortando la verificación.`
        );
        return;
      }

      console.log(
        `Ubibot: Verificando temperatura para el canal ${channelId} (${channelName}): ${temperature.toFixed(
          2
        )}°C`
      );
      console.log(
        `Ubibot: Rango permitido: ${minima_temp_camara}°C a ${maxima_temp_camara}°C`
      );

      // Procesar la lectura de temperatura con el controlador de notificaciones
      // Pasando explícitamente isOperational para asegurar consistencia
      const timestamp = moment(lastValues.field8.created_at).format(
        "YYYY-MM-DD HH:mm:ss"
      );

      await notificationController.processTemperatureReading(
        channelId,
        channelName,
        temperature,
        timestamp,
        minima_temp_camara,
        maxima_temp_camara,
        isOperational  // Pasamos explícitamente el valor booleano
      );

    } catch (error) {
      console.error("Ubibot: Error en checkParametersAndNotify:", error);
    } finally {
      if (connection) connection.release();
    }
  }

  async getLastSensorReading(channelId) {
    try {
      const [rows] = await pool.query(
        "SELECT external_temperature_timestamp FROM sensor_readings_ubibot WHERE channel_id = ? ORDER BY external_temperature_timestamp DESC LIMIT 1",
        [channelId]
      );

      if (rows && rows.length > 0) {
        return rows[0];
      } else {
        return null;
      }
    } catch (error) {
      console.error(
        `Ubibot: Error al obtener la última lectura del sensor para el canal ${channelId}:`,
        error.message
      );
      return null;
    }
  }
}

module.exports = new UbibotService();
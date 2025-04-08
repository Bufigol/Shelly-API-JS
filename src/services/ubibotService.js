// src/services/ubibotService.js

const mysql = require("mysql2/promise");
const config = require("../config/js_files/config-loader");
const { convertToMySQLDateTime } = require("../utils/transformUtils");
const moment = require("moment-timezone");

// =====================================================================
// CONFIGURACIÓN DE CONSTANTES DE TIEMPO
// =====================================================================

// Intervalos para alertas (en minutos)
const MINUTOS_ESPERA_ALERTA_DESCONEXION = 60; // Minutos a esperar para enviar alerta cuando un sensor se desconecta
const MINUTOS_ENTRE_ALERTAS_DESCONEXION = 60; // Minutos entre alertas repetidas para sensores que siguen desconectados

// Intervalos para procesamiento de colas (en milisegundos)
const MS_INTERVALO_PROCESO_HORARIO = 60 * 60 * 1000; // 1 hora - Frecuencia de procesamiento de alertas acumuladas
const MS_INTERVALO_PROCESO_SMS = 60 * 60 * 1000; // 30 minutos - Frecuencia de procesamiento de cola SMS
const MS_INTERVALO_LIMPIEZA_ALERTAS = 1 * 60 * 60 * 1000; // 12 horas - Frecuencia de limpieza de alertas antiguas

// Tiempos de retención de datos (en horas)
const HORAS_RETENCION_ALERTAS = 24; // Horas de retención para alertas en búfer

// =====================================================================
// CÓDIGO DEL SERVICIO
// =====================================================================

// Sistema de buffer de alertas por hora para alertas de temperatura
const alertBuffers = {
  // Organizado por hora, cada clave es un timestamp y el valor un array de alertas
  hourlyBuffers: {},
  // La última hora procesada
  lastProcessedHourTimestamp: null,
  // Referencia al intervalo de procesamiento
  processingInterval: null,
};

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

    // Inicializar sistema de buffer horario de alertas
    this.setupHourlyAlertProcessing();

    // Programar procesamiento de cola de SMS
    this.setupSMSQueueProcessing();
  }

  /**
   * Configura el sistema de procesamiento horario de alertas
   */
  setupHourlyAlertProcessing() {
    // Limpiar intervalo anterior si existe
    if (alertBuffers.processingInterval) {
      clearInterval(alertBuffers.processingInterval);
    }

    // Calcular tiempo hasta el siguiente comienzo de hora
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    const timeToNextHour = nextHour - now;

    // Programar el primer procesamiento al inicio de la próxima hora
    setTimeout(() => {
      this.processHourlyAlerts();

      // Establecer intervalo para procesar cada hora exactamente
      alertBuffers.processingInterval = setInterval(
        () => this.processHourlyAlerts(),
        MS_INTERVALO_PROCESO_HORARIO
      );

      // Programar la limpieza de alertas antiguas periódicamente
      setInterval(() => this.cleanupOldAlerts(), MS_INTERVALO_LIMPIEZA_ALERTAS);
    }, timeToNextHour);

    console.log(
      `Procesamiento de alertas programado para iniciar en ${Math.round(
        timeToNextHour / 1000 / 60
      )} minutos`
    );
  }

  /**
   * Configura el procesamiento periódico de la cola de SMS
   */
  setupSMSQueueProcessing() {
    // Calcular tiempo hasta el próximo procesamiento (cada 30 minutos)
    const now = new Date();
    const nextProcessTime = new Date(now);
    nextProcessTime.setMinutes(
      nextProcessTime.getMinutes() >= 30 ? 60 : 30,
      0,
      0
    );
    const timeToNextProcess = nextProcessTime - now;

    // Programar primer procesamiento
    setTimeout(() => {
      this.processSMSQueue();

      // Establecer intervalo para procesar periódicamente
      setInterval(() => this.processSMSQueue(), MS_INTERVALO_PROCESO_SMS);
    }, timeToNextProcess);

    console.log(
      `Procesamiento de cola de SMS programado para iniciar en ${Math.round(
        timeToNextProcess / 1000 / 60
      )} minutos`
    );
  }

  /**
   * Procesa la cola de SMS
   */
  async processSMSQueue() {
    try {
      const smsService = require("./smsService");

      // Procesar cola de SMS
      const result = await smsService.processTemperatureAlertQueue();

      if (result.success) {
        console.log(
          `Cola de SMS procesada: ${result.processed} alertas enviadas`
        );
      } else if (result.reason === "working_hours") {
        console.log(
          "Procesamiento de cola de SMS pospuesto por horario laboral"
        );
      } else {
        console.warn("Error al procesar cola de SMS:", result);
      }
    } catch (error) {
      console.error("Error al procesar cola de SMS:", error);
    }
  }

  /**
   * Añade una alerta al buffer de la hora correspondiente
   */
  addAlertToHourlyBuffer(
    channelName,
    temperature,
    timestamp,
    minThreshold,
    maxThreshold
  ) {
    // Obtener el timestamp de inicio de la hora actual (redondeando hacia abajo)
    const date = new Date(timestamp);
    date.setMinutes(0, 0, 0);
    const hourTimestamp = date.toISOString();

    // Inicializar el buffer para esta hora si no existe
    if (!alertBuffers.hourlyBuffers[hourTimestamp]) {
      alertBuffers.hourlyBuffers[hourTimestamp] = [];
    }

    // Añadir la alerta al buffer de la hora correspondiente
    alertBuffers.hourlyBuffers[hourTimestamp].push({
      name: channelName,
      temperature: temperature,
      timestamp: timestamp,
      minThreshold: minThreshold,
      maxThreshold: maxThreshold,
      detectedAt: new Date().toISOString(),
    });

    console.log(
      `Alerta para ${channelName} agregada al buffer de la hora ${hourTimestamp}`
    );
  }

  /**
   * Procesa las alertas acumuladas en la última hora
   */
  async processHourlyAlerts() {
    const emailService = require("../services/emailService");
    const now = new Date();

    // Verificar si estamos fuera del horario laboral
    if (emailService.isWithinWorkingHours()) {
      console.log(
        "Dentro de horario laboral. Posponiendo procesamiento de alertas de temperatura."
      );
      return;
    }

    // Obtener hora actual redondeada a la hora anterior completa
    const currentHourDate = new Date(now);
    currentHourDate.setMinutes(0, 0, 0);
    currentHourDate.setHours(currentHourDate.getHours() - 1); // Procesamos la hora anterior completa
    const currentHourTimestamp = currentHourDate.toISOString();

    // Verificar si hay alertas para esta hora
    if (
      !alertBuffers.hourlyBuffers[currentHourTimestamp] ||
      alertBuffers.hourlyBuffers[currentHourTimestamp].length === 0
    ) {
      console.log(
        `No hay alertas para procesar en la hora ${currentHourTimestamp}`
      );
      return;
    }

    // Obtener las alertas a procesar
    const alertsToProcess = alertBuffers.hourlyBuffers[currentHourTimestamp];
    console.log(
      `Procesando ${alertsToProcess.length} alertas de temperatura para la hora ${currentHourTimestamp}`
    );

    try {
      // Enviar correo con todas las alertas acumuladas
      const emailSent = await emailService.sendTemperatureRangeAlertsEmail(
        alertsToProcess,
        now, // Usar hora actual para verificación de horario
        null, // Usar destinatarios predeterminados
        true // Forzar envío independientemente del horario
      );

      if (emailSent) {
        console.log(
          `Email enviado exitosamente con ${alertsToProcess.length} alertas de temperatura.`
        );

        // Limpiar buffer de esta hora
        delete alertBuffers.hourlyBuffers[currentHourTimestamp];

        // Actualizar última hora procesada
        alertBuffers.lastProcessedHourTimestamp = currentHourTimestamp;
      } else {
        console.error(
          "No se pudo enviar el email de alertas. Se intentará en el próximo ciclo."
        );
      }
    } catch (error) {
      console.error("Error al procesar las alertas horarias:", error);
    }
  }

  /**
   * Limpia buffers de alertas antiguas
   */
  cleanupOldAlerts() {
    const now = new Date();
    const horasRetrasadas = new Date(now);
    horasRetrasadas.setHours(now.getHours() - HORAS_RETENCION_ALERTAS);

    // Recorrer todos los buffers horarios
    for (const hourTimestamp in alertBuffers.hourlyBuffers) {
      const bufferTime = new Date(hourTimestamp);

      // Si el buffer es antiguo, eliminarlo
      if (bufferTime < horasRetrasadas) {
        console.log(`Limpiando buffer antiguo de alertas: ${hourTimestamp}`);
        delete alertBuffers.hourlyBuffers[hourTimestamp];
      }
    }
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
          isOnline,
          wasOffline,
          currentChannel,
          currentTime
        );
      }
    } finally {
      connection.release();
    }
  }

  /**
   * Actualiza el estado de conexión de un canal y envía alertas si es necesario.
   * @param {Object} connection - Conexión a la base de datos
   * @param {string} channelId - ID del canal
   * @param {boolean} isOnline - Si el canal está en línea (true) o fuera de línea (false)
   * @param {boolean} wasOffline - Si el canal estaba previamente fuera de línea
   * @param {Object} currentChannel - Datos actuales del canal
   * @param {Date} currentTime - Tiempo actual
   */
  async updateConnectionStatus(
    connection,
    channelId,
    isOnline,
    wasOffline,
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
            `Canal ${channelId} (${currentChannel.name}) está nuevamente en línea.`
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
            `Canal ${channelId} (${
              currentChannel.name
            }) ha quedado fuera de línea a las ${currentTime.toISOString()}.`
          );
        } else {
          // Ya estaba offline, verificar si debemos enviar una alerta
          await this.checkAndSendDisconnectionAlert(
            connection,
            currentChannel,
            currentTime
          );
        }
      }
    } catch (error) {
      console.error(
        `Error al actualizar estado de conexión para canal ${channelId}:`,
        error
      );
    }
  }

  /**
   * Verifica si es necesario enviar una alerta de desconexión y la envía si corresponde.
   * @param {Object} connection - Conexión a la base de datos
   * @param {Object} channel - Datos del canal
   * @param {Date} currentTime - Tiempo actual
   */
  async checkAndSendDisconnectionAlert(connection, channel, currentTime) {
    try {
      // Convertir los timestamps de string a Date si es necesario
      const outOfRangeSince =
        channel.out_of_range_since instanceof Date
          ? channel.out_of_range_since
          : new Date(channel.out_of_range_since);

      const lastAlertSent = channel.last_alert_sent
        ? channel.last_alert_sent instanceof Date
          ? channel.last_alert_sent
          : new Date(channel.last_alert_sent)
        : null;

      // Calcular cuánto tiempo ha estado offline (en minutos)
      const minutesOffline = (currentTime - outOfRangeSince) / (1000 * 60);

      // Si ha estado offline por al menos N minutos y nunca se ha enviado una alerta
      // O si la última alerta se envió hace más de N minutos
      const shouldSendAlert =
        (minutesOffline >= MINUTOS_ESPERA_ALERTA_DESCONEXION &&
          !lastAlertSent) ||
        (lastAlertSent &&
          (currentTime - lastAlertSent) / (1000 * 60) >=
            MINUTOS_ENTRE_ALERTAS_DESCONEXION);

      if (shouldSendAlert) {
        // Preparar datos para la alerta
        const disconnectedChannel = [
          {
            name: channel.name,
            lastConnectionTime: outOfRangeSince,
            disconnectionInterval: minutesOffline.toFixed(0),
          },
        ];

        // Enviar la alerta
        const alertSent = await this.sendDisconnectedSensorsEmail(
          disconnectedChannel
        );

        if (alertSent) {
          // Actualizar last_alert_sent
          await connection.query(
            "UPDATE channels_ubibot SET last_alert_sent = ? WHERE channel_id = ?",
            [currentTime, channel.channel_id]
          );
          console.log(
            `Alerta enviada para canal ${channel.channel_id} (${
              channel.name
            }) - offline por ${minutesOffline.toFixed(0)} minutos.`
          );
        } else {
          console.error(
            `Error al enviar alerta para canal ${channel.channel_id}.`
          );
        }
      }
    } catch (error) {
      console.error(`Error al verificar alerta de desconexión:`, error);
    }
  }

  /**
   * Convierte una fecha/hora UTC a una fecha/hora en la zona horaria de Santiago
   */
  getSantiagoTime(utcTime) {
    return moment.utc(utcTime).tz("America/Santiago");
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
   * Verifica los parámetros del canal y envía notificaciones si la temperatura está fuera de rango
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

      if (channelInfo.length === 0 || !channelInfo[0].esOperativa) {
        console.log(
          `Ubibot: Canal ${channelId} no encontrado o no operativo. Abortando la verificación.`
        );
        return;
      }

      const {
        name: channelName,
        minima_temp_camara,
        maxima_temp_camara,
      } = channelInfo[0];
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

      if (
        temperature < minima_temp_camara ||
        temperature > maxima_temp_camara
      ) {
        console.log(
          `Ubibot: Temperatura fuera de rango. Agregando a buffer de alertas.`
        );

        const timestamp = moment(lastValues.field1.created_at).format(
          "YYYY-MM-DD HH:mm:ss"
        );

        // Agregar a buffer horario para emails
        this.addAlertToHourlyBuffer(
          channelName,
          temperature,
          timestamp,
          minima_temp_camara,
          maxima_temp_camara
        );

        // Agregar a la cola de SMS o enviar inmediatamente
        await this.sendSMS(
          channelName,
          temperature,
          timestamp,
          minima_temp_camara,
          maxima_temp_camara
        );

        console.log(`Ubibot: Alertas enviadas para el canal ${channelName}`);
      } else {
        console.log(
          `Ubibot: Temperatura dentro del rango permitido. No se requiere alerta.`
        );
      }
    } catch (error) {
      console.error("Ubibot: Error en checkParametersAndNotify:", error);
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * Envía un correo para sensores desconectados
   */
  async sendDisconnectedSensorsEmail(disconnectedChannels, recipients = null) {
    const emailService = require("../services/emailService");

    try {
      return await emailService.sendDisconnectedSensorsEmail(
        disconnectedChannels,
        recipients
      );
    } catch (error) {
      console.error("Error enviando alerta de sensor desconectado:", error);
      return false;
    }
  }

  /**
   * Envía un SMS de alerta cuando la temperatura está fuera de rango.
   * El SMS se envía inmediatamente (sin agrupación) pero respetando el horario laboral.
   */
  async sendSMS(
    channelName,
    temperature,
    timestamp,
    minima_temp_camara,
    maxima_temp_camara
  ) {
    try {
      const smsService = require("./smsService");

      // Agregar a la cola de SMS para procesamiento agrupado
      const result = await smsService.sendTemperatureAlert(
        channelName,
        temperature,
        timestamp,
        minima_temp_camara,
        maxima_temp_camara,
        true, // Agregar a cola para envío agrupado
        null // Usar destinatarios predeterminados
      );

      if (result.success && result.queued) {
        console.log(`SMS de alerta agregado a la cola para ${channelName}`);
      } else if (!result.success) {
        console.warn(
          `Error al agregar SMS de alerta a la cola para ${channelName}`
        );
      }

      return result.success;
    } catch (error) {
      console.error("Error al invocar servicio SMS:", error.message);
      return false;
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

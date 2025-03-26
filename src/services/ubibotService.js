// src/services/ubibotService.js

const mysql = require("mysql2/promise");
const config = require("../config/js_files/config-loader");
const { convertToMySQLDateTime } = require("../utils/transformUtils");
const { isDifferenceGreaterThan } = require("../utils/math_utils");
const sgMailConfig = require("../config/jsons/sgMailConfig.json");
const smsConfig = require("../config/jsons/destinatariosSmsUbibot.json");
const moment = require("moment-timezone");
const axios = require("axios");
const MODEM_URL = "http://192.168.1.140";

const INTERVALO_SIN_CONEXION_SENSOR = 95;

// Sistema de buffer de alertas por hora
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
        60 * 60 * 1000
      );

      // Programar la limpieza de alertas antiguas cada 12 horas
      setInterval(() => this.cleanupOldAlerts(), 12 * 60 * 60 * 1000);
    }, timeToNextHour);

    console.log(
      `Procesamiento de alertas programado para iniciar en ${Math.round(
        timeToNextHour / 1000 / 60
      )} minutos`
    );
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
   * Limpia buffers de alertas antiguas (más de 24 horas)
   */
  cleanupOldAlerts() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setHours(now.getHours() - 24);

    // Recorrer todos los buffers horarios
    for (const hourTimestamp in alertBuffers.hourlyBuffers) {
      const bufferTime = new Date(hourTimestamp);

      // Si el buffer es de hace más de 24 horas, eliminarlo
      if (bufferTime < twentyFourHoursAgo) {
        console.log(`Limpiando buffer antiguo de alertas: ${hourTimestamp}`);
        delete alertBuffers.hourlyBuffers[hourTimestamp];
      }
    }
  }

  /**
   * Procesa los datos de un canal de Ubibot.
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

      if (existingChannel.length === 0) {
        await connection.query("INSERT INTO channels_ubibot SET ?", {
          ...basicInfo,
          channel_id: channelData.channel_id,
          name: channelData.name,
        });
      } else {
        const currentChannel = existingChannel[0];
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
      }
    } finally {
      connection.release();
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

        // Agregar a buffer horario
        this.addAlertToHourlyBuffer(
          channelName,
          temperature,
          timestamp,
          minima_temp_camara,
          maxima_temp_camara
        );

        // Enviar SMS inmediato
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

      const lastReading = await this.getLastSensorReading(channelId);
      const utcTimestamp = moment.utc(lastValues.field1.created_at);
      if (
        lastReading &&
        lastReading.external_temperature_timestamp &&
        isDifferenceGreaterThan(
          utcTimestamp.toDate(),
          lastReading.external_temperature_timestamp,
          INTERVALO_SIN_CONEXION_SENSOR
        )
      ) {
        await this.sendEmaillSensorSinConexion(
          channelName,
          lastValues.field8.created_at
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
  async sendEmaillSensorSinConexion(channelName, hora) {
    const emailService = require("../services/emailService");

    const disconnectedChannel = [
      {
        name: channelName,
        lastConnectionTime: hora,
        disconnectionInterval: INTERVALO_SIN_CONEXION_SENSOR,
      },
    ];

    try {
      return await emailService.sendDisconnectedSensorsEmail(
        disconnectedChannel
      );
    } catch (error) {
      console.error("Error enviando alerta de sensor desconectado:", error);
      return false;
    }
  }

  /**
   * Envía un SMS de alerta
   */
  async sendSMS(
    channelName,
    temperature,
    timestamp,
    minima_temp_camara,
    maxima_temp_camara
  ) {
    const message = `Alerta ${channelName}: Temp ${temperature}°C (${minima_temp_camara}-${maxima_temp_camara}°C) ${timestamp}`;
    const destinatarios = smsConfig.sms_destinatarios;
    console.log("Destinatarios SMS:", destinatarios);

    try {
      await this.checkModemConnection();

      const formatPhoneNumber = (phone) => {
        let formatted = phone.replace(/\s+/g, "");
        if (!formatted.startsWith("+")) {
          formatted = "+" + formatted;
        }
        return formatted;
      };

      const retrySMS = async (destinatario, retries = 2) => {
        for (let i = 0; i <= retries; i++) {
          try {
            // Verificar y refrescar token en cada intento
            const { headers } = await this.verifyAndRefreshToken();
            const formattedPhone = formatPhoneNumber(destinatario);

            if (i > 0) {
              console.log(`Reintento ${i} para ${formattedPhone}`);
              const waitTime = i === 1 ? 10000 : 7000;
              await new Promise((resolve) => setTimeout(resolve, waitTime));
            }

            const smsData = `<?xml version="1.0" encoding="UTF-8"?>
                        <request>
                            <Index>-1</Index>
                            <Phones>
                                <Phone>${formattedPhone}</Phone>
                            </Phones>
                            <Sca></Sca>
                            <Content>${message}</Content>
                            <Length>${message.length}</Length>
                            <Reserved>1</Reserved>
                            <Date>${
                              new Date()
                                .toISOString()
                                .replace("T", " ")
                                .split(".")[0]
                            }</Date>
                        </request>`;

            const response = await axios({
              method: "post",
              url: `${MODEM_URL}/api/sms/send-sms`,
              data: smsData,
              headers: headers,
              transformRequest: [(data) => data],
              validateStatus: null,
              timeout: 10000,
            });

            console.log(
              `Respuesta del módem para ${formattedPhone}:`,
              response.data
            );

            if (response.data.includes("<response>OK</response>")) {
              console.log(`SMS enviado exitosamente a ${formattedPhone}`);
              return true;
            }

            if (response.data.includes("<code>113018</code>")) {
              console.log(
                `Error de autenticación detectado, renovando sesión...`
              );
              await new Promise((resolve) => setTimeout(resolve, 3000));
              continue;
            }

            if (i === retries) {
              throw new Error(
                `Error en respuesta del módem después de ${retries} intentos: ${response.data}`
              );
            }
          } catch (error) {
            if (i === retries) throw error;
          }
        }
      };

      // Enviar SMS a cada destinatario
      for (const destinatario of destinatarios) {
        try {
          await retrySMS(destinatario);
          // Esperar entre envíos a diferentes destinatarios
          await new Promise((resolve) => setTimeout(resolve, 8000));
        } catch (error) {
          console.error(
            `Error al enviar SMS a ${destinatario}:`,
            error.message
          );
          continue;
        }
      }
    } catch (error) {
      console.error("Error general en sendSMS:", error.message);
      throw error;
    }
  }

  async getToken() {
    try {
      const response = await axios.get(
        `${MODEM_URL}/api/webserver/SesTokInfo`,
        {
          headers: {
            Accept: "*/*",
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      const responseText = response.data;
      const sessionIdMatch = responseText.match(/<SesInfo>(.*?)<\/SesInfo>/);
      const tokenMatch = responseText.match(/<TokInfo>(.*?)<\/TokInfo>/);

      if (!sessionIdMatch || !tokenMatch) {
        throw new Error("No se pudo obtener el token y la sesión");
      }

      return {
        sessionId: sessionIdMatch[1].replace("SessionID=", ""),
        token: tokenMatch[1],
      };
    } catch (error) {
      console.error("Error obteniendo token:", error.message);
      throw error;
    }
  }

  async verifyAndRefreshToken() {
    try {
      const { sessionId, token } = await this.getToken();
      return {
        headers: {
          Accept: "*/*",
          "Accept-Encoding": "gzip, deflate",
          "Accept-Language": "es-ES,es;q=0.9",
          Connection: "keep-alive",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: `SessionID=${sessionId}`,
          Host: "192.168.8.1",
          Origin: MODEM_URL,
          Referer: `${MODEM_URL}/html/smsinbox.html`,
          "X-Requested-With": "XMLHttpRequest",
          __RequestVerificationToken: token,
        },
        sessionId,
        token,
      };
    } catch (error) {
      console.error("Error al verificar/refrescar token:", error.message);
      throw error;
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

  async checkModemConnection() {
    try {
      await axios.get(`${MODEM_URL}/api/monitoring/status`, {
        timeout: 5000,
      });
      console.log("Conexión con el módem remoto establecida");
      return true;
    } catch (error) {
      console.error("Error conectando con el módem remoto:", error.message);
      throw new Error("No se pudo establecer conexión con el módem remoto");
    }
  }
}

module.exports = new UbibotService();

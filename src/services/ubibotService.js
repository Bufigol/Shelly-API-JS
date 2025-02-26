// src/services/ubibot-service.js

const mysql = require("mysql2/promise");
const config = require("../config/js_files/config-loader");
const { convertToMySQLDateTime } = require("../utils/transformUtils");
const { isDifferenceGreaterThan } = require("../utils/math_utils");
const sgMailConfig = require("../config/jsons/sgMailConfig.json");
const smsConfig = require("../config/jsons/destinatariosSmsUbibot.json");
const moment = require("moment-timezone");
const axios = require("axios");
const MODEM_URL = "http://192.168.1.140";

// Configuración de SendGrid
const SENDGRID_API_KEY = sgMailConfig.SENDGRID_API_KEY;

const INTERVALO_SIN_CONEXION_SENSOR = 95;

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
  /**
   * Procesa los datos de un canal de Ubibot.
   * Si el canal no existe en la base de datos, lo crea.
   * Si el canal ya existe, verifica si ha habido cambios en la información
   * básica del canal (como la latitud o la fecha de creación), y en caso
   * de que sí, actualiza la información del canal en la base de datos.
   * @param {Object} channelData Información del canal de Ubibot
   * @returns {Promise<void>}
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
   * Convierte una fecha/hora UTC a una fecha/hora en la zona horaria de
   * Santiago de Chile.
   * @param {Date|String|Number} utcTime Fecha/hora en formato UTC
   * @returns {moment} Fecha/hora en la zona horaria de Santiago de Chile
   */
  getSantiagoTime(utcTime) {
    return moment.utc(utcTime).tz("America/Santiago");
  }

  /**
 * Processes the sensor readings from a Ubibot channel and inserts them into the database.
 * Converts the timestamp from UTC to the Santiago timezone and logs the timestamp information.
 * If sensor readings are not present or the timestamp is missing, logs an error and returns.
 * After data insertion, checks parameters and sends notifications if necessary.
 *
 * @param {number} channelId - The ID of the Ubibot channel.
 * @param {Object} lastValues - The latest sensor readings, including fields for temperature, humidity, light, etc.
 * @param {Object} channelData - The complete channel data, including the net status.
 * @returns {Promise<void>}
 */
  async processSensorReadings(channelId, lastValues, channelData) {
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

      // Obtener el estado online del canal
      const channelNetStatus = channelData.net || "1";

      await connection.query(
        "INSERT INTO sensor_readings_ubibot (channel_id, timestamp, temperature, humidity, light, voltage, wifi_rssi, external_temperature, external_temperature_timestamp, insercion, channel_online_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
          channelNetStatus
        ]
      );

      console.log("Inserted data:", {
        channel_id: channelId,
        timestamp: utcTimestamp.toDate(),
        insercion: santiagoTime.format("YYYY-MM-DD HH:mm:ss"),
        channel_online_status: channelNetStatus
      });

      // Verificar parámetros después de la inserción
      await this.checkParametersAndNotify(channelId, lastValues);
    } finally {
      connection.release();
    }
  }

  /**
   * Verifica los parámetros del canal especificado y envía notificaciones
   * si la temperatura se encuentra fuera del rango permitido.
   *
   * @param {number} channelId - El ID del canal Ubibot.
   * @param {Object} lastValues - Los valores más recientes del sensor, incluyendo la temperatura, humedad, luz, etc.
   * @returns {Promise<void>}
   */
  async checkParametersAndNotify(channelId, lastValues) {
    let connection;
    try {
      connection = await pool.getConnection();

      // Obtener la información del canal, incluyendo si está operativo y su grupo
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
        console.log(`Ubibot: Temperatura fuera de rango. Enviando alerta.`);

        const timestamp = moment(lastValues.field1.created_at).format(
          "YYYY-MM-DD HH:mm:ss"
        );

        // Enviar notificaciones
        await this.sendEmail(
          channelName,
          temperature,
          timestamp,
          minima_temp_camara,
          maxima_temp_camara
        );
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
   * Envía un correo electrónico a los destinatarios configurados cuando un sensor
   * de temperatura externa está desconectado por más de un intervalo determinado.
   * @param {string} channelName - Nombre del canal
   * @param {string} hora - Hora en que se detectó la desconexión
   */
  async sendEmaillSensorSinConexion(channelName, hora) {
    const FROM_EMAIL = sgMailConfig.email_contacto.from_verificado;

    const data = {
      personalizations: [{ to: [{ email: FROM_EMAIL }] }], // Cambiado a un array de objetos
      from: { email: FROM_EMAIL },
      subject: `Alerta de Sensor Desconectado para ${channelName}`,
      content: [
        {
          type: "text/plain",
          value: `El sensor de temperatura externa de ${channelName} está desconectado desde ${hora}.
                    Límites de desconexion configurado: ${INTERVALO_SIN_CONEXION_SENSOR} minutos`,
        },
      ],
    };

    try {
      console.log("Intentando enviar email con la siguiente configuración:");
      console.log("API Key:", SENDGRID_API_KEY.substring(0, 10) + "...");
      console.log("Destinatario:", FROM_EMAIL);
      console.log("Remitente:", FROM_EMAIL);

      const response = await axios.post(
        "https://api.sendgrid.com/v3/mail/send",
        data,
        {
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "Respuesta de SendGrid:",
        response.status,
        response.statusText
      );
      console.log("Email enviado exitosamente");
      return true;
    } catch (error) {
      console.error("Error al enviar el email:");
      if (error.response) {
        console.error("Datos de respuesta:", error.response.data);
        console.error("Estado de respuesta:", error.response.status);
        console.error("Cabeceras de respuesta:", error.response.headers);
      } else if (error.request) {
        console.error(
          "No se recibió respuesta. Detalles de la solicitud:",
          error.request
        );
      } else {
        console.error("Error al configurar la solicitud:", error.message);
      }
      console.error("Configuración completa del error:", error.config);
      return false;
    }
  }

  /**
   * Envía un correo electrónico a los destinatarios configurados cuando un sensor
   * de temperatura externa está fuera de los límites establecidos.
   * @param {string} channelName - Nombre del canal
   * @param {number} temperature - Temperatura medida en el sensor
   * @param {string} timestamp - Marca de tiempo en que se detectó la temperatura
   * @param {number} minima_temp_camara - Límite mínimo de temperatura permitido
   * @param {number} maxima_temp_camara - Límite máximo de temperatura permitido
   * @returns {Promise<boolean>} Verdadero si el email se envió exitosamente, falso en caso contrario
   */
  async sendEmail(
    channelName,
    temperature,
    timestamp,
    minima_temp_camara,
    maxima_temp_camara
  ) {
    const FROM_EMAIL = sgMailConfig.email_contacto.from_verificado;
    const TO_EMAILS = sgMailConfig.email_contacto.destinatarios;

    const data = {
      personalizations: [{ to: TO_EMAILS.map((email) => ({ email })) }],
      from: { email: FROM_EMAIL },
      subject: `Alerta de temperatura para ${channelName}`,
      content: [
        {
          type: "text/plain",
          value: `La temperatura en ${channelName} está fuera de los límites establecidos en los parámetros.
                    Temperatura: ${temperature}°C
                    Timestamp: ${timestamp}
                    Límites permitidos: ${minima_temp_camara}°C / ${maxima_temp_camara}°C`,
        },
      ],
    };

    try {
      console.log("Intentando enviar email con la siguiente configuración:");
      console.log("API Key:", SENDGRID_API_KEY.substring(0, 10) + "...");
      console.log("Destinatarios:", TO_EMAILS);
      console.log("Remitente:", FROM_EMAIL);

      const response = await axios.post(
        "https://api.sendgrid.com/v3/mail/send",
        data,
        {
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(
        "Respuesta de SendGrid:",
        response.status,
        response.statusText
      );
      console.log("Email enviado exitosamente");
      return true;
    } catch (error) {
      console.error("Error al enviar el email:");
      if (error.response) {
        console.error("Datos de respuesta:", error.response.data);
        console.error("Estado de respuesta:", error.response.status);
        console.error("Cabeceras de respuesta:", error.response.headers);
      } else if (error.request) {
        console.error(
          "No se recibió respuesta. Detalles de la solicitud:",
          error.request
        );
      } else {
        console.error("Error al configurar la solicitud:", error.message);
      }
      console.error("Configuración completa del error:", error.config);
      return false;
    }
  }
  /**
   * Envía un SMS de alerta a los destinatarios configurados cuando la temperatura en un canal
   * supera los límites establecidos.
   * @param {string} channelName - Nombre del canal
   * @param {number} temperature - Temperatura actual
   * @param {string} timestamp - Timestamp de la lectura
   * @param {number} minima_temp_camara - Límite inferior de temperatura permitido
   * @param {number} maxima_temp_camara - Límite superior de temperatura permitido
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
                            <Date>${new Date()
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
        timeout: 5000  // Añadir timeout para conexión remota
      });
      console.log('Conexión con el módem remoto establecida');
      return true;
    } catch (error) {
      console.error('Error conectando con el módem remoto:', error.message);
      throw new Error('No se pudo establecer conexión con el módem remoto');
    }
  }
}

module.exports = new UbibotService();

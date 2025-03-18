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

  getSantiagoTime(utcTime) {
    return moment.utc(utcTime).tz("America/Santiago");
  }

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
          channelNetStatus,
        ]
      );

      console.log("Inserted data:", {
        channel_id: channelId,
        timestamp: utcTimestamp.toDate(),
        insercion: santiagoTime.format("YYYY-MM-DD HH:mm:ss"),
        channel_online_status: channelNetStatus,
      });

      await this.checkParametersAndNotify(channelId, lastValues);
    } finally {
      connection.release();
    }
  }

  async checkParametersAndNotify(channelId, lastValues) {
    const connection = await pool.getConnection();
    try {
      // 1. Obtener información del canal y parámetros
      const [channelInfo] = await connection.query(
        `SELECT c.name, c.esOperativa, c.out_of_range_since, c.last_alert_sent, c.is_currently_out_of_range,
                        p.minimo AS minima_temp_camara, p.maximo AS maxima_temp_camara
                 FROM channels_ubibot c
                 JOIN parametrizaciones p ON c.id_parametrizacion = p.param_id
                 WHERE c.channel_id = ?`,
        [channelId]
      );

      if (channelInfo.length === 0 || !channelInfo[0].esOperativa) {
        console.log(`Ubibot: Canal ${channelId} no operativo.  Verificación abortada.`);
        return;
      }

      const {
        name: channelName, minima_temp_camara, maxima_temp_camara,
        out_of_range_since, last_alert_sent, is_currently_out_of_range
      } = channelInfo[0];

      const temperature = lastValues.field8 ? parseFloat(lastValues.field8.value) : null;
      if (temperature === null) {
        console.log(`Ubibot: Temperatura no disponible para ${channelId}.`);
        return;
      }

      const currentTime = moment().tz("America/Santiago");
      console.log(`Ubibot: Verificando temperatura: ${temperature}, Mínima: ${minima_temp_camara}, Máxima: ${maxima_temp_camara}`); // Añade esta línea
      const isOutOfRange = temperature < minima_temp_camara || temperature > maxima_temp_camara;
      console.log(`Ubibot: isOutOfRange: ${isOutOfRange}`); // Y esta

      let shouldUpdate = false;
      const updateData = {};

      // 2. Lógica de estado y alertas
      if (isOutOfRange) {
        console.log(`Ubibot: is_currently_out_of_range antes del if: ${is_currently_out_of_range}`); // Añade esto
        if (!is_currently_out_of_range) { //Comienzo a contar
          updateData.out_of_range_since = currentTime.format("YYYY-MM-DD HH:mm:ss");
          updateData.is_currently_out_of_range = 1;
          shouldUpdate = true;
          console.log(`Ubibot: ${channelName} fuera de rango.  Iniciando seguimiento.`);
        }

        const outOfRangeMinutes = out_of_range_since ? currentTime.diff(moment(out_of_range_since), 'minutes') : 0;
        const timeSinceLastAlertMinutes = last_alert_sent ? currentTime.diff(moment(last_alert_sent), 'minutes') : Infinity;

        const MIN_TIME_OUT_OF_RANGE = 60;
        const MIN_TIME_BETWEEN_ALERTS = 60;

        // 3.  Verificar si se debe enviar una alerta
        if (outOfRangeMinutes >= MIN_TIME_OUT_OF_RANGE &&
          this.isNonWorkingHours(currentTime) &&
          timeSinceLastAlertMinutes >= MIN_TIME_BETWEEN_ALERTS) {
          const oneHourAgo = moment().subtract(1, "hour").format("YYYY-MM-DD HH:mm:ss");
          const [registrosNormales] = await connection.query(
            `SELECT COUNT(*) as count
                        FROM sensor_readings_ubibot
                        WHERE channel_id = ?
                        AND external_temperature >= ? AND external_temperature <= ?
                        AND timestamp >= ?`,
            [channelId, minima_temp_camara, maxima_temp_camara, oneHourAgo]
          );

          if (registrosNormales[0].count === 0) { //Si no hay registros, enviar alertas
            // 4.  Enviar Alertas (SI TODO ESTÁ BIEN)
            const timestamp = moment(lastValues.field1.created_at).format("YYYY-MM-DD HH:mm:ss");
            await this.sendEmail(channelName, temperature, timestamp, minima_temp_camara, maxima_temp_camara);
            //await this.sendSMS(channelName, temperature, timestamp, minima_temp_camara, maxima_temp_camara); //Comentado

            // 5.  Actualizar la Base de Datos (DESPUÉS de enviar las alertas)
            updateData.last_alert_sent = currentTime.format("YYYY-MM-DD HH:mm:ss");
            shouldUpdate = true;  // Aseguramos que se actualice.
            console.log(`Ubibot: Alertas enviadas para ${channelName}.`);
          } else {
            console.log(`Ubibot: No se envían alertas para ${channelName} porque hay registros dentro del rango.`);
          }
        }
      } else { // Temperatura dentro de rango
        if (is_currently_out_of_range) {
          updateData.is_currently_out_of_range = 0;
          updateData.out_of_range_since = null;
          shouldUpdate = true;
          console.log(`Ubibot: ${channelName} volvió al rango normal.`);
        }
      }

      // 6. Actualizar Base de Datos (si es necesario)
      if (shouldUpdate) {
        await this.updateChannelStatus(connection, channelId, updateData);
      }
      // Verificar si el sensor está sin conexión
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

  async updateChannelStatus(connection, channelId, updateData) {
    try {
      const setClauses = [];
      const values = [];

      for (const key in updateData) {
        setClauses.push(`${key} = ?`);
        values.push(updateData[key]);
      }

      values.push(channelId);
      const query = `UPDATE channels_ubibot SET ${setClauses.join(', ')} WHERE channel_id = ?`;
      console.log(`Ubibot: Consulta SQL: ${query}`); // LOG CLAVE
      console.log(`Ubibot: Valores: ${JSON.stringify(values)}`); // LOG CLAVE

      const result = await connection.query(query, values);
      console.log(`Ubibot: Resultado de la actualización:`, result[0]); // Cambiado para mostrar el objeto completo

    } catch (error) {
      console.error(`Ubibot: Error al actualizar el estado del canal ${channelId}:`, error);
      throw error; //  Re-lanza el error para que sea manejado por el llamador.
    }
  }

  isNonWorkingHours(dateTime) {
    const dayOfWeek = dateTime.day();
    const hour = dateTime.hour();
    const minute = dateTime.minute();

    if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Lunes a Viernes
      return (hour > 18 || (hour === 18 && minute >= 30)) || (hour < 8);
    } else if (dayOfWeek === 6) { // Sábado
      return hour > 14 || hour < 8;
    } else { // Domingo
      return true;
    }
  }

  async sendEmaillSensorSinConexion(channelName, hora) {
    const FROM_EMAIL = sgMailConfig.email_contacto.from_verificado;

    const data = {
      personalizations: [{ to: [{ email: FROM_EMAIL }] }],
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
      console.error("Error al enviar el email:", error);
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
                    Límites permitidos: ${minima_temp_camara}°C / ${maxima_temp_camara}°C
                    Esta alerta se envía porque la temperatura ha estado fuera de rango por más de 1 hora y estamos en horario no laboral.`,
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
      console.error("Error al enviar el email:", error);
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

  async sendSMS(
    channelName,
    temperature,
    timestamp,
    minima_temp_camara,
    maxima_temp_camara
  ) {
    const message = `Alerta ${channelName}: Temp ${temperature}°C (${minima_temp_camara}-${maxima_temp_camara}°C) ${timestamp} [Fuera de horario laboral]`;
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

      for (const destinatario of destinatarios) {
        try {
          await retrySMS(destinatario);
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
      const [rows] = await connection.query(
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
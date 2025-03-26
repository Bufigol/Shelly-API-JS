// src/services/smsService.js

const axios = require("axios");
const config = require("../config/js_files/config-loader");
const smsConfig = require("../config/jsons/destinatariosSmsUbibot.json");

class SMSService {
  constructor() {
    // Configuración del módem
    this.modemUrl = "http://192.168.1.140";
    this.defaultRecipients = smsConfig.sms_destinatarios || [];
    this.initialized = false;
    this.retryConfig = {
      maxRetries: 2,
      retryDelays: [10000, 7000], // 10 seg, 7 seg
      timeBetweenRecipients: 8000, // 8 seg entre envíos a distintos destinatarios
    };

    // Métricas
    this.metrics = {
      sentMessages: 0,
      failedMessages: 0,
      lastError: null,
      lastSuccessTime: null,
    };
  }

  /**
   * Inicializa el servicio SMS
   * @returns {boolean} True si la inicialización fue exitosa
   */
  initialize() {
    if (this.initialized) return true;

    try {
      // Verificar si hay destinatarios configurados
      if (!this.defaultRecipients || this.defaultRecipients.length === 0) {
        console.warn(
          "⚠️ No hay destinatarios SMS predeterminados configurados"
        );
      }

      // Comprobar conectividad con el módem (sin lanzar error si falla)
      this.checkModemConnection()
        .then(() =>
          console.log("✅ Servicio SMS inicializado y módem conectado")
        )
        .catch((err) =>
          console.warn(
            `⚠️ Servicio SMS inicializado pero el módem no está accesible: ${err.message}`
          )
        );

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("Error al inicializar el servicio SMS:", error);
      return false;
    }
  }

  /**
   * Verifica la conexión con el módem
   * @returns {Promise<boolean>} True si el módem está conectado
   */
  async checkModemConnection() {
    try {
      await axios.get(`${this.modemUrl}/api/monitoring/status`, {
        timeout: 5000,
      });
      return true;
    } catch (error) {
      console.error("Error conectando con el módem remoto:", error.message);
      throw new Error("No se pudo establecer conexión con el módem remoto");
    }
  }

  /**
   * Obtiene un token de autenticación del módem
   * @returns {Promise<{sessionId: string, token: string}>} Sesión y token
   */
  async getToken() {
    try {
      const response = await axios.get(
        `${this.modemUrl}/api/webserver/SesTokInfo`,
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

  /**
   * Verifica y refresca el token si es necesario
   * @returns {Promise<{headers: Object}>} Headers con el token actualizado
   */
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
          Origin: this.modemUrl,
          Referer: `${this.modemUrl}/html/smsinbox.html`,
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

  /**
   * Formatea un número de teléfono para asegurar que tiene formato internacional
   * @param {string} phone - Número de teléfono
   * @returns {string} Número formateado
   */
  formatPhoneNumber(phone) {
    let formatted = phone.replace(/\s+/g, "");
    if (!formatted.startsWith("+")) {
      formatted = "+" + formatted;
    }
    return formatted;
  }

  /**
   * Envía un SMS a un destinatario específico con reintentos
   * @param {string} destinatario - Número de teléfono
   * @param {string} message - Mensaje a enviar
   * @param {number} [retryAttempt=0] - Número de intento actual
   * @returns {Promise<boolean>} True si el envío fue exitoso
   */
  async sendSMSToRecipient(destinatario, message, retryAttempt = 0) {
    const formattedPhone = this.formatPhoneNumber(destinatario);
    const maxRetries = this.retryConfig.maxRetries;

    try {
      // Si es un reintento, esperar antes de proceder
      if (retryAttempt > 0) {
        console.log(`Reintento ${retryAttempt} para ${formattedPhone}`);
        const waitTime = this.retryConfig.retryDelays[retryAttempt - 1] || 5000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Obtener headers actualizados
      const { headers } = await this.verifyAndRefreshToken();

      // Preparar el XML para el SMS
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
              new Date().toISOString().replace("T", " ").split(".")[0]
            }</Date>
        </request>`;

      // Enviar la solicitud al módem
      const response = await axios({
        method: "post",
        url: `${this.modemUrl}/api/sms/send-sms`,
        data: smsData,
        headers: headers,
        transformRequest: [(data) => data],
        validateStatus: null,
        timeout: 10000,
      });

      // Verificar respuesta
      if (response.data.includes("<response>OK</response>")) {
        console.log(`SMS enviado exitosamente a ${formattedPhone}`);
        this.metrics.sentMessages++;
        this.metrics.lastSuccessTime = new Date();
        return true;
      }

      // Si hay error de autenticación, reintentar
      if (response.data.includes("<code>113018</code>")) {
        console.log(`Error de autenticación detectado, renovando sesión...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Verificar si podemos reintentar
        if (retryAttempt < maxRetries) {
          return this.sendSMSToRecipient(
            destinatario,
            message,
            retryAttempt + 1
          );
        }
      }

      // Si llegamos aquí, hubo un error en la respuesta
      throw new Error(`Error en respuesta del módem: ${response.data}`);
    } catch (error) {
      // Si podemos reintentar, hacerlo
      if (retryAttempt < maxRetries) {
        console.warn(
          `Error en intento ${retryAttempt + 1}/${maxRetries + 1}: ${
            error.message
          }`
        );
        return this.sendSMSToRecipient(destinatario, message, retryAttempt + 1);
      }

      // Si agotamos los reintentos, registrar el error y fallar
      console.error(
        `Error al enviar SMS a ${formattedPhone} después de ${
          maxRetries + 1
        } intentos:`,
        error.message
      );
      this.metrics.failedMessages++;
      this.metrics.lastError = error.message;
      return false;
    }
  }

  /**
   * Envía un SMS a múltiples destinatarios
   * @param {string} message - Mensaje a enviar
   * @param {Array<string>} [recipients=null] - Lista de destinatarios (opcional, usa la lista por defecto)
   * @returns {Promise<{success: boolean, sentCount: number, failedCount: number}>} Resultado del envío
   */
  async sendSMS(message, recipients = null) {
    if (!this.initialized) {
      this.initialize();
    }

    if (!message) {
      console.error("Error: No se proporcionó mensaje para enviar");
      return { success: false, sentCount: 0, failedCount: 0 };
    }

    // Usar destinatarios proporcionados o predeterminados
    const smsRecipients = recipients || this.defaultRecipients;

    if (!smsRecipients || smsRecipients.length === 0) {
      console.error("Error: No hay destinatarios configurados para SMS");
      return { success: false, sentCount: 0, failedCount: 0 };
    }

    console.log(`Enviando SMS a ${smsRecipients.length} destinatarios`);

    // Resultados del envío
    const results = {
      success: true,
      sentCount: 0,
      failedCount: 0,
      recipients: {},
    };

    // Enviar a cada destinatario con pausa entre envíos
    for (const destinatario of smsRecipients) {
      try {
        const sent = await this.sendSMSToRecipient(destinatario, message);

        if (sent) {
          results.sentCount++;
          results.recipients[destinatario] = "enviado";
        } else {
          results.failedCount++;
          results.recipients[destinatario] = "fallido";
          results.success = false;
        }

        // Esperar entre envíos para no sobrecargar el módem
        if (smsRecipients.length > 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryConfig.timeBetweenRecipients)
          );
        }
      } catch (error) {
        console.error(
          `Error general al enviar SMS a ${destinatario}:`,
          error.message
        );
        results.failedCount++;
        results.recipients[destinatario] = "error";
        results.success = false;
      }
    }

    // Registrar resultado final
    console.log(
      `Resultado de envío SMS: ${results.sentCount} enviados, ${results.failedCount} fallidos`
    );
    return results;
  }

  /**
   * Envía un SMS de alerta de temperatura
   * @param {string} channelName - Nombre del canal
   * @param {number} temperature - Temperatura detectada
   * @param {string} timestamp - Timestamp de la medición
   * @param {number} minThreshold - Umbral mínimo
   * @param {number} maxThreshold - Umbral máximo
   * @param {Array<string>} [recipients=null] - Destinatarios personalizados
   * @returns {Promise<{success: boolean, sentCount: number}>} Resultado del envío
   */
  async sendTemperatureAlert(
    channelName,
    temperature,
    timestamp,
    minThreshold,
    maxThreshold,
    recipients = null
  ) {
    const message = `Alerta ${channelName}: Temp ${temperature}°C (${minThreshold}-${maxThreshold}°C) ${timestamp}`;
    return await this.sendSMS(message, recipients);
  }

  /**
   * Devuelve las métricas del servicio SMS
   * @returns {Object} Métricas de envíos
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.sentMessages + this.metrics.failedMessages > 0
          ? (
              (this.metrics.sentMessages /
                (this.metrics.sentMessages + this.metrics.failedMessages)) *
              100
            ).toFixed(2) + "%"
          : "N/A",
      initialized: this.initialized,
      timestamp: new Date(),
    };
  }
}

module.exports = new SMSService();

// src/services/smsService.js

const axios = require("axios");
const config = require("../config/js_files/config-loader");
const smsConfig = require("../config/jsons/destinatariosSmsUbibot.json");
const moment = require("moment-timezone");

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

    // Cargar configuración de horario laboral desde emailService para mantener consistencia
    const emailService = require("./emailService");
    this.workingHours = emailService.workingHours;
    this.timeZone = emailService.timeZone || "America/Santiago";

    // Métricas
    this.metrics = {
      sentMessages: 0,
      failedMessages: 0,
      lastError: null,
      lastSuccessTime: null,
    };

    // Cola de mensajes a enviar
    this.messageQueue = {
      temperatureAlerts: [],
      lastProcessed: null,
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
   * Verifica si estamos dentro del horario laboral
   * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar
   * @returns {boolean} true si estamos en horario laboral
   */
  isWithinWorkingHours(checkTime = null) {
    // Usar el servicio de email si está disponible para asegurar coherencia
    try {
      const emailService = require("./emailService");
      if (
        emailService &&
        typeof emailService.isWithinWorkingHours === "function"
      ) {
        return emailService.isWithinWorkingHours(checkTime);
      }
    } catch (e) {
      // Continuar con la implementación propia si no podemos usar emailService
    }

    // Implementación local por si no podemos acceder a emailService
    let timeToCheck;
    if (checkTime) {
      timeToCheck = moment.isMoment(checkTime)
        ? checkTime.clone()
        : moment(checkTime);
    } else {
      timeToCheck = moment();
    }

    const localTime = timeToCheck.tz(this.timeZone);
    const dayOfWeek = localTime.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const hourDecimal = localTime.hour() + localTime.minute() / 60;

    // Domingo siempre está fuera de horario laboral
    if (dayOfWeek === 0) return false;

    // Sábado tiene horario especial
    if (dayOfWeek === 6) {
      return (
        hourDecimal >= this.workingHours.saturday.start &&
        hourDecimal <= this.workingHours.saturday.end
      );
    }

    // Lunes a viernes (días 1-5)
    return (
      hourDecimal >= this.workingHours.weekdays.start &&
      hourDecimal <= this.workingHours.weekdays.end
    );
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
   * @param {boolean} [forceOutsideWorkingHours=false] - Forzar envío incluso en horario laboral
   * @returns {Promise<{success: boolean, sentCount: number, failedCount: number}>} Resultado del envío
   */
  async sendSMS(message, recipients = null, forceOutsideWorkingHours = false) {
    if (!this.initialized) {
      this.initialize();
    }

    // Verificar si estamos fuera del horario laboral (a menos que se fuerce el envío)
    if (!forceOutsideWorkingHours && this.isWithinWorkingHours()) {
      console.log(
        "SMS Service - Dentro de horario laboral. Posponiendo envío de SMS para fuera de horario."
      );
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: "working_hours",
      };
    }

    if (!message) {
      console.error("Error: No se proporcionó mensaje para enviar");
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: "no_message",
      };
    }

    // Usar destinatarios proporcionados o predeterminados
    const smsRecipients = recipients || this.defaultRecipients;

    if (!smsRecipients || smsRecipients.length === 0) {
      console.error("Error: No hay destinatarios configurados para SMS");
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: "no_recipients",
      };
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
   * Agrega una alerta de temperatura a la cola
   * @param {string} channelName - Nombre del canal
   * @param {number} temperature - Temperatura detectada
   * @param {string} timestamp - Timestamp de la medición
   * @param {number} minThreshold - Umbral mínimo
   * @param {number} maxThreshold - Umbral máximo
   * @returns {boolean} True si se agregó correctamente
   */
  addTemperatureAlertToQueue(
    channelName,
    temperature,
    timestamp,
    minThreshold,
    maxThreshold
  ) {
    // Agregar a la cola
    this.messageQueue.temperatureAlerts.push({
      channelName,
      temperature,
      timestamp,
      minThreshold,
      maxThreshold,
      queuedAt: new Date(),
    });

    console.log(
      `SMS Service - Alerta de temperatura para ${channelName} agregada a la cola (${this.messageQueue.temperatureAlerts.length} alertas en cola)`
    );
    return true;
  }

  /**
   * Envía las alertas de temperatura acumuladas
   * @param {boolean} [forceOutsideWorkingHours=false] - Forzar envío incluso en horario laboral
   * @returns {Promise<{success: boolean, processed: number}>} Resultado del procesamiento
   */
  async processTemperatureAlertQueue(forceOutsideWorkingHours = false) {
    // Verificar si hay alertas para procesar
    if (this.messageQueue.temperatureAlerts.length === 0) {
      return { success: true, processed: 0 };
    }

    // Verificar si estamos fuera del horario laboral
    if (!forceOutsideWorkingHours && this.isWithinWorkingHours()) {
      console.log(
        "SMS Service - Dentro de horario laboral. Posponiendo procesamiento de alertas SMS."
      );
      return { success: false, processed: 0, reason: "working_hours" };
    }

    // Crear un resumen de las alertas para enviar un único SMS
    const alertCount = this.messageQueue.temperatureAlerts.length;
    let message = `ALERTA: ${alertCount} sensor${
      alertCount > 1 ? "es" : ""
    } fuera de rango. `;

    // Incluir solo los primeros 3 canales con detalle para no exceder límite de SMS
    const detailLimit = Math.min(3, alertCount);
    for (let i = 0; i < detailLimit; i++) {
      const alert = this.messageQueue.temperatureAlerts[i];
      message += `${alert.channelName}: ${alert.temperature}°C. `;
    }

    // Agregar resumen si hay más alertas
    if (alertCount > detailLimit) {
      message += `Y ${alertCount - detailLimit} más. `;
    }

    // Añadir timestamp
    message += `${moment().format("DD/MM HH:mm")}`;

    // Enviar el SMS consolidado
    const result = await this.sendSMS(message, null, forceOutsideWorkingHours);

    if (result.success) {
      // Limpiar la cola
      const processedCount = this.messageQueue.temperatureAlerts.length;
      this.messageQueue.temperatureAlerts = [];
      this.messageQueue.lastProcessed = new Date();

      console.log(
        `SMS Service - Cola de alertas procesada: ${processedCount} alertas enviadas en un SMS consolidado`
      );
      return { success: true, processed: processedCount };
    } else {
      console.error(
        "SMS Service - Error al enviar alertas consolidadas:",
        result
      );
      return { success: false, processed: 0, error: result };
    }
  }

  /**
   * Envía un SMS de alerta de temperatura inmediatamente o lo agrega a la cola
   * @param {string} channelName - Nombre del canal
   * @param {number} temperature - Temperatura detectada
   * @param {string} timestamp - Timestamp de la medición
   * @param {number} minThreshold - Umbral mínimo
   * @param {number} maxThreshold - Umbral máximo
   * @param {boolean} [queueForBatch=true] - Si es true, agrega a la cola; si es false, envía inmediatamente
   * @param {Array<string>} [recipients=null] - Destinatarios personalizados
   * @returns {Promise<{success: boolean}>} Resultado de la operación
   */
  async sendTemperatureAlert(
    channelName,
    temperature,
    timestamp,
    minThreshold,
    maxThreshold,
    queueForBatch = true,
    recipients = null
  ) {
    // Si se debe encolar para envío posterior agrupado
    if (queueForBatch) {
      this.addTemperatureAlertToQueue(
        channelName,
        temperature,
        timestamp,
        minThreshold,
        maxThreshold
      );
      return { success: true, queued: true };
    }

    // Si se debe enviar inmediatamente
    const message = `Alerta ${channelName}: Temp ${temperature}°C (${minThreshold}-${maxThreshold}°C) ${timestamp}`;
    const result = await this.sendSMS(message, recipients, true); // Forzar envío incluso en horario laboral

    return {
      success: result.success,
      queued: false,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
    };
  }

  /**
   * Devuelve las métricas del servicio SMS
   * @returns {Object} Métricas de envíos
   */
  getMetrics() {
    return {
      ...this.metrics,
      queuedAlerts: this.messageQueue.temperatureAlerts.length,
      lastProcessed: this.messageQueue.lastProcessed,
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

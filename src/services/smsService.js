// src/services/smsService.js

const axios = require("axios");
const config = require("../config/js_files/config-loader");
const moment = require("moment-timezone");

/**
 * Servicio para envío de SMS a través de un módem remoto.
 * Proporciona capacidades de envío individual, grupal, y procesamiento por lotes.
 */
class SMSService {
  constructor() {
    this.initialized = false;
    this.config = null;

    // Intentar cargar la configuración
    this.loadConfiguration();

    // Métricas
    this.metrics = {
      sentMessages: 0,
      failedMessages: 0,
      lastError: null,
      lastSuccessTime: null,
      queueStats: {
        added: 0,
        processed: 0,
        failed: 0
      }
    };

    // Cola de mensajes
    this.messageQueue = {
      createdAt: new Date(),
      temperatureAlerts: [],
      lastProcessed: null,
    };
  }

  /**
   * Carga la configuración desde config-loader
   */
  loadConfiguration() {
    try {
      const appConfig = config.getConfig();

      // Cargar configuración SMS si existe
      if (appConfig && appConfig.sms) {
        this.config = appConfig.sms;

        // Cargar destinatarios de los archivos JSON existentes si no están en la nueva config
        try {
          const smsConfigRecipients = require("../config/jsons/destinatariosSmsUbibot.json");
          this.defaultRecipients = smsConfigRecipients.sms_destinatarios || [];
        } catch (e) {
          console.warn("⚠️ No se pudo cargar destinatarios SMS:", e.message);
          this.defaultRecipients = [];
        }

        console.log("✅ Configuración SMS cargada correctamente");
        return true;
      } else {
        console.warn("⚠️ No se encontró configuración SMS en config-loader");
        return false;
      }
    } catch (error) {
      console.error("Error al cargar configuración SMS:", error);
      return false;
    }
  }

  /**
   * Inicializa el servicio SMS
   * @returns {boolean} True si la inicialización fue exitosa
   */
  initialize() {
    if (this.initialized) return true;

    try {
      // Asegurarnos de que tenemos la configuración más reciente
      if (!this.config) {
        this.loadConfiguration();
      }

      // Validar que tenemos la configuración mínima necesaria
      if (!this.config || !this.config.modem || !this.config.modem.url) {
        throw new Error("Configuración SMS incompleta o inválida");
      }

      // Verificar si hay destinatarios configurados
      if (!this.defaultRecipients || this.defaultRecipients.length === 0) {
        console.warn("⚠️ No hay destinatarios SMS predeterminados configurados");
      }

      // Comprobar conectividad con el módem (sin lanzar error si falla)
      this.checkModemConnection()
        .then(() => console.log("✅ Servicio SMS inicializado y módem conectado"))
        .catch((err) => console.warn(
          `⚠️ Servicio SMS inicializado pero el módem no está accesible: ${err.message}`
        ));

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
    // Si no tenemos configuración, cargamos la configuración
    if (!this.config || !this.config.workingHours) {
      this.loadConfiguration();

      // Si aún no tenemos configuración, asumimos que estamos fuera de horario laboral
      if (!this.config || !this.config.workingHours) {
        console.warn("⚠️ No se pudo determinar horario laboral por falta de configuración");
        return false;
      }
    }

    // Usar la configuración centralizada
    const { workingHours, timeZone } = this.config;

    // Implementación local
    let timeToCheck;
    if (checkTime) {
      timeToCheck = moment.isMoment(checkTime)
        ? checkTime.clone()
        : moment(checkTime);
    } else {
      timeToCheck = moment();
    }

    const localTime = timeToCheck.tz(timeZone || "America/Santiago");
    const dayOfWeek = localTime.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const hourDecimal = localTime.hour() + localTime.minute() / 60;

    // Domingo siempre está fuera de horario laboral
    if (dayOfWeek === 0) return false;

    // Sábado tiene horario especial
    if (dayOfWeek === 6) {
      return (
        hourDecimal >= workingHours.saturday.start &&
        hourDecimal <= workingHours.saturday.end
      );
    }

    // Lunes a viernes (días 1-5)
    return (
      hourDecimal >= workingHours.weekdays.start &&
      hourDecimal <= workingHours.weekdays.end
    );
  }

  /**
   * Verifica la conexión con el módem
   * @returns {Promise<boolean>} True si el módem está conectado
   */
  async checkModemConnection() {
    // Asegurarnos de que tenemos la configuración
    if (!this.config || !this.config.modem) {
      await this.loadConfiguration();
      if (!this.config || !this.config.modem) {
        throw new Error("No se pudo cargar la configuración del módem");
      }
    }

    const { url, apiPath, timeout } = this.config.modem;

    try {
      const response = await axios.get(`${url}${apiPath || "/api"}/monitoring/status`, {
        timeout: timeout || 15000,
        headers: this.getBasicHeaders()
      });

      // Verificar que la respuesta tenga el formato esperado
      if (!response.data) {
        throw new Error("Respuesta vacía del módem");
      }

      console.log('Conexión con el módem remoto establecida correctamente');
      return true;
    } catch (error) {
      const errorMessage = error.response ?
        `Error HTTP ${error.response.status}` :
        error.message || "Error desconocido";

      console.error(`Error conectando con el módem remoto: ${errorMessage}`);
      throw new Error(`No se pudo establecer conexión con el módem remoto: ${errorMessage}`);
    }
  }

  /**
   * Obtiene los headers básicos para las solicitudes
   * @returns {Object} Headers básicos
   */
  getBasicHeaders() {
    return {
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
      "Cache-Control": "no-cache",
      Pragma: "no-cache"
    };
  }

  /**
   * Obtiene un token de autenticación del módem
   * @returns {Promise<{sessionId: string, token: string}>} Sesión y token
   */
  async getToken() {
    // Asegurarnos de que tenemos la configuración
    if (!this.config || !this.config.modem) {
      await this.loadConfiguration();
      if (!this.config || !this.config.modem) {
        throw new Error("No se pudo cargar la configuración del módem");
      }
    }

    const { url, apiPath, timeout } = this.config.modem;

    try {
      const response = await axios.get(
        `${url}${apiPath || "/api"}/webserver/SesTokInfo`,
        {
          headers: this.getBasicHeaders(),
          timeout: timeout || 5000
        }
      );

      const responseText = response.data;
      const sessionIdMatch = responseText.match(/<SesInfo>(.*?)<\/SesInfo>/);
      const tokenMatch = responseText.match(/<TokInfo>(.*?)<\/TokInfo>/);

      if (!sessionIdMatch || !tokenMatch) {
        throw new Error("No se pudo obtener el token y la sesión (formato de respuesta inválido)");
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
    // Asegurarnos de que tenemos la configuración
    if (!this.config || !this.config.modem) {
      await this.loadConfiguration();
      if (!this.config || !this.config.modem) {
        throw new Error("No se pudo cargar la configuración del módem");
      }
    }

    try {
      const { sessionId, token } = await this.getToken();
      const { url, host } = this.config.modem;

      return {
        headers: {
          ...this.getBasicHeaders(),
          "Accept-Encoding": "gzip, deflate",
          "Accept-Language": "es-ES,es;q=0.9",
          Connection: "keep-alive",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Cookie: `SessionID=${sessionId}`,
          Host: host || "192.168.8.1",
          Origin: url,
          Referer: `${url}/html/smsinbox.html`,
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
    if (!phone) return null;

    let formatted = phone.toString().replace(/\s+/g, "");
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
    // Asegurarnos de que tenemos la configuración
    if (!this.config || !this.config.modem) {
      await this.loadConfiguration();
      if (!this.config || !this.config.modem) {
        throw new Error("No se pudo cargar la configuración del módem");
      }
    }

    const formattedPhone = this.formatPhoneNumber(destinatario);
    if (!formattedPhone) {
      console.error("Número de teléfono inválido:", destinatario);
      return false;
    }

    const { retry, url, apiPath, timeout } = this.config.modem;
    const maxRetries = retry ? retry.maxRetries : 2;
    const retryDelays = retry ? retry.retryDelays : [10000, 7000];

    try {
      // Si es un reintento, esperar antes de proceder
      if (retryAttempt > 0) {
        console.log(`Reintento ${retryAttempt} para ${formattedPhone}`);
        const waitTime = retryDelays[retryAttempt - 1] || 5000;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Obtener headers actualizados
      const { headers } = await this.verifyAndRefreshToken();

      // Preparar el XML para el SMS
      const smsData = this.prepareSmsXml(formattedPhone, message);

      // Enviar la solicitud al módem
      const response = await axios({
        method: "post",
        url: `${url}${apiPath || "/api"}/sms/send-sms`,
        data: smsData,
        headers: headers,
        transformRequest: [(data) => data],
        validateStatus: null, // No lanzar error por códigos de estado
        timeout: timeout || 10000,
      });

      // Verificar respuesta
      if (response.data && response.data.includes("<response>OK</response>")) {
        console.log(`SMS enviado exitosamente a ${formattedPhone}`);
        this.metrics.sentMessages++;
        this.metrics.lastSuccessTime = new Date();
        return true;
      }

      // Si hay error de autenticación, reintentar
      if (response.data && response.data.includes("<code>113018</code>")) {
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
      const errorMsg = this.extractErrorFromResponse(response.data) || "Error desconocido";
      throw new Error(`Error en respuesta del módem: ${errorMsg}`);
    } catch (error) {
      // Si podemos reintentar, hacerlo
      if (retryAttempt < maxRetries) {
        console.warn(
          `Error en intento ${retryAttempt + 1}/${maxRetries + 1}: ${error.message}`
        );
        return this.sendSMSToRecipient(destinatario, message, retryAttempt + 1);
      }

      // Si agotamos los reintentos, registrar el error y fallar
      console.error(
        `Error al enviar SMS a ${formattedPhone} después de ${maxRetries + 1} intentos:`,
        error.message
      );
      this.metrics.failedMessages++;
      this.metrics.lastError = error.message;
      return false;
    }
  }

  /**
   * Prepara el XML para enviar un SMS
   * @param {string} phoneNumber - Número de teléfono formateado
   * @param {string} message - Mensaje a enviar
   * @returns {string} XML formateado
   */
  prepareSmsXml(phoneNumber, message) {
    return `<?xml version="1.0" encoding="UTF-8"?>
      <request>
          <Index>-1</Index>
          <Phones>
              <Phone>${phoneNumber}</Phone>
          </Phones>
          <Sca></Sca>
          <Content>${message}</Content>
          <Length>${message.length}</Length>
          <Reserved>1</Reserved>
          <Date>${new Date().toISOString().replace("T", " ").split(".")[0]}</Date>
      </request>`;
  }

  /**
   * Extrae mensajes de error de la respuesta XML
   * @param {string} responseData - Respuesta XML del módem
   * @returns {string|null} Mensaje de error o null si no se encontró
   */
  extractErrorFromResponse(responseData) {
    if (!responseData) return null;

    try {
      const codeMatch = responseData.match(/<code>(.*?)<\/code>/);
      const messageMatch = responseData.match(/<message>(.*?)<\/message>/);

      if (codeMatch && messageMatch) {
        return `Código: ${codeMatch[1]}, Mensaje: ${messageMatch[1]}`;
      } else if (codeMatch) {
        return `Código: ${codeMatch[1]}`;
      } else if (messageMatch) {
        return messageMatch[1];
      }
    } catch (e) {
      console.warn("Error al parsear respuesta de error:", e);
    }

    return null;
  }

  /**
   * Envía un SMS a múltiples destinatarios
   * @param {string} message - Mensaje a enviar
   * @param {Array<string>} [recipients=null] - Lista de destinatarios (opcional, usa la lista por defecto)
   * @param {boolean} [forceOutsideWorkingHours=false] - Forzar envío incluso en horario laboral
   * @returns {Promise<{success: boolean, sentCount: number, failedCount: number}>} Resultado del envío
   */
  async sendSMS(message, recipients = null, forceOutsideWorkingHours = false) {
    // Asegurarnos de que estamos inicializados
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

    // Validar mensaje
    if (!message || typeof message !== 'string' || message.trim() === '') {
      console.error("Error: No se proporcionó mensaje válido para enviar");
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: "invalid_message",
      };
    }

    // Usar destinatarios proporcionados o predeterminados
    const smsRecipients = recipients || this.defaultRecipients;

    if (!smsRecipients || !Array.isArray(smsRecipients) || smsRecipients.length === 0) {
      console.error("Error: No hay destinatarios configurados para SMS");
      return {
        success: false,
        sentCount: 0,
        failedCount: 0,
        reason: "no_recipients",
      };
    }

    // Resultados del envío
    const results = {
      success: true,
      sentCount: 0,
      failedCount: 0,
      recipients: {},
      timestamp: new Date()
    };

    console.log(`Enviando SMS a ${smsRecipients.length} destinatarios`);

    // Asegurarse de que tenemos la configuración para los tiempos de espera
    const timeBetweenRecipients = this.config && this.config.modem && this.config.modem.retry ?
      this.config.modem.retry.timeBetweenRecipients : 8000;

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
            setTimeout(resolve, timeBetweenRecipients)
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
    // Validaciones
    if (!channelName || typeof channelName !== 'string') {
      console.error("Nombre de canal inválido:", channelName);
      return false;
    }

    if (isNaN(temperature)) {
      console.error("Temperatura inválida:", temperature);
      return false;
    }

    // Limpiar alertas antiguas
    this.cleanupStaleAlerts();

    // Agregar a la cola
    this.messageQueue.temperatureAlerts.push({
      channelName,
      temperature,
      timestamp,
      minThreshold,
      maxThreshold,
      queuedAt: new Date(),
    });

    // Actualizar métricas
    this.metrics.queueStats.added++;

    console.log(
      `SMS Service - Alerta de temperatura para ${channelName} agregada a la cola (${this.messageQueue.temperatureAlerts.length} alertas en cola)`
    );
    return true;
  }

  /**
   * Limpia alertas antiguas de la cola
   */
  cleanupStaleAlerts() {
    // Asegurarnos de que tenemos la configuración
    if (!this.config || !this.config.queue) {
      this.loadConfiguration();
    }

    // Obtener la edad máxima en horas de las alertas en la cola
    const maxAgeHours = this.config && this.config.queue ?
      this.config.queue.maxAgeHours : 24;

    const now = new Date();
    const ageLimit = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);

    const initialLength = this.messageQueue.temperatureAlerts.length;

    this.messageQueue.temperatureAlerts = this.messageQueue.temperatureAlerts.filter(
      alert => alert.queuedAt && alert.queuedAt > ageLimit
    );

    const removedCount = initialLength - this.messageQueue.temperatureAlerts.length;
    if (removedCount > 0) {
      console.log(`SMS Service - Limpieza de cola: ${removedCount} alertas antiguas eliminadas`);
    }
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

    // Asegurarnos de que tenemos la configuración
    if (!this.config || !this.config.queue) {
      this.loadConfiguration();
    }

    // Obtener el número máximo de alertas detalladas por lote
    const maxSizePerBatch = this.config && this.config.queue ?
      this.config.queue.maxSizePerBatch : 3;

    // Crear un resumen de las alertas para enviar un único SMS
    const alertCount = this.messageQueue.temperatureAlerts.length;
    let message = `ALERTA: ${alertCount} sensor${alertCount > 1 ? "es" : ""
      } fuera de rango. `;

    // Incluir solo los primeros N canales con detalle para no exceder límite de SMS
    const detailLimit = Math.min(maxSizePerBatch, alertCount);
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
      // Limpiar la cola y actualizar métricas
      const processedCount = this.messageQueue.temperatureAlerts.length;
      this.messageQueue.temperatureAlerts = [];
      this.messageQueue.lastProcessed = new Date();
      this.metrics.queueStats.processed += processedCount;

      console.log(
        `SMS Service - Cola de alertas procesada: ${processedCount} alertas enviadas en un SMS consolidado`
      );
      return { success: true, processed: processedCount };
    } else {
      // Actualizar métricas de fallo
      this.metrics.queueStats.failed += this.messageQueue.temperatureAlerts.length;

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
      const added = this.addTemperatureAlertToQueue(
        channelName,
        temperature,
        timestamp,
        minThreshold,
        maxThreshold
      );
      return { success: added, queued: true };
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
      queueCreated: this.messageQueue.createdAt,
      successRate:
        this.metrics.sentMessages + this.metrics.failedMessages > 0
          ? (
            (this.metrics.sentMessages /
              (this.metrics.sentMessages + this.metrics.failedMessages)) *
            100
          ).toFixed(2) + "%"
          : "N/A",
      initialized: this.initialized,
      configLoaded: this.config !== null,
      timestamp: new Date(),
    };
  }

  /**
   * Permite reiniciar el servicio y sus métricas
   */
  reset() {
    // Reiniciar métricas
    this.metrics = {
      sentMessages: 0,
      failedMessages: 0,
      lastError: null,
      lastSuccessTime: null,
      queueStats: {
        added: 0,
        processed: 0,
        failed: 0
      }
    };

    // Reiniciar cola
    this.messageQueue = {
      createdAt: new Date(),
      temperatureAlerts: [],
      lastProcessed: null,
    };

    // Reiniciar estado
    this.initialized = false;

    // Recargar configuración
    this.loadConfiguration();

    console.log("SMS Service - Servicio reiniciado");
    return true;
  }
}

module.exports = new SMSService();
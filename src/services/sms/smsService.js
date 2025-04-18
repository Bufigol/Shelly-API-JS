// src/services/sms/smsService.js

const axios = require("axios");
const BaseAlertService = require("../baseAlertService"); // Hereda de BaseAlertService
const config = require("../../config/js_files/config-loader");
const moment = require("moment-timezone");
const notificationController = require("../../controllers/notificationController"); // Para isWithinWorkingHours

/**
 * Servicio centralizado para el envío de SMS a través de un módem remoto.
 * Hereda funcionalidades base de BaseAlertService.
 */
class SmsService extends BaseAlertService {
    constructor() {
        super(); // Llama al constructor de BaseAlertService
        this.axios = axios; // Usar la instancia importada
        this.config = null; // Se cargará en initialize
        this.defaultRecipients = [];
        this.timeZone = "America/Santiago"; // Se actualizará en initialize
        // Métricas y Cola se inicializan en BaseAlertService y aquí si es necesario
         this.metrics = { // Reinicializar métricas específicas si es necesario
             sentAlerts: 0,
             failedAlerts: 0,
             lastError: null,
             lastSuccessTime: null,
             queueStats: {
                 added: 0,
                 processed: 0,
                 failed: 0
             }
         };
        this.messageQueue = { // Reinicializar cola específica si es necesario
            createdAt: new Date(),
            temperatureAlerts: [], // Cola específica para alertas de temperatura SMS
            lastProcessed: null,
        };
        // La inicialización se hará explícitamente
    }

    /**
     * Inicializa el servicio SMS.
     * Carga la configuración específica de SMS.
     */
    async initialize() {
        if (this.initialized) return;

        console.log("Inicializando SmsService...");
        try {
            // 1. Cargar Configuración específica de SMS
            const appConfig = config.getConfig(); // Obtener configuración general

            if (!appConfig.sms || !appConfig.sms.modem || !appConfig.sms.modem.url) {
                console.warn("⚠️ Configuración de SMS o del módem no encontrada/incompleta. Intentando usar valores por defecto o respaldo.");
                // Intentar usar una configuración mínima por defecto o lanzar error
                this.config = { // Configuración mínima de respaldo/defecto
                    modem: { url: null, apiPath: '/api', host: '192.168.8.1', timeout: 15000, retry: { maxRetries: 2, retryDelays: [10000, 7000], timeBetweenRecipients: 8000 } },
                    workingHours: { weekdays: { start: 8.5, end: 18.5 }, saturday: { start: 8.5, end: 14.5 } },
                    timeZone: 'America/Santiago',
                    queue: { maxAgeHours: 24, maxSizePerBatch: 3 },
                    recipients: { default: [], disconnectionAlerts: [], temperatureAlerts: [], activacion: null, confirmacion: null }
                };
                // Intentar poblar desde la config cargada si alguna parte existe
                if (appConfig.sms) this.config = { ...this.config, ...appConfig.sms };
                if (appConfig.sms?.modem) this.config.modem = { ...this.config.modem, ...appConfig.sms.modem };
                if (appConfig.sms?.workingHours) this.config.workingHours = { ...this.config.workingHours, ...appConfig.sms.workingHours };
                if (appConfig.sms?.timeZone) this.config.timeZone = appConfig.sms.timeZone;
                if (appConfig.sms?.queue) this.config.queue = { ...this.config.queue, ...appConfig.sms.queue };
                if (appConfig.sms?.recipients) this.config.recipients = { ...this.config.recipients, ...appConfig.sms.recipients };

                 if (!this.config.modem.url) {
                    throw new Error("Configuración crítica faltante: URL del módem SMS no definida.");
                 }

            } else {
                 // Configuración encontrada, usarla
                 this.config = appConfig.sms;
                 // Asegurar valores por defecto si alguna sub-propiedad falta
                 // Usamos operador ?? para valores por defecto, más seguro que || para booleanos/números 0
                 this.config.modem = {
                    url: this.config.modem?.url ?? '', // Necesitamos una URL base
                    apiPath: this.config.modem?.apiPath ?? '/api',
                    host: this.config.modem?.host ?? '192.168.8.1',
                    timeout: this.config.modem?.timeout ?? 15000,
                    retry: {
                        maxRetries: this.config.modem?.retry?.maxRetries ?? 2,
                        retryDelays: this.config.modem?.retry?.retryDelays ?? [10000, 7000],
                        timeBetweenRecipients: this.config.modem?.retry?.timeBetweenRecipients ?? 8000
                    },
                    ...(this.config.modem ?? {}) // Sobrescribir con lo existente
                };
                 this.config.workingHours = { weekdays: { start: 8.5, end: 18.5 }, saturday: { start: 8.5, end: 14.5 }, ...(this.config.workingHours ?? {}) };
                 this.config.timeZone = this.config.timeZone ?? 'America/Santiago';
                 this.config.queue = { maxAgeHours: 24, maxSizePerBatch: 3, ...(this.config.queue ?? {}) };
                 this.config.recipients = { default: [], disconnectionAlerts: [], temperatureAlerts: [], activacion: null, confirmacion: null, ...(this.config.recipients ?? {}) };
            }


            this.timeZone = this.config.timeZone;
            this.defaultRecipients = this.config.recipients?.default || [];

            // Cargar destinatarios adicionales si es necesario (ej. desde archivo legacy)
             if (this.defaultRecipients.length === 0) {
                 try {
                     const smsConfigRecipients = require("../../config/jsons/destinatariosSmsUbibot.json");
                     this.defaultRecipients = smsConfigRecipients.sms_destinatarios || [];
                     this.config.recipients.default = this.defaultRecipients; // Actualizar config
                 } catch (e) {
                     console.warn("⚠️ No se pudo cargar archivo legacy de destinatarios SMS:", e.message);
                 }
             }

            // 3. Inicializar Timers de BaseAlertService
            super.initializeTimers();

            this.initialized = true;
            console.log("✅ SmsService inicializado correctamente.");
            console.log(`- URL Módem: ${this.config.modem.url}`);
            console.log(`- Destinatarios Default: ${this.defaultRecipients.length}`);

        } catch (error) {
            console.error("❌ Error inicializando SmsService:", error.message);
            this.initialized = false;
            // throw error; // Opcional: relanzar si es crítico
        }
    }

    /**
     * Verifica si el servicio SMS está correctamente configurado.
     * @returns {boolean} True si está listo para enviar SMS.
     */
    isConfigured() {
        const configured = this.initialized &&
               this.config &&
               this.config.modem &&
               this.config.modem.url && // Al menos la URL debe estar presente
               this.defaultRecipients && // Asegurar que hay una lista (puede estar vacía)
               Array.isArray(this.defaultRecipients);

        if (!configured && this.initialized) {
             console.warn("SmsService está inicializado pero no completamente configurado.");
             if (!this.config?.modem?.url) console.warn("- URL del módem faltante.");
             if (!Array.isArray(this.defaultRecipients)) console.warn("- Lista de destinatarios predeterminados inválida.");
        }
        return configured;
    }

    /**
     * Verifica si estamos dentro del horario laboral.
     * Delega a NotificationController.
     * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar.
     * @returns {boolean} true si estamos en horario laboral.
     */
    isWithinWorkingHours(checkTime = null) {
        // Usar NotificationController como fuente centralizada
        return notificationController.isWithinWorkingHours(checkTime);
    }


    // --- Métodos de Interacción con el Módem ---

    async checkModemConnection() {
        if (!this.isConfigured()) return false;
        try {
            const { url, apiPath, timeout } = this.config.modem;
            // Asegurarse que la URL es válida antes de usarla
            if (!url) throw new Error("URL del módem no configurada");
            const targetUrl = `${url}${apiPath}/status`;
            console.log(`Verificando conexión a: ${targetUrl}`); // Log para depuración
            const response = await this.axios.get(targetUrl, { timeout });
            return response.data?.connected === true;
        } catch (error) {
            // Loguear más detalles del error de conexión
            if (error.code) {
                 console.error(`Error de conexión (${error.code}) verificando módem: ${error.message}`);
            } else {
                 console.error("Error verificando conexión del módem:", error.message);
            }
            return false;
        }
    }

    getBasicHeaders() {
        return { Accept: "*/*", "X-Requested-With": "XMLHttpRequest", "Cache-Control": "no-cache", Pragma: "no-cache" };
    }

    async getToken() {
        if (!this.isConfigured()) throw new Error("Servicio SMS no configurado");
        const { url, apiPath, timeout } = this.config.modem;
        if (!url) throw new Error("URL del módem no configurada para obtener token");
        try {
            const targetUrl = `${url}${apiPath}/webserver/SesTokInfo`;
            const response = await this.axios.get(targetUrl, { headers: this.getBasicHeaders(), timeout: timeout || 5000 });
            const responseText = response.data;
            // Añadir validación de que responseText es un string
            if (typeof responseText !== 'string') {
                 throw new Error('Respuesta inesperada del módem al obtener token (no es string)');
            }
            const sessionIdMatch = responseText.match(/<SesInfo>(.*?)<\/SesInfo>/);
            const tokenMatch = responseText.match(/<TokInfo>(.*?)<\/TokInfo>/);
            if (!sessionIdMatch || !tokenMatch) throw new Error("No se pudo obtener token/sesión (respuesta inválida o vacía)");
            return { sessionId: sessionIdMatch[1].replace("SessionID=", ""), token: tokenMatch[1] };
        } catch (error) {
            console.error(`Error obteniendo token desde ${this.config.modem.url}:`, error.message);
            throw error; // Relanzar para manejo superior
        }
    }

    async verifyAndRefreshToken() {
        if (!this.isConfigured()) throw new Error("Servicio SMS no configurado");
        try {
            const { sessionId, token } = await this.getToken(); // Ya maneja error si falla
            const { url, host } = this.config.modem;
            if (!url) throw new Error("URL del módem no configurada para verificar token");
            return {
                headers: {
                    ...this.getBasicHeaders(),
                    "Accept-Encoding": "gzip, deflate", "Accept-Language": "es-ES,es;q=0.9",
                    Connection: "keep-alive", "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    Cookie: `SessionID=${sessionId}`, Host: host || "192.168.8.1", Origin: url,
                    Referer: `${url}/html/smsinbox.html`, __RequestVerificationToken: token,
                },
                sessionId, token,
            };
        } catch (error) {
            // El error ya fue logueado en getToken
            console.error("Fallo final al verificar/refrescar token.");
            throw error; // Relanzar
        }
    }

    formatPhoneNumber(phone) {
        if (!phone) return null;
        let formatted = phone.toString().replace(/\s+/g, "");
        if (!formatted.startsWith("+")) formatted = "+" + formatted;
        // Podría añadirse validación de longitud o patrón aquí si es necesario
        return formatted;
    }

    prepareSmsXml(phoneNumber, message) {
        // Escapar caracteres especiales en el mensaje para XML
        const escapedMessage = (message || '') // Asegurar que message es string
            .replace(/&/g, '&')
            .replace(/</g, '<')            
            .replace(/>/g, '>')
            .replace(/"/g, '"')
            .replace(/'/g, '\'');

        return `<?xml version="1.0" encoding="UTF-8"?>
          <request>
              <Index>-1</Index>
              <Phones><Phone>${phoneNumber}</Phone></Phones>
              <Sca></Sca>
              <Content>${escapedMessage}</Content>
              <Length>${escapedMessage.length}</Length> <!-- Usar longitud del mensaje escapado -->
              <Reserved>1</Reserved>
              <Date>${new Date().toISOString().replace("T", " ").split(".")[0]}</Date>
          </request>`;
    }

    extractErrorFromResponse(responseData) {
        if (!responseData || typeof responseData !== 'string') return null;
        try {
            // Intentar extraer código y mensaje
            const codeMatch = responseData.match(/<code>(.*?)<\/code>/);
            const messageMatch = responseData.match(/<message>(.*?)<\/message>/);
            if (codeMatch && messageMatch) return `Código: ${codeMatch[1]}, Mensaje: ${messageMatch[1]}`;
            if (codeMatch) return `Código: ${codeMatch[1]}`;
            if (messageMatch) return messageMatch[1];
            // Si no hay etiquetas XML, buscar patrones comunes de error
            if (responseData.includes('Unauthorized') || responseData.includes('forbidden')) return 'Error de autenticación/autorización';
            if (responseData.includes('timeout')) return 'Timeout';
        } catch (e) { /* Ignorar error de parseo */ }
        // Devolver una parte del error si no se pudo parsear
        return responseData.substring(0, 100) + (responseData.length > 100 ? '...' : '');
    }

    /**
     * Método interno para enviar SMS a un destinatario con lógica de reintentos.
     * NO actualiza métricas generales, eso lo hace el método público que lo llama.
     * @private
     */
    async _sendSingleSmsWithRetry(destinatario, message, retryAttempt = 0) {
        // Nota: isConfigured ya se valida en el método público
        const formattedPhone = this.formatPhoneNumber(destinatario);
        if (!formattedPhone) {
            console.error("Número de teléfono inválido para _sendSingleSmsWithRetry:", destinatario);
            return false;
        }

        const { retry, url, apiPath, timeout } = this.config.modem;
        const maxRetries = retry?.maxRetries ?? 2;
        const retryDelays = retry?.retryDelays ?? [10000, 7000];
        const effectiveTimeout = timeout || 15000;

        if (!url) {
             console.error("URL del módem no configurada en _sendSingleSmsWithRetry");
             return false;
        }

        try {
            if (retryAttempt > 0) {
                const waitTime = retryDelays[retryAttempt - 1] || 5000;
                console.log(`Reintento SMS ${retryAttempt}/${maxRetries} para ${formattedPhone} tras ${waitTime}ms`);
                await new Promise((resolve) => setTimeout(resolve, waitTime));
            }

            // Obtener token y headers frescos para cada intento (importante si hay errores de sesión)
            const { headers } = await this.verifyAndRefreshToken();
            const smsData = this.prepareSmsXml(formattedPhone, message);
            const targetUrl = `${url}${apiPath}/sms/send-sms`;

            console.log(`Intentando enviar SMS a ${formattedPhone} (Intento ${retryAttempt + 1})`); // Log
            const response = await this.axios({
                method: "post",
                url: targetUrl,
                data: smsData,
                headers: headers,
                transformRequest: [(data) => data], // Necesario para enviar XML como string
                validateStatus: (status) => status >= 200 && status < 500, // Aceptar 4xx como respuesta válida para análisis
                timeout: effectiveTimeout,
            });

             // Analizar la respuesta
            if (response.status === 200 && response.data?.includes("<response>OK</response>")) {
                // Éxito explícito del módem
                console.log(`Éxito enviando SMS a ${formattedPhone} (Intento ${retryAttempt + 1})`);
                return true;
            }

            // Si no es OK, intentar extraer error
            const errorMsg = this.extractErrorFromResponse(response.data) || `Estado HTTP ${response.status}`;
            console.warn(`Respuesta no OK del módem para ${formattedPhone} (Intento ${retryAttempt + 1}): ${errorMsg}`);

            // Lógica de reintento para errores específicos
             // Código 113018 podría ser error de token/sesión
            const shouldRetry = response.data?.includes("<code>113018</code>") || response.status >= 500; // Reintentar en errores de servidor también

            if (shouldRetry && retryAttempt < maxRetries) {
                console.log(`Reintentando debido a: ${errorMsg}`);
                 // Espera corta antes de reintentar si es error de autenticación
                 if (response.data?.includes("<code>113018</code>")) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                 }
                 return this._sendSingleSmsWithRetry(destinatario, message, retryAttempt + 1);
            }

            // Si no es OK y no se reintenta, lanzar error para el catch externo
            throw new Error(`Error final del módem: ${errorMsg}`);

        } catch (error) {
            // Captura errores de red, timeouts, o el error lanzado arriba
            console.error(`Error en _sendSingleSmsWithRetry para ${formattedPhone} (Intento ${retryAttempt + 1}):`, error.message);
            // Reintentar si es un error de red/timeout y quedan intentos
            const isNetworkError = error.code && ['ECONNABORTED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(error.code);
            if (isNetworkError && retryAttempt < maxRetries) {
                 return this._sendSingleSmsWithRetry(destinatario, message, retryAttempt + 1);
            } else {
                 // Fallo final después de reintentos o error no recuperable
                 return false;
            }
        }
    }

    // --- Métodos Públicos de Envío ---

    /**
     * Envía un SMS a múltiples destinatarios, manejando métricas.
     */
    async sendSMS(message, recipients = null, forceOutsideWorkingHours = false) {
        if (!this.isConfigured()) {
             console.error("SmsService no configurado.");
             return { success: false, sentCount: 0, failedCount: 0, reason: "not_configured" };
        }
        if (!forceOutsideWorkingHours && this.isWithinWorkingHours()) {
            console.log("SMS Service: Dentro de horario laboral. Envío pospuesto.");
            return { success: false, sentCount: 0, failedCount: 0, reason: "working_hours" };
        }
        if (!message || typeof message !== 'string' || message.trim() === '') {
             console.error("Mensaje SMS inválido.");
             return { success: false, sentCount: 0, failedCount: 0, reason: "invalid_message" };
        }

        const smsRecipients = recipients || this.defaultRecipients;
        if (!smsRecipients || !Array.isArray(smsRecipients) || smsRecipients.length === 0) {
             console.error("No hay destinatarios SMS configurados.");
             return { success: false, sentCount: 0, failedCount: 0, reason: "no_recipients" };
        }

        const results = { success: true, sentCount: 0, failedCount: 0, recipients: {}, timestamp: new Date() };
        console.log(`Enviando SMS a ${smsRecipients.length} destinatarios...`);
        const timeBetween = this.config.modem.retry?.timeBetweenRecipients ?? 8000;

        for (const destinatario of smsRecipients) {
            // Llamar al método interno con reintentos
            const sent = await this._sendSingleSmsWithRetry(destinatario, message);
            if (sent) {
                results.sentCount++;
                results.recipients[destinatario] = "enviado";
                 this.metrics.sentAlerts++; // Actualizar métrica global
                 this.metrics.lastSuccessTime = new Date();
            } else {
                results.failedCount++;
                results.recipients[destinatario] = "fallido";
                results.success = false;
                 this.metrics.failedAlerts++; // Actualizar métrica global
                 this.metrics.lastError = `Fallo final al enviar a ${destinatario}`;
            }
            // Esperar entre destinatarios solo si hay más de uno y el envío anterior no falló inmediatamente
            if (smsRecipients.length > 1 && sent) {
                await new Promise(resolve => setTimeout(resolve, timeBetween));
            } else if (smsRecipients.length > 1 && !sent) {
                 // Opcional: esperar menos si falló, para no bloquear tanto
                 await new Promise(resolve => setTimeout(resolve, Math.min(timeBetween, 2000)));
            }
        }
        console.log(`Resultado envío SMS: ${results.sentCount} enviados, ${results.failedCount} fallidos.`);
        return results;
    }

     /**
      * Envía un SMS de alerta de temperatura.
      */
     async sendTemperatureAlert(formattedAlerts, recipients = null, forceOutsideWorkingHours = true) {
        if (!this.isConfigured()) return { success: false, reason: 'not_configured' };
        if (!formattedAlerts || formattedAlerts.length === 0) return { success: false, reason: 'no_alerts' };

        const smsRecipients = recipients || this.config.recipients?.temperatureAlerts || this.defaultRecipients;
        if (!smsRecipients || smsRecipients.length === 0) return { success: false, reason: 'no_recipients' };

        // Formatear el mensaje consolidado
        let message = `TEMPERATURA: ${formattedAlerts.length} sensor${formattedAlerts.length > 1 ? 'es' : ''} fuera de rango. `;
        const maxSizePerBatch = this.config.queue?.maxSizePerBatch || 3;
        const detailLimit = Math.min(maxSizePerBatch, formattedAlerts.length);
        for (let i = 0; i < detailLimit; i++) {
            message += `${formattedAlerts[i].name}: ${formattedAlerts[i].temperature}°C. `;
        }
        if (formattedAlerts.length > detailLimit) message += `Y ${formattedAlerts.length - detailLimit} más. `;
        message += `${moment().tz(this.timeZone).format("DD/MM HH:mm")}`;

        return await this.sendSMS(message, smsRecipients, forceOutsideWorkingHours);
     }

     /**
      * Envía un SMS de alerta de desconexión.
      */
     async sendDisconnectionAlert(disconnectedChannels, recipients = null, forceOutsideWorkingHours = true) {
         if (!this.isConfigured()) return { success: false, reason: 'not_configured' };
         if (!disconnectedChannels || disconnectedChannels.length === 0) return { success: false, reason: 'no_channels' };

         const smsRecipients = recipients || this.config.recipients?.disconnectionAlerts || this.defaultRecipients;
         if (!smsRecipients || smsRecipients.length === 0) return { success: false, reason: 'no_recipients' };

         // Formatear mensaje consolidado
         let message = `CONEXION: ${disconnectedChannels.length} sensor${disconnectedChannels.length > 1 ? 'es' : ''} con eventos. `;
         const maxSizePerBatch = this.config.queue?.maxSizePerBatch || 3;
         const detailLimit = Math.min(maxSizePerBatch, disconnectedChannels.length);
         for (let i = 0; i < detailLimit; i++) {
             const status = disconnectedChannels[i].lastEvent === "disconnected" ? "DESCONECT" : "CONECTADO";
             message += `${disconnectedChannels[i].name}: ${status}. `;
         }
         if (disconnectedChannels.length > detailLimit) message += `Y ${disconnectedChannels.length - detailLimit} más. `;
         message += `${moment().tz(this.timeZone).format("DD/MM HH:mm")}`;

         return await this.sendSMS(message, smsRecipients, forceOutsideWorkingHours);
     }

    // --- Métodos de Manejo de Cola ---

    addTemperatureAlertToQueue(channelName, temperature, timestamp, minThreshold, maxThreshold) {
        if (!channelName || isNaN(temperature)) {
             console.error('Datos de alerta de temperatura inválidos para encolar.');
             return false;
        }
        this.cleanupStaleAlerts();
        this.messageQueue.temperatureAlerts.push({ channelName, temperature, timestamp, minThreshold, maxThreshold, queuedAt: new Date() });
        this.metrics.queueStats.added++;
        console.log(`SMS Service: Alerta temp para ${channelName} encolada (${this.messageQueue.temperatureAlerts.length} en cola)`);
        return true;
    }

    cleanupStaleAlerts() {
        const maxAgeHours = this.config.queue?.maxAgeHours ?? 24;
        const now = new Date();
        const ageLimit = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);
        const initialLength = this.messageQueue.temperatureAlerts.length;
        this.messageQueue.temperatureAlerts = this.messageQueue.temperatureAlerts.filter(a => a.queuedAt > ageLimit);
        const removedCount = initialLength - this.messageQueue.temperatureAlerts.length;
        if (removedCount > 0) console.log(`SMS Service: Limpieza de cola, ${removedCount} alertas antiguas eliminadas.`);
    }

    async processTemperatureAlertQueue(forceOutsideWorkingHours = false) {
        const queue = this.messageQueue.temperatureAlerts;
        if (queue.length === 0) return { success: true, processed: 0 };

        if (!forceOutsideWorkingHours && this.isWithinWorkingHours()) {
            console.log("SMS Service: Dentro de horario laboral, procesamiento de cola pospuesto.");
            return { success: false, processed: 0, reason: "working_hours" };
        }

        // Tomar una copia de las alertas a procesar ahora
        const alertsToProcess = [...queue];
        // Limpiar la cola original inmediatamente para evitar procesamiento duplicado si hay concurrencia
        this.messageQueue.temperatureAlerts = [];


        // Reutilizar la lógica de sendTemperatureAlert para formatear y enviar
        const result = await this.sendTemperatureAlert(alertsToProcess, null, forceOutsideWorkingHours);

        if (result.success) {
            const processedCount = alertsToProcess.length;
            this.messageQueue.lastProcessed = new Date();
            this.metrics.queueStats.processed += processedCount;
            console.log(`SMS Service: Cola procesada, ${processedCount} alertas enviadas.`);
            return { success: true, processed: processedCount };
        } else {
            this.metrics.queueStats.failed += alertsToProcess.length;
            console.error("SMS Service: Error al procesar cola de alertas SMS:", result);
             // Opcional: Re-encolar las alertas fallidas si tiene sentido
             // this.messageQueue.temperatureAlerts.unshift(...alertsToProcess);
            return { success: false, processed: 0, error: result };
        }
    }

    // --- Métodos Heredados / Otros ---

    // processAlert (de BaseAlertService): Decide qué hacer con una alerta genérica
    async processAlert(alert) {
         // Por ahora, solo manejamos la cola de temperatura explícitamente
        if (alert.type === 'queued_temperature') {
             return this.processTemperatureAlertQueue(false); // Respetar horario
        } else {
             console.warn(`SmsService: Tipo de alerta no manejado en processAlert: ${alert.type}`);
             // Opcional: intentar enviar como mensaje genérico si tiene 'message'
             if (alert.data?.message) {
                 return this.sendSMS(alert.data.message, alert.recipients, false);
             }
        }
         return { success: false, reason: 'unhandled_type' };
    }

    getMetrics() {
        // Combina métricas base con las específicas de esta clase
        const baseMetrics = super.getMetrics ? super.getMetrics() : {}; // Llamar a super si existe
        return {
            ...baseMetrics,
            service: "sms", // Identificar el servicio
            queuedAlerts: this.messageQueue?.temperatureAlerts?.length ?? 0, // Cola específica
            lastProcessedQueue: this.messageQueue?.lastProcessed,
            // Usar métricas locales que se actualizan correctamente
            sentAlerts: this.metrics.sentAlerts,
            failedAlerts: this.metrics.failedAlerts,
            lastError: this.metrics.lastError,
            lastSuccessTime: this.metrics.lastSuccessTime,
            queueStats: this.metrics.queueStats,
            initialized: this.initialized,
            configLoaded: this.config !== null && this.config.modem?.url !== null, // Mejor indicador
            timestamp: new Date()
        };
    }

     reset() {
         if (super.reset) super.reset(); // Llama al reset de BaseAlertService si existe
         // Reiniciar estado/métricas/cola específicos de SmsService
         this.metrics = { sentAlerts: 0, failedAlerts: 0, lastError: null, lastSuccessTime: null, queueStats: { added: 0, processed: 0, failed: 0 } };
         this.messageQueue = { createdAt: new Date(), temperatureAlerts: [], lastProcessed: null };
         this.initialized = false;
         this.initialize(); // Re-inicializar
         console.log("SmsService: Servicio reiniciado.");
         return true;
     }

}

module.exports = new SmsService(); // Exportar instancia única
// src/controllers/notificationController.js

const mysql = require("mysql2/promise");
const moment = require("moment-timezone");
const config = require("../config/js_files/config-loader");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");

class NotificationController {
    constructor() {
        // Cargar configuración global
        this.config = config.getConfig();

        // Configurar zona horaria desde la configuración
        this.timeZone = this.config.sms?.timeZone || "America/Santiago";

        // Crear pool de conexiones usando la configuración de la base de datos
        this.pool = mysql.createPool({
            host: this.config.database.host,
            user: this.config.database.username,
            password: this.config.database.password,
            database: this.config.database.database,
            waitForConnections: true,
            connectionLimit: this.config.database.pool?.max_size || 10,
            queueLimit: 0,
        });

        // Intervalos de tiempo (en minutos) - Usar valores de config si están disponibles
        this.alertGroupingInterval =
            (this.config.alertSystem?.intervals?.processing || 60 * 60 * 1000) / (60 * 1000);

        this.disconnectionAlertThreshold =
            (this.config.alertSystem?.intervals?.disconnection?.initialDelay || 60);

        this.cleanupInterval =
            (this.config.alertSystem?.intervals?.cleanup || 12 * 60 * 1000) / (60 * 1000);

        // Estructura para almacenar contadores de temperatura fuera de rango
        this.tempAlertCounters = {}; // Formato: { channelId: { count: X, lastUpdate: timestamp, values: [] } }

        // Buffers para agrupar alertas
        this.temperatureAlertBuffer = {
            timestamp: new Date(),
            alerts: [],
        };

        this.disconnectionAlertBuffer = {
            timestamp: new Date(),
            alerts: [],
        };

        // Configuración de timers
        this.setupTimers();

        console.log("✅ NotificationController inicializado");
        console.log(`  - Zona horaria: ${this.timeZone}`);
        console.log(`  - Intervalo de agrupación: ${this.alertGroupingInterval} minutos`);
        console.log(`  - Umbral de desconexión: ${this.disconnectionAlertThreshold} minutos`);
        console.log(`  - Intervalo de limpieza: ${this.cleanupInterval} minutos`);
    }

    /**
     * Configura los timers para procesar alertas y limpiar contadores
     */
    setupTimers() {
        // Timer para procesar alertas de temperatura agrupadas
        setInterval(() => {
            this.processBufferedTemperatureAlerts();
        }, this.alertGroupingInterval * 60 * 1000);

        // Timer para procesar alertas de desconexión agrupadas
        setInterval(() => {
            this.processBufferedDisconnectionAlerts();
        }, this.alertGroupingInterval * 60 * 1000);

        // Timer para limpiar contadores antiguos
        setInterval(() => {
            this.cleanupOldCounters();
        }, this.cleanupInterval * 60 * 1000);

        console.log("Timers configurados para procesamiento de alertas");
    }

    /**
     * Verifica si es horario laboral según la configuración
     * @returns {boolean} true si es horario laboral, false si no
     */
    isWithinWorkingHours() {
        const now = moment().tz(this.timeZone);
        const hourDecimal = now.hour() + now.minute() / 60;
        const dayOfWeek = now.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado

        // Obtener la configuración del horario laboral desde config-loader
        const workingHours = this.config.sms?.workingHours || {
            weekdays: { start: 8.5, end: 18.5 },
            saturday: { start: 8.5, end: 14.5 }
        };

        // Domingo siempre fuera de horario laboral
        if (dayOfWeek === 0) return false;

        // Sábado tiene horario especial
        if (dayOfWeek === 6) {
            return (
                hourDecimal >= workingHours.saturday.start &&
                hourDecimal <= workingHours.saturday.end
            );
        }

        // Lunes a viernes
        return (
            hourDecimal >= workingHours.weekdays.start &&
            hourDecimal <= workingHours.weekdays.end
        );
    }

    /**
     * Procesa una nueva lectura de temperatura
     * @param {string} channelId - ID del canal/sensor
     * @param {string} channelName - Nombre del canal/sensor
     * @param {number} temperature - Temperatura detectada
     * @param {string} timestamp - Timestamp de la lectura
     * @param {number} minThreshold - Umbral mínimo de temperatura
     * @param {number} maxThreshold - Umbral máximo de temperatura
     * @param {boolean} isOperational - Si el canal está operativo
     * @returns {Promise<void>}
     */
    async processTemperatureReading(
        channelId,
        channelName,
        temperature,
        timestamp,
        minThreshold,
        maxThreshold,
        isOperational
    ) {
        try {
            // Si el canal no está operativo, ignorarlo
            if (!isOperational) {
                console.log(`Canal ${channelName} (${channelId}) no operativo. Ignorando lectura.`);
                return;
            }

            // Verificar si la temperatura está fuera de rango
            const isOutOfRange = temperature < minThreshold || temperature > maxThreshold;

            // Inicializar contador si no existe
            if (!this.tempAlertCounters[channelId]) {
                this.tempAlertCounters[channelId] = {
                    count: 0,
                    lastUpdate: new Date(),
                    values: []
                };
            }

            const counter = this.tempAlertCounters[channelId];

            if (isOutOfRange) {
                // Incrementar contador
                counter.count++;
                counter.lastUpdate = new Date();
                counter.values.push({
                    temperature,
                    timestamp,
                    minThreshold,
                    maxThreshold
                });

                console.log(`Canal ${channelName} (${channelId}): Temperatura fuera de rango (${temperature}°C). Contador: ${counter.count}/3`);

                // Si ha alcanzado 3 ciclos consecutivos, agregar a buffer de alertas
                if (counter.count >= 3) {
                    await this.addToTemperatureAlertBuffer(
                        channelId,
                        channelName,
                        counter.values
                    );

                    // Resetear contador después de enviar la alerta
                    counter.count = 0;
                    counter.values = [];
                }
            } else {
                // Si la temperatura vuelve al rango normal, resetear contador
                if (counter.count > 0) {
                    console.log(`Canal ${channelName} (${channelId}): Temperatura normalizada (${temperature}°C). Reseteando contador.`);
                    counter.count = 0;
                    counter.values = [];
                }
            }
        } catch (error) {
            console.error(`Error al procesar lectura de temperatura para ${channelId}:`, error);
            this.logError(`Error al procesar lectura de temperatura para ${channelId}: ${error.message}`);
        }
    }

    /**
     * Procesa un evento de cambio de estado de conexión
     * @param {string} channelId - ID del canal 
     * @param {string} channelName - Nombre del canal
     * @param {boolean} isOnline - Si el canal está en línea
     * @param {boolean} wasOffline - Si el canal estaba fuera de línea anteriormente
     * @param {Date} outOfRangeSince - Desde cuándo está fuera de línea
     * @param {Date|null} lastAlertSent - Cuándo se envió la última alerta
     * @param {boolean} isOperational - Si el canal está operativo
     * @returns {Promise<void>}
     */
    async processConnectionStatusChange(
        channelId,
        channelName,
        isOnline,
        wasOffline,
        outOfRangeSince,
        lastAlertSent,
        isOperational
    ) {
        try {
            // Si el canal no está operativo, ignorarlo
            if (!isOperational) {
                console.log(`Canal ${channelName} (${channelId}) no operativo. Ignorando cambio de conexión.`);
                return;
            }

            const now = new Date();

            if (!isOnline) {
                // Si está offline
                if (wasOffline) {
                    // Ya estaba offline, verificar si debemos enviar una alerta
                    if (outOfRangeSince) {
                        const minutesOffline = (now - new Date(outOfRangeSince)) / (60 * 1000);

                        // Verificar si ha estado desconectado por el tiempo umbral
                        if (minutesOffline >= this.disconnectionAlertThreshold) {
                            // Verificar si ya enviamos una alerta y si ha pasado al menos el tiempo umbral desde la última
                            const shouldSendAlert = !lastAlertSent ||
                                ((now - new Date(lastAlertSent)) / (60 * 1000) >= this.disconnectionAlertThreshold);

                            if (shouldSendAlert) {
                                await this.addToDisconnectionAlertBuffer(
                                    channelId,
                                    channelName,
                                    outOfRangeSince,
                                    minutesOffline
                                );

                                // Actualizar timestamp de última alerta en la base de datos
                                const connection = await this.pool.getConnection();
                                try {
                                    await connection.query(
                                        "UPDATE channels_ubibot SET last_alert_sent = ? WHERE channel_id = ?",
                                        [now, channelId]
                                    );
                                } finally {
                                    connection.release();
                                }
                            }
                        }
                    }
                } else {
                    // Acaba de quedar offline, solo registrarlo (la actualización de la BD se hace en ubibotService)
                    console.log(`Canal ${channelName} (${channelId}) ha quedado fuera de línea.`);
                }
            } else if (wasOffline) {
                // El canal ha vuelto a estar online después de estar offline
                console.log(`Canal ${channelName} (${channelId}) ha vuelto a estar en línea.`);
            }
        } catch (error) {
            console.error(`Error al procesar cambio de estado de conexión para ${channelId}:`, error);
            this.logError(`Error al procesar cambio de estado de conexión para ${channelId}: ${error.message}`);
        }
    }

    /**
     * Añade una alerta de temperatura al buffer
     * @param {string} channelId - ID del canal
     * @param {string} channelName - Nombre del canal
     * @param {Array} measurements - Mediciones de temperatura que causaron la alerta
     * @returns {Promise<void>}
     */
    async addToTemperatureAlertBuffer(channelId, channelName, measurements) {
        this.temperatureAlertBuffer.alerts.push({
            channelId,
            channelName,
            measurements: [...measurements], // Copia para evitar modificaciones
            addedAt: new Date()
        });

        console.log(`Alerta de temperatura para ${channelName} añadida al buffer. Total: ${this.temperatureAlertBuffer.alerts.length}`);

        // Si no estamos en horario laboral, procesar inmediatamente
        if (!this.isWithinWorkingHours()) {
            await this.processBufferedTemperatureAlerts();
        }
    }

    /**
     * Añade una alerta de desconexión al buffer
     * @param {string} channelId - ID del canal
     * @param {string} channelName - Nombre del canal
     * @param {Date} outOfRangeSince - Desde cuándo está fuera de línea
     * @param {number} minutesOffline - Minutos que ha estado desconectado
     * @returns {Promise<void>}
     */
    async addToDisconnectionAlertBuffer(channelId, channelName, outOfRangeSince, minutesOffline) {
        this.disconnectionAlertBuffer.alerts.push({
            channelId,
            channelName,
            outOfRangeSince,
            minutesOffline,
            addedAt: new Date()
        });

        console.log(`Alerta de desconexión para ${channelName} añadida al buffer. Total: ${this.disconnectionAlertBuffer.alerts.length}`);

        // Si no estamos en horario laboral, procesar inmediatamente
        if (!this.isWithinWorkingHours()) {
            await this.processBufferedDisconnectionAlerts();
        }
    }

    /**
     * Procesa las alertas de temperatura en el buffer
     * @returns {Promise<void>}
     */
    async processBufferedTemperatureAlerts() {
        // Si no hay alertas, no hacer nada
        if (this.temperatureAlertBuffer.alerts.length === 0) {
            return;
        }

        // Si estamos en horario laboral, posponer el procesamiento
        if (this.isWithinWorkingHours()) {
            console.log("En horario laboral. Posponiendo procesamiento de alertas de temperatura.");
            return;
        }

        try {
            const alerts = [...this.temperatureAlertBuffer.alerts];
            console.log(`Procesando ${alerts.length} alertas de temperatura.`);

            // Preparar datos para la notificación
            const formattedAlerts = alerts.map(alert => {
                // Usar solo la última medición para el resumen
                const latestMeasurement = alert.measurements[alert.measurements.length - 1];
                return {
                    name: alert.channelName,
                    temperature: latestMeasurement.temperature,
                    timestamp: latestMeasurement.timestamp,
                    minThreshold: latestMeasurement.minThreshold,
                    maxThreshold: latestMeasurement.maxThreshold
                };
            });

            // Enviar alertas por email y SMS
            const result = await this.sendTemperatureAlerts(formattedAlerts);

            if (result.success) {
                console.log(`Alertas de temperatura enviadas correctamente: ${alerts.length}`);
                this.logToDatabase(`Alertas de temperatura enviadas: ${alerts.length} canales`);

                // Limpiar el buffer
                this.temperatureAlertBuffer.alerts = [];
                this.temperatureAlertBuffer.timestamp = new Date();
            } else {
                console.error("Error al enviar alertas de temperatura:", result.error);
                this.logError(`Error al enviar alertas de temperatura: ${result.error}`);
            }
        } catch (error) {
            console.error("Error al procesar alertas de temperatura:", error);
            this.logError(`Error al procesar alertas de temperatura: ${error.message}`);
        }
    }

    /**
     * Procesa las alertas de desconexión en el buffer
     * @returns {Promise<void>}
     */
    async processBufferedDisconnectionAlerts() {
        // Si no hay alertas, no hacer nada
        if (this.disconnectionAlertBuffer.alerts.length === 0) {
            return;
        }

        // Si estamos en horario laboral, posponer el procesamiento
        if (this.isWithinWorkingHours()) {
            console.log("En horario laboral. Posponiendo procesamiento de alertas de desconexión.");
            return;
        }

        try {
            const alerts = [...this.disconnectionAlertBuffer.alerts];
            console.log(`Procesando ${alerts.length} alertas de desconexión.`);

            // Preparar datos para la notificación
            const formattedAlerts = alerts.map(alert => {
                return {
                    name: alert.channelName,
                    lastConnectionTime: alert.outOfRangeSince,
                    disconnectionInterval: Math.round(alert.minutesOffline)
                };
            });

            // Enviar alertas por email y SMS
            const result = await this.sendDisconnectionAlerts(formattedAlerts);

            if (result.success) {
                console.log(`Alertas de desconexión enviadas correctamente: ${alerts.length}`);
                this.logToDatabase(`Alertas de desconexión enviadas: ${alerts.length} canales`);

                // Limpiar el buffer
                this.disconnectionAlertBuffer.alerts = [];
                this.disconnectionAlertBuffer.timestamp = new Date();
            } else {
                console.error("Error al enviar alertas de desconexión:", result.error);
                this.logError(`Error al enviar alertas de desconexión: ${result.error}`);
            }
        } catch (error) {
            console.error("Error al procesar alertas de desconexión:", error);
            this.logError(`Error al procesar alertas de desconexión: ${error.message}`);
        }
    }

    /**
     * Envía alertas de temperatura por email y SMS
     * @param {Array} alerts - Alertas formateadas
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async sendTemperatureAlerts(alerts) {
        try {
            // Enviar por Email
            const emailResult = await emailService.sendTemperatureRangeAlertsEmail(
                alerts,
                new Date(),
                null, // Usar destinatarios predeterminados
                true  // Forzar envío incluso si estamos en horario laboral (ya verificamos antes)
            );

            // Enviar por SMS (formato más compacto)
            const smsMessage = this.formatTemperatureAlertsForSMS(alerts);
            const smsResult = await smsService.sendSMS(
                smsMessage,
                null, // Usar destinatarios predeterminados
                true  // Forzar envío incluso si estamos en horario laboral
            );

            return {
                success: emailResult && smsResult.success,
                emailResult,
                smsResult
            };
        } catch (error) {
            console.error("Error al enviar alertas de temperatura:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Envía alertas de desconexión por email y SMS
     * @param {Array} alerts - Alertas formateadas
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async sendDisconnectionAlerts(alerts) {
        try {
            // Enviar por Email
            const emailResult = await emailService.sendDisconnectedSensorsEmail(
                alerts,
                null // Usar destinatarios predeterminados
            );

            // Enviar por SMS (formato más compacto)
            const smsMessage = this.formatDisconnectionAlertsForSMS(alerts);
            const smsResult = await smsService.sendSMS(
                smsMessage,
                this.config.sms?.recipients?.disconnectionAlerts || null, // Usar destinatarios específicos para desconexión o predeterminados
                true  // Forzar envío incluso si estamos en horario laboral
            );

            return {
                success: emailResult && smsResult.success,
                emailResult,
                smsResult
            };
        } catch (error) {
            console.error("Error al enviar alertas de desconexión:", error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Formatea alertas de temperatura para SMS
     * @param {Array} alerts - Alertas
     * @returns {string} Mensaje formateado
     */
    formatTemperatureAlertsForSMS(alerts) {
        const count = alerts.length;
        let message = `ALERTA TEMPERATURA: ${count} sensor${count > 1 ? 'es' : ''} fuera de rango. `;

        // Obtener límite máximo de alertas detalladas desde configuración
        const maxSizePerBatch = this.config.sms?.queue?.maxSizePerBatch || 3;

        // Incluir detalles para los primeros N sensores
        const detailLimit = Math.min(maxSizePerBatch, count);
        for (let i = 0; i < detailLimit; i++) {
            const alert = alerts[i];
            message += `${alert.name}: ${alert.temperature}°C. `;
        }

        // Si hay más de N, agregar resumen
        if (count > detailLimit) {
            message += `Y ${count - detailLimit} más. `;
        }

        // Añadir timestamp
        message += `${moment().tz(this.timeZone).format("DD/MM HH:mm")}`;

        return message;
    }

    /**
     * Formatea alertas de desconexión para SMS
     * @param {Array} alerts - Alertas
     * @returns {string} Mensaje formateado
     */
    formatDisconnectionAlertsForSMS(alerts) {
        const count = alerts.length;
        let message = `ALERTA DESCONEXION: ${count} sensor${count > 1 ? 'es' : ''} offline. `;

        // Obtener límite máximo de alertas detalladas desde configuración
        const maxSizePerBatch = this.config.sms?.queue?.maxSizePerBatch || 3;

        // Incluir detalles para los primeros N sensores
        const detailLimit = Math.min(maxSizePerBatch, count);
        for (let i = 0; i < detailLimit; i++) {
            const alert = alerts[i];
            message += `${alert.name}: ${alert.disconnectionInterval}min. `;
        }

        // Si hay más de N, agregar resumen
        if (count > detailLimit) {
            message += `Y ${count - detailLimit} más. `;
        }

        // Añadir timestamp
        message += `${moment().tz(this.timeZone).format("DD/MM HH:mm")}`;

        return message;
    }

    /**
     * Limpia contadores antiguos
     */
    cleanupOldCounters() {
        const now = new Date();
        const cutoffTime = new Date(now.getTime() - (this.cleanupInterval * 60 * 1000));

        let cleanupCount = 0;

        // Limpiar contadores de temperatura
        for (const channelId in this.tempAlertCounters) {
            const counter = this.tempAlertCounters[channelId];
            if (counter.lastUpdate < cutoffTime) {
                delete this.tempAlertCounters[channelId];
                cleanupCount++;
            }
        }

        if (cleanupCount > 0) {
            console.log(`Limpiados ${cleanupCount} contadores de temperatura antiguos.`);
        }
    }

    /**
     * Registra un mensaje en la tabla process_log
     * @param {string} message - Mensaje a registrar
     */
    async logToDatabase(message) {
        const connection = await this.pool.getConnection();
        try {
            await connection.query("INSERT INTO process_log (message) VALUES (?)", [message]);
        } catch (error) {
            console.error("Error al registrar en la base de datos:", error);
        } finally {
            connection.release();
        }
    }

    /**
     * Registra un error en la tabla process_log
     * @param {string} errorMessage - Mensaje de error
     */
    async logError(errorMessage) {
        const fullMessage = `ERROR: ${errorMessage}`;
        await this.logToDatabase(fullMessage);
    }
}

module.exports = new NotificationController();
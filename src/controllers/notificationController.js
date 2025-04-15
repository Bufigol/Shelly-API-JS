// src/controllers/notificationController.js

const mysql = require("mysql2/promise");
const moment = require("moment-timezone");
const config = require("../config/js_files/config-loader");
const emailService = require("../services/email/emailService");
const smsService = require("../services/sms/smsService");


class NotificationController {
    constructor() {
        // Cargar configuración global
        this.config = config.getConfig();

        // Configurar zona horaria desde la configuración centralizada
        this.timeZone = this.config.alertSystem?.timeZone || "America/Santiago";

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

        // Obtener horario laboral de la configuración centralizada
        this.workingHours = this.config.alertSystem?.workingHours || {
            weekdays: { start: 8.5, end: 18.5 }, // Por defecto: 8:30 - 18:30
            saturday: { start: 8.5, end: 14.5 }  // Por defecto: 8:30 - 14:30
        };

        // Intervalos de tiempo (en minutos)
        this.alertGroupingInterval = 60; // 1 hora para procesar alertas agrupadas
        this.disconnectionAlertThreshold = 60; // 1 hora umbral para alertas de desconexión
        this.cleanupInterval = 720; // 12 horas para limpieza

        // Estructura para almacenar contadores de temperatura fuera de rango
        this.tempAlertCounters = {}; // Formato: { channelId: { count: X, lastUpdate: timestamp, values: [] } }

        // NUEVAS ESTRUCTURAS: Buffers de alertas organizados por hora
        this.temperatureAlertsByHour = {}; // { "YYYY-MM-DD-HH": { "channelId": [alerts...] } }
        this.disconnectionAlertsByHour = {}; // { "YYYY-MM-DD-HH": { "channelId": [events...] } }

        // Timers
        this.hourlyProcessingTimer = null;
        this.recurringHourlyTimer = null;

        // Mantener buffers antiguos para compatibilidad
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
        console.log(`  - Horario laboral L-V: ${this.workingHours.weekdays.start} - ${this.workingHours.weekdays.end}`);
        console.log(`  - Horario laboral Sábado: ${this.workingHours.saturday.start} - ${this.workingHours.saturday.end}`);
        console.log(`  - Intervalo de agrupación: ${this.alertGroupingInterval} minutos`);
        console.log(`  - Umbral de desconexión: ${this.disconnectionAlertThreshold} minutos`);
        console.log(`  - Intervalo de limpieza: ${this.cleanupInterval} minutos`);
    }

    /**
     * Configura los timers para procesar alertas y limpiar contadores
     */
    setupTimers() {
        // NUEVO: Timer para procesar alertas acumuladas cada hora
        this.setupHourlyAlertProcessing();

        // Timer para limpiar contadores antiguos (mantener)
        setInterval(() => {
            this.cleanupOldCounters();
            this.cleanupOldHourlyAlerts(); // NUEVO: Limpiar alertas antiguas por hora
        }, this.cleanupInterval * 60 * 1000);

        console.log("Timers configurados para procesamiento de alertas");
    }

    /**
     * Configura el timer para procesar alertas cada hora
     * Este método programa un timer para que se ejecute al inicio de cada hora
     */
    setupHourlyAlertProcessing() {
        try {
            // Calcular el tiempo hasta el inicio de la próxima hora
            const now = new Date();
            const nextHour = new Date(now);
            nextHour.setHours(now.getHours() + 1, 0, 0, 0);
            const timeToNextHour = nextHour - now;

            console.log(`Configurando timer para procesar alertas en la próxima hora (${nextHour.toISOString()})`);
            console.log(`Tiempo hasta la próxima hora: ${Math.round(timeToNextHour / 1000 / 60)} minutos y ${Math.round((timeToNextHour / 1000) % 60)} segundos`);

            // Programar para la próxima hora
            this.hourlyProcessingTimer = setTimeout(() => {
                console.log(`Ejecutando procesamiento de alertas programado para: ${new Date().toISOString()}`);

                // Procesar inmediatamente
                this.processHourlyAlerts()
                    .then(() => {
                        console.log("Procesamiento de alertas completado correctamente");
                    })
                    .catch(err => {
                        console.error("Error durante el procesamiento de alertas:", err);
                    });

                // Configurar timer recurrente cada hora exacta
                this.recurringHourlyTimer = setInterval(() => {
                    const currentTime = new Date();
                    console.log(`Ejecutando procesamiento recurrente de alertas: ${currentTime.toISOString()}`);

                    this.processHourlyAlerts()
                        .then(() => {
                            console.log("Procesamiento recurrente de alertas completado");
                        })
                        .catch(err => {
                            console.error("Error durante el procesamiento recurrente de alertas:", err);
                        });
                }, 60 * 60 * 1000); // 1 hora

            }, timeToNextHour);

            // Guardar referencia a la hora programada para debugging
            this.nextScheduledProcessing = nextHour;

            console.log("Timer para procesamiento horario de alertas configurado correctamente");
        } catch (error) {
            console.error("Error al configurar timer para procesamiento de alertas:", error);
            // Intentar recuperarse programando para el siguiente minuto
            console.log("Intentando recuperación...");
            setTimeout(() => {
                this.setupHourlyAlertProcessing();
            }, 60 * 1000); // Intentar de nuevo en 1 minuto
        }
    }

    /**
     * Detiene y limpia los timers de procesamiento de alertas
     * Útil para reinicio o recarga de configuración
     */
    cleanupTimers() {
        if (this.hourlyProcessingTimer) {
            clearTimeout(this.hourlyProcessingTimer);
            this.hourlyProcessingTimer = null;
            console.log("Timer de procesamiento inicial de alertas detenido");
        }

        if (this.recurringHourlyTimer) {
            clearInterval(this.recurringHourlyTimer);
            this.recurringHourlyTimer = null;
            console.log("Timer recurrente de procesamiento de alertas detenido");
        }
    }

    /**
     * Genera una clave para el diccionario de alertas por hora
     * @param {Date} date - Fecha para la cual generar la clave
     * @returns {string} - Clave en formato "YYYY-MM-DD-HH"
     */
    getHourKey(date = null) {
        const d = date || new Date();
        const localTime = moment(d).tz(this.timeZone);
        return `${localTime.format("YYYY-MM-DD-HH")}`;
    }

    /**
     * Verifica si es horario laboral según la configuración centralizada
     * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar
     * @returns {boolean} true si es horario laboral, false si no
     */
    isWithinWorkingHours(checkTime = null) {
        const now = moment(checkTime || new Date()).tz(this.timeZone);
        const hourDecimal = now.hour() + now.minute() / 60;
        const dayOfWeek = now.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado

        // Domingo siempre fuera de horario laboral
        if (dayOfWeek === 0) return false;

        // Sábado tiene horario especial
        if (dayOfWeek === 6) {
            return (
                hourDecimal >= this.workingHours.saturday.start &&
                hourDecimal <= this.workingHours.saturday.end
            );
        }

        // Lunes a viernes
        return (
            hourDecimal >= this.workingHours.weekdays.start &&
            hourDecimal <= this.workingHours.weekdays.end
        );
    }

    /**
     * Procesa las alertas acumuladas en la hora anterior
     * @returns {Promise<void>}
     */
    async processHourlyAlerts() {
        try {
            const now = new Date();
            const currentHourKey = this.getHourKey(now);

            // Calcular la hora anterior para procesar sus alertas
            const prevHour = new Date(now);
            prevHour.setHours(prevHour.getHours() - 1);
            const prevHourKey = this.getHourKey(prevHour);

            console.log(`[${now.toISOString()}] Procesando alertas acumuladas para la hora: ${prevHourKey}`);

            // Verificar si hay alertas para procesar
            const hasDisconnectionAlerts = this.disconnectionAlertsByHour[prevHourKey] &&
                Object.keys(this.disconnectionAlertsByHour[prevHourKey]).length > 0;

            const hasTemperatureAlerts = this.temperatureAlertsByHour[prevHourKey] &&
                Object.keys(this.temperatureAlertsByHour[prevHourKey]).length > 0;

            if (!hasDisconnectionAlerts && !hasTemperatureAlerts) {
                console.log(`No hay alertas para procesar en la hora ${prevHourKey}`);
                return;
            }

            // Procesar alertas de desconexión de la hora anterior
            if (hasDisconnectionAlerts) {
                try {
                    await this.processHourlyDisconnectionAlerts(prevHourKey);
                    console.log(`Alertas de desconexión para la hora ${prevHourKey} procesadas correctamente`);
                } catch (error) {
                    console.error(`Error al procesar alertas de desconexión para la hora ${prevHourKey}:`, error);
                    // No interrumpir el procesamiento de alertas de temperatura
                }
            } else {
                console.log(`No hay alertas de desconexión para la hora ${prevHourKey}`);
            }

            // Procesar alertas de temperatura (solo si estamos fuera del horario laboral)
            if (hasTemperatureAlerts) {
                const isWorkingHours = this.isWithinWorkingHours(now);

                if (!isWorkingHours) {
                    try {
                        await this.processHourlyTemperatureAlerts(prevHourKey);
                        console.log(`Alertas de temperatura para la hora ${prevHourKey} procesadas correctamente`);
                    } catch (error) {
                        console.error(`Error al procesar alertas de temperatura para la hora ${prevHourKey}:`, error);
                    }
                } else {
                    console.log(`Dentro de horario laboral. Posponiendo ${Object.keys(this.temperatureAlertsByHour[prevHourKey]).length} alertas de temperatura.`);

                    // Mover las alertas de temperatura a la hora actual para intentar procesarlas después
                    // Esto asegura que no se pierdan si ocurrieron fuera del horario laboral
                    if (!this.temperatureAlertsByHour[currentHourKey]) {
                        this.temperatureAlertsByHour[currentHourKey] = {};
                    }

                    // Copiar alertas de la hora anterior a la hora actual
                    for (const channelId in this.temperatureAlertsByHour[prevHourKey]) {
                        if (!this.temperatureAlertsByHour[currentHourKey][channelId]) {
                            this.temperatureAlertsByHour[currentHourKey][channelId] = [];
                        }

                        // Copiar cada alerta
                        for (const alert of this.temperatureAlertsByHour[prevHourKey][channelId]) {
                            this.temperatureAlertsByHour[currentHourKey][channelId].push({
                                ...alert,
                                postponed: true // Marcar como pospuesta
                            });
                        }
                    }

                    console.log(`Alertas de temperatura movidas a la hora actual ${currentHourKey} para procesamiento posterior`);
                }
            } else {
                console.log(`No hay alertas de temperatura para la hora ${prevHourKey}`);
            }

            // Limpiar alertas procesadas 
            // (solo limpiamos las alertas de desconexión, ya que las de temperatura pueden haberse movido)
            if (this.disconnectionAlertsByHour[prevHourKey]) {
                delete this.disconnectionAlertsByHour[prevHourKey];
                console.log(`Alertas de desconexión para la hora ${prevHourKey} eliminadas después de procesamiento`);
            }

            // Si las alertas de temperatura se procesaron (fuera de horario laboral), también las limpiamos
            if (hasTemperatureAlerts && !this.isWithinWorkingHours(now)) {
                delete this.temperatureAlertsByHour[prevHourKey];
                console.log(`Alertas de temperatura para la hora ${prevHourKey} eliminadas después de procesamiento`);
            }

            console.log(`Procesamiento de alertas para la hora ${prevHourKey} completado`);
        } catch (error) {
            console.error("Error general durante el procesamiento de alertas:", error);
            // Registrar el error pero no relanzarlo para no interrumpir el ciclo de timers
            this.logError(`Error en procesamiento de alertas: ${error.message}`);
        }
    }

    /**
 * Procesa las alertas de desconexión para una hora específica
 * @param {string} hourKey - Clave de hora en formato "YYYY-MM-DD-HH"
 */
    async processHourlyDisconnectionAlerts(hourKey) {
        try {
            const alertsForHour = this.disconnectionAlertsByHour[hourKey] || {};
            const channelIds = Object.keys(alertsForHour);

            if (channelIds.length === 0) {
                console.log(`No hay alertas de desconexión para la hora ${hourKey}`);
                return;
            }

            console.log(`Procesando ${channelIds.length} canales con alertas de desconexión para la hora ${hourKey}`);

            // Preparar los datos para enviar por email/SMS
            const formattedAlerts = [];

            for (const channelId of channelIds) {
                const events = alertsForHour[channelId] || [];
                if (events.length === 0) continue;

                // Obtener información del canal
                const channelName = events[0].channelName || `Canal ${channelId}`;

                // Detectar eventos de desconexión y reconexión
                let disconnectTime = null;
                let reconnectTime = null;

                // Analizar la secuencia de eventos para encontrar desconexiones y reconexiones
                for (const event of events) {
                    if (event.event === "disconnected" && !disconnectTime) {
                        disconnectTime = event.timestamp;
                    } else if (event.event === "connected" && disconnectTime && !reconnectTime) {
                        reconnectTime = event.timestamp;
                    }
                }

                // Determinar el estado final según el último evento
                const lastEvent = events[events.length - 1];

                formattedAlerts.push({
                    name: channelName,
                    channelId: channelId,
                    events: events,
                    lastEvent: lastEvent.event,
                    disconnectTime: disconnectTime,
                    reconnectTime: reconnectTime,
                    lastConnectionTime: lastEvent.timestamp
                });
            }

            if (formattedAlerts.length > 0) {
                // Enviar por Email
                try {
                    const emailResult = await emailService.sendDisconnectedSensorsEmail(formattedAlerts);
                    console.log(`Email de alertas de desconexión enviado: ${emailResult ? 'éxito' : 'fallo'}`);
                } catch (error) {
                    console.error("Error al enviar email de desconexión:", error);
                    this.logError(`Error al enviar email de desconexión: ${error.message}`);
                }

                // Enviar por SMS
                try {
                    const smsResult = await smsService.sendDisconnectionAlert(formattedAlerts, null, true);
                    console.log(`SMS de alertas de desconexión enviado: ${smsResult.success ? 'éxito' : 'fallo'}`);
                } catch (error) {
                    console.error("Error al enviar SMS de desconexión:", error);
                    this.logError(`Error al enviar SMS de desconexión: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`Error al procesar alertas de desconexión para la hora ${hourKey}:`, error);
            this.logError(`Error al procesar alertas de desconexión para la hora ${hourKey}: ${error.message}`);
            throw error; // Relanzar para manejo en el nivel superior
        }
    }

    /**
 * Procesa las alertas de temperatura para una hora específica
 * @param {string} hourKey - Clave de hora en formato "YYYY-MM-DD-HH"
 */
    async processHourlyTemperatureAlerts(hourKey) {
        try {
            const alertsForHour = this.temperatureAlertsByHour[hourKey] || {};
            const channelIds = Object.keys(alertsForHour);

            if (channelIds.length === 0) {
                console.log(`No hay alertas de temperatura para la hora ${hourKey}`);
                return;
            }

            console.log(`Procesando ${channelIds.length} canales con alertas de temperatura para la hora ${hourKey}`);

            // Preparar los datos para enviar por email/SMS
            const formattedAlerts = [];

            for (const channelId of channelIds) {
                const alerts = alertsForHour[channelId] || [];
                if (alerts.length === 0) continue;

                // Ordenar alertas por timestamp para asegurar que la última sea la más reciente
                const sortedAlerts = [...alerts].sort((a, b) =>
                    new Date(a.timestamp || a.detectedAt).getTime() -
                    new Date(b.timestamp || b.detectedAt).getTime()
                );

                // Usar la última alerta para el resumen
                const lastAlert = sortedAlerts[sortedAlerts.length - 1];

                formattedAlerts.push({
                    name: lastAlert.channelName,
                    temperature: lastAlert.temperature,
                    timestamp: lastAlert.timestamp || lastAlert.detectedAt,
                    minThreshold: lastAlert.minThreshold,
                    maxThreshold: lastAlert.maxThreshold,
                    allReadings: sortedAlerts // Incluir todas las lecturas para detalles
                });
            }

            if (formattedAlerts.length > 0) {
                // Enviar por Email
                try {
                    const emailResult = await emailService.sendTemperatureRangeAlertsEmail(
                        formattedAlerts,
                        new Date(),
                        null, // Usar destinatarios predeterminados
                        true  // Forzar envío incluso si estamos en horario laboral (ya verificamos antes)
                    );
                    console.log(`Email de alertas de temperatura enviado: ${emailResult ? 'éxito' : 'fallo'}`);
                } catch (error) {
                    console.error("Error al enviar email de temperatura:", error);
                    this.logError(`Error al enviar email de temperatura: ${error.message}`);
                }

                // Enviar por SMS
                try {
                    const smsResult = await smsService.sendTemperatureAlert(formattedAlerts, null, true);
                    console.log(`SMS de alertas de temperatura enviado: ${smsResult.success ? 'éxito' : 'fallo'}`);
                } catch (error) {
                    console.error("Error al enviar SMS de temperatura:", error);
                    this.logError(`Error al enviar SMS de temperatura: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`Error al procesar alertas de temperatura para la hora ${hourKey}:`, error);
            this.logError(`Error al procesar alertas de temperatura para la hora ${hourKey}: ${error.message}`);
            throw error; // Relanzar para manejo en el nivel superior
        }
    }

    /**
     * Limpia las alertas antiguas por hora
     */
    cleanupOldHourlyAlerts() {
        const now = new Date();
        const cutoffHours = 24; // Mantener alertas de las últimas 24 horas

        // Eliminar alertas más antiguas que el umbral
        const cutoffTime = new Date(now.getTime() - (cutoffHours * 60 * 60 * 1000));

        // Limpiar alertas de temperatura
        Object.keys(this.temperatureAlertsByHour).forEach(hourKey => {
            const [year, month, day, hour] = hourKey.split('-').map(Number);
            const hourDate = new Date(year, month - 1, day, hour);

            if (hourDate < cutoffTime) {
                delete this.temperatureAlertsByHour[hourKey];
            }
        });

        // Limpiar alertas de desconexión
        Object.keys(this.disconnectionAlertsByHour).forEach(hourKey => {
            const [year, month, day, hour] = hourKey.split('-').map(Number);
            const hourDate = new Date(year, month - 1, day, hour);

            if (hourDate < cutoffTime) {
                delete this.disconnectionAlertsByHour[hourKey];
            }
        });
    }

    /**
     * Limpia las alertas de una hora específica después de procesarlas
     * @param {string} hourKey - Clave de hora en formato "YYYY-MM-DD-HH"
     */
    cleanupProcessedHourlyAlerts(hourKey) {
        if (this.temperatureAlertsByHour[hourKey]) {
            delete this.temperatureAlertsByHour[hourKey];
        }

        if (this.disconnectionAlertsByHour[hourKey]) {
            delete this.disconnectionAlertsByHour[hourKey];
        }

        console.log(`Alertas para la hora ${hourKey} eliminadas después de procesamiento`);
    }

    /**
     * Procesa un evento de cambio de estado de conexión
     * Modificado para acumular alertas por hora
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
            // IMPORTANTE: Si el canal no está operativo, ignorarlo
            if (!isOperational) {
                console.log(`Canal ${channelName} (${channelId}) no operativo. Ignorando cambio de conexión.`);
                return;
            }

            const now = new Date();
            const hourKey = this.getHourKey(now);

            // Inicializar estructura para este canal y hora si no existe
            if (!this.disconnectionAlertsByHour[hourKey]) {
                this.disconnectionAlertsByHour[hourKey] = {};
            }

            if (!this.disconnectionAlertsByHour[hourKey][channelId]) {
                this.disconnectionAlertsByHour[hourKey][channelId] = [];
            }

            // Determinar el tipo de evento
            const eventType = isOnline ? "connected" : "disconnected";

            // Registrar el evento
            this.disconnectionAlertsByHour[hourKey][channelId].push({
                channelId,
                channelName,
                event: eventType,
                timestamp: now.toISOString(),
                outOfRangeSince: outOfRangeSince ? new Date(outOfRangeSince).toISOString() : null
            });

            console.log(`Evento de ${eventType} para canal ${channelName} (${channelId}) registrado para la hora ${hourKey}`);

            // Mantener comportamiento para compatibilidad con sistema anterior
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
                                // Solo actualizar timestamp de última alerta en la base de datos
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
            console.error(`Error al procesar cambio de estado de conexión para ${channelId}:`, error.message);
            this.logError(`Error al procesar cambio de estado de conexión para ${channelId}: ${error.message}`);
        }
    }

    /**
     * Procesa una nueva lectura de temperatura
     * Modificado para acumular alertas por hora
     * @param {string} channelId - ID del canal
     * @param {string} channelName - Nombre del canal
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
            // IMPORTANTE: Si el canal no está operativo, ignorarlo
            if (!isOperational) {
                console.log(`Canal ${channelName} (${channelId}) no operativo. Ignorando lectura.`);
                return;
            }

            // Verificar si la temperatura está fuera de rango
            const isOutOfRange = temperature < minThreshold || temperature > maxThreshold;

            // Si no está fuera de rango, simplemente retornar
            if (!isOutOfRange) {
                // Si había un contador activo, resetearlo
                if (this.tempAlertCounters[channelId] && this.tempAlertCounters[channelId].count > 0) {
                    console.log(`Canal ${channelName} (${channelId}): Temperatura normalizada (${temperature}°C). Reseteando contador.`);
                    this.tempAlertCounters[channelId].count = 0;
                    this.tempAlertCounters[channelId].values = [];
                }
                return;
            }

            // Inicializar contador si no existe
            if (!this.tempAlertCounters[channelId]) {
                this.tempAlertCounters[channelId] = {
                    count: 0,
                    lastUpdate: new Date(),
                    values: []
                };
            }

            const counter = this.tempAlertCounters[channelId];

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

            // Si ha alcanzado 3 ciclos consecutivos, agregar a buffer de alertas por hora
            if (counter.count >= 3) {
                const now = new Date();
                const hourKey = this.getHourKey(now);

                // Inicializar estructura para este canal y hora si no existe
                if (!this.temperatureAlertsByHour[hourKey]) {
                    this.temperatureAlertsByHour[hourKey] = {};
                }

                if (!this.temperatureAlertsByHour[hourKey][channelId]) {
                    this.temperatureAlertsByHour[hourKey][channelId] = [];
                }

                // Registrar la alerta
                this.temperatureAlertsByHour[hourKey][channelId].push({
                    channelId,
                    channelName,
                    temperature,
                    timestamp,
                    minThreshold,
                    maxThreshold,
                    detectedAt: now.toISOString()
                });

                console.log(`Alerta de temperatura para canal ${channelName} (${channelId}) registrada para la hora ${hourKey}`);

                // Resetear contador después de registrar la alerta
                counter.count = 0;
                counter.values = [];
            }
        } catch (error) {
            console.error(`Error al procesar lectura de temperatura para ${channelId}:`, error);
            this.logError(`Error al procesar lectura de temperatura para ${channelId}: ${error.message}`);
        }
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
    * Formatea alertas de desconexión para SMS
    * Actualizado para el nuevo formato de alertas por hora
    * @param {Array} alerts - Alertas formateadas
    * @returns {string} - Mensaje formateado para SMS
    */
    formatDisconnectionAlertsForSMS(alerts) {
        const count = alerts.length;
        let message = `ALERTA DESCONEXION: ${count} sensor${count > 1 ? 'es' : ''} reportados. `;

        // Obtener límite máximo de alertas detalladas desde configuración
        const maxSizePerBatch = this.config.sms?.queue?.maxSizePerBatch || 3;

        // Incluir detalles para los primeros N sensores
        const detailLimit = Math.min(maxSizePerBatch, count);
        for (let i = 0; i < detailLimit; i++) {
            const alert = alerts[i];
            const status = alert.lastEvent === "disconnected" ? "DESCONECTADO" : "RECONECTADO";
            message += `${alert.name}: ${status}. `;
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
     * Formatea alertas de temperatura para SMS
     * Actualizado para el nuevo formato de alertas por hora
     * @param {Array} alerts - Alertas formateadas
     * @returns {string} - Mensaje formateado para SMS
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

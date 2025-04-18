const moment = require("moment-timezone");
const config = require("../config/js_files/config-loader");

/**
 * Servicio base para el manejo de alertas
 * Contiene toda la funcionalidad común entre los diferentes tipos de alertas
 */
class BaseAlertService {
    constructor() {
        this.config = this.loadConfiguration();
        this.initialized = false;
        this.timeZone = this.config.alertSystem?.timeZone || "America/Santiago";
        this.workingHours = this.config.alertSystem?.workingHours || {
            weekdays: { start: 8.5, end: 18.5 },
            saturday: { start: 8.5, end: 14.5 }
        };

        // Inicializar métricas
        this.metrics = {
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

        // Inicializar cola de alertas
        this.alertQueue = {
            createdAt: new Date(),
            alerts: [],
            lastProcessed: null
        };

        // Inicializar temporizadores
        this.timers = {
            processing: null,
            cleanup: null
        };
    }

    /**
     * Carga la configuración del sistema de alertas
     */
    loadConfiguration() {
        try {
            const appConfig = config.getConfig();
            return appConfig.alertSystem || {};
        } catch (error) {
            console.error("Error cargando configuración de alertas:", error);
            return {};
        }
    }

    /**
     * Verifica si estamos dentro del horario laboral
     * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar
     * @returns {boolean} true si estamos en horario laboral
     */
    isWithinWorkingHours(checkTime = null) {
        let timeToCheck;
        if (checkTime) {
            timeToCheck = moment.isMoment(checkTime)
                ? checkTime.clone()
                : moment(checkTime);
        } else {
            timeToCheck = moment();
        }

        const localTime = timeToCheck.tz(this.timeZone);
        const dayOfWeek = localTime.day();
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
     * Inicializa los temporizadores del servicio
     */
    initializeTimers() {
        // Limpiar temporizadores existentes
        this.cleanupTimers();

        // Configurar temporizador de procesamiento
        const processingInterval = this.config.intervals?.processing || 60 * 60 * 1000; // 1 hora por defecto
        this.timers.processing = setInterval(
            () => this.processAlertQueue(),
            processingInterval
        );

        // Configurar temporizador de limpieza
        const cleanupInterval = this.config.intervals?.cleanup || 12 * 60 * 60 * 1000; // 12 horas por defecto
        this.timers.cleanup = setInterval(
            () => this.cleanupOldAlerts(),
            cleanupInterval
        );
    }

    /**
     * Limpia los temporizadores del servicio
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
     * Agrega una alerta a la cola
     * @param {Object} alert - Datos de la alerta
     * @param {string} alert.type - Tipo de alerta
     * @param {Object} alert.data - Datos específicos de la alerta
     * @returns {boolean} true si se agregó correctamente
     */
    addAlertToQueue(alert) {
        if (!alert || !alert.type || !alert.data) {
            console.error("Alerta inválida:", alert);
            return false;
        }

        // Limpiar alertas antiguas
        this.cleanupOldAlerts();

        // Agregar a la cola
        this.alertQueue.alerts.push({
            ...alert,
            queuedAt: new Date()
        });

        // Actualizar métricas
        this.metrics.queueStats.added++;

        console.log(
            `Alerta ${alert.type} agregada a la cola (${this.alertQueue.alerts.length} alertas en cola)`
        );
        return true;
    }

    /**
     * Procesa la cola de alertas
     * @param {boolean} [forceOutsideWorkingHours=false] - Forzar procesamiento en horario laboral
     */
    async processAlertQueue(forceOutsideWorkingHours = false) {
        if (this.alertQueue.alerts.length === 0) {
            return { success: true, processed: 0 };
        }

        // Verificar horario laboral
        if (!forceOutsideWorkingHours && this.isWithinWorkingHours()) {
            console.log("Dentro de horario laboral. Posponiendo procesamiento de alertas.");
            return { success: false, processed: 0, reason: "working_hours" };
        }

        try {
            // Procesar cada alerta
            const processedAlerts = [];
            const failedAlerts = [];

            for (const alert of this.alertQueue.alerts) {
                try {
                    await this.processAlert(alert);
                    processedAlerts.push(alert);
                } catch (error) {
                    console.error(`Error procesando alerta ${alert.type}:`, error);
                    failedAlerts.push(alert);
                }
            }

            // Actualizar métricas
            this.metrics.queueStats.processed += processedAlerts.length;
            this.metrics.queueStats.failed += failedAlerts.length;
            this.metrics.lastSuccessTime = new Date();

            // Limpiar alertas procesadas
            this.alertQueue.alerts = failedAlerts;
            this.alertQueue.lastProcessed = new Date();

            return {
                success: processedAlerts.length > 0,
                processed: processedAlerts.length,
                failed: failedAlerts.length
            };
        } catch (error) {
            console.error("Error procesando cola de alertas:", error);
            this.metrics.lastError = error.message;
            return { success: false, error: error.message };
        }
    }

    /**
     * Procesa una alerta individual
     * @param {Object} alert - Alerta a procesar
     * @abstract
     */
    async processAlert(alert) {
        throw new Error("processAlert debe ser implementado por las clases hijas");
    }

    /**
     * Limpia alertas antiguas de la cola
     */
    cleanupOldAlerts() {
        const maxAgeHours = this.config.retention?.maxAgeHours || 24;
        const now = new Date();
        const ageLimit = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);

        const initialLength = this.alertQueue.alerts.length;
        this.alertQueue.alerts = this.alertQueue.alerts.filter(
            alert => alert.queuedAt && alert.queuedAt > ageLimit
        );

        const removedCount = initialLength - this.alertQueue.alerts.length;
        if (removedCount > 0) {
            console.log(`Limpieza de cola: ${removedCount} alertas antiguas eliminadas`);
        }
    }

    /**
     * Obtiene el estado actual del servicio
     */
    getStatus() {
        return {
            initialized: this.initialized,
            metrics: this.metrics,
            queue: {
                size: this.alertQueue.alerts.length,
                lastProcessed: this.alertQueue.lastProcessed,
                createdAt: this.alertQueue.createdAt
            },
            config: {
                timeZone: this.timeZone,
                workingHours: this.workingHours
            }
        };
    }
}

module.exports = BaseAlertService; 
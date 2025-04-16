// src/controllers/notificationController.js

const mysql = require("mysql2/promise");
const moment = require("moment-timezone");
const config = require("../config/js_files/config-loader");
const emailService = require("../services/email/emailService"); // Usar el servicio consolidado
const smsService = require("../services/sms/smsService");     // Usar el servicio consolidado

class NotificationController {
    constructor() {
        // Cargar configuración global
        this.appConfig = config.getConfig(); // Renombrar para evitar colisión con this.config interno si lo hubiera

        // Configurar zona horaria desde la configuración centralizada
        this.timeZone = this.appConfig.alertSystem?.timeZone || "America/Santiago";

        // Crear pool de conexiones usando la configuración de la base de datos
        // Validar que la configuración de BD existe
        if (!this.appConfig.database?.host) {
            console.error("❌ [NotificationCtrl] Error CRÍTICO: Configuración de base de datos no encontrada al inicializar.");
            // Lanzar error podría ser apropiado para detener el arranque si la BD es esencial
            throw new Error("Configuración de base de datos faltante o incompleta.");
        }
        this.pool = mysql.createPool({
            host: this.appConfig.database.host,
            user: this.appConfig.database.username,
            password: this.appConfig.database.password, // Asumiendo que se lee de env o se maneja seguro
            database: this.appConfig.database.database,
            waitForConnections: true,
            connectionLimit: this.appConfig.database.pool?.max_size || 10,
            queueLimit: 0,
        });

        // Obtener horario laboral de la configuración centralizada
        this.workingHours = this.appConfig.alertSystem?.workingHours || {
            weekdays: { start: 8.5, end: 18.5 }, // Por defecto: 8:30 - 18:30
            saturday: { start: 8.5, end: 14.5 }  // Por defecto: 8:30 - 14:30
        };

        // Intervalos de tiempo (en minutos) - Estos podrían venir de config también
        this.alertGroupingInterval = this.appConfig.alertSystem?.intervals?.processingMinutes || 60; // Intervalo de procesamiento horario
        this.disconnectionAlertThreshold = this.appConfig.alertSystem?.intervals?.disconnection?.initialDelay || 60; // Umbral para considerar desconectado (si se usa)
        this.cleanupInterval = this.appConfig.alertSystem?.intervals?.cleanupMinutes || 720; // 12 horas para limpieza

        // Estructura para almacenar contadores de temperatura fuera de rango
        this.tempAlertCounters = {}; // Formato: { channelId: { count: X, lastUpdate: timestamp, values: [] } }

        // Buffers de alertas por hora para agrupar notificaciones
        this.temperatureAlertsByHour = {}; // { "YYYY-MM-DD-HH": { "channelId": [alerts...] } }
        this.disconnectionAlertsByHour = {}; // { "YYYY-MM-DD-HH": { "channelId": [eventos...] } } // <--- Estructura modificada en Paso 2

        // Timers
        this.hourlyProcessingTimer = null;
        this.recurringHourlyTimer = null;
        this.cleanupTimer = null; // Timer específico para limpieza

        // Configuración de timers
        this.setupTimers();

        console.log("✅ NotificationController inicializado");
        console.log(`  - Zona horaria: ${this.timeZone}`);
        console.log(`  - Horario laboral L-V: ${this.workingHours.weekdays.start} - ${this.workingHours.weekdays.end}`);
        console.log(`  - Horario laboral Sábado: ${this.workingHours.saturday.start} - ${this.workingHours.saturday.end}`);
        // Quitar logs redundantes de intervalos si ya se configuran desde appConfig
        // console.log(`  - Intervalo de agrupación: ${this.alertGroupingInterval} minutos`);
        // console.log(`  - Umbral de desconexión: ${this.disconnectionAlertThreshold} minutos`);
        console.log(`  - Intervalo de limpieza: ${this.cleanupInterval} minutos`);
    }

    /**
     * Configura los timers para procesar alertas y limpiar contadores/buffers antiguos.
     */
    setupTimers() {
        // Limpiar timers existentes por si se llama de nuevo (ej. recarga)
        this.cleanupTimers();

        // 1. Timer para procesar alertas acumuladas cada hora exacta
        this.setupHourlyAlertProcessing();

        // 2. Timer para limpieza periódica
        const cleanupIntervalMs = (this.cleanupInterval || 720) * 60 * 1000; // Default 12h
        this.cleanupTimer = setInterval(() => {
            console.log(`[NotificationCtrl] Ejecutando limpieza periódica...`);
            this.cleanupOldCounters();
            this.cleanupOldHourlyAlerts(); // Limpiar buffers horarios antiguos
        }, cleanupIntervalMs);

        console.log(`[NotificationCtrl] Timers configurados. Procesamiento cada hora, limpieza cada ${this.cleanupInterval} minutos.`);
    }

    /**
     * Configura el timer para procesar alertas cada hora exacta.
     */
    setupHourlyAlertProcessing() {
        try {
            // Calcular el tiempo hasta el inicio de la próxima hora
            const now = moment().tz(this.timeZone); // Usar moment con TZ
            const nextHour = now.clone().endOf('hour').add(1, 'millisecond'); // Próxima hora en punto
            const timeToNextHour = nextHour.diff(now);

            console.log(`[NotificationCtrl] Configurando timer para procesar alertas en la próxima hora (${nextHour.format()})`);
            console.log(`  -> Tiempo restante: ${moment.duration(timeToNextHour).humanize()}`);

            // Programar para la próxima hora
            this.hourlyProcessingTimer = setTimeout(() => {
                console.log(`[NotificationCtrl] Ejecutando procesamiento de alertas programado para: ${moment().tz(this.timeZone).format()}`);

                this.processHourlyAlerts()
                    .catch(err => console.error("❌ [NotificationCtrl] Error durante el procesamiento inicial de alertas:", err));

                // Configurar timer recurrente CADA HORA a partir de ahora
                // Usar '0 * * * *' (al minuto 0 de cada hora) con node-cron sería más preciso,
                // pero con setInterval nos aseguramos que corre 1h después del primero.
                if (this.recurringHourlyTimer) clearInterval(this.recurringHourlyTimer); // Limpiar anterior si existe
                this.recurringHourlyTimer = setInterval(async () => { // Hacer async para manejo de errores
                    const currentTime = moment().tz(this.timeZone);
                    console.log(`[NotificationCtrl] Ejecutando procesamiento recurrente de alertas: ${currentTime.format()}`);
                    try {
                        await this.processHourlyAlerts();
                    } catch (err) {
                        console.error("❌ [NotificationCtrl] Error durante el procesamiento recurrente de alertas:", err);
                    }
                }, 60 * 60 * 1000); // 1 hora en milisegundos

            }, timeToNextHour);

            console.log("[NotificationCtrl] Timer para procesamiento horario de alertas configurado.");
        } catch (error) {
            console.error("❌ [NotificationCtrl] Error al configurar timer para procesamiento de alertas:", error);
            // Intentar recuperación simple
            console.log("  -> Reintentando configuración del timer en 1 minuto...");
            setTimeout(() => { this.setupHourlyAlertProcessing(); }, 60 * 1000);
        }
    }

    /**
     * Detiene y limpia todos los timers activos del controlador.
     */
    cleanupTimers() {
        if (this.hourlyProcessingTimer) {
            clearTimeout(this.hourlyProcessingTimer);
            this.hourlyProcessingTimer = null;
            console.log("[NotificationCtrl] Timer de procesamiento inicial detenido.");
        }
        if (this.recurringHourlyTimer) {
            clearInterval(this.recurringHourlyTimer);
            this.recurringHourlyTimer = null;
            console.log("[NotificationCtrl] Timer recurrente de procesamiento detenido.");
        }
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            console.log("[NotificationCtrl] Timer de limpieza detenido.");
        }
    }

    /**
     * Genera una clave para el diccionario de alertas por hora (YYYY-MM-DD-HH).
     * @param {Date|moment.Moment|null} [date=null] - Fecha para la cual generar la clave (default: ahora).
     * @returns {string} Clave horaria.
     */
    getHourKey(date = null) {
        // Usar moment para asegurar manejo correcto de zona horaria
        const d = date ? moment(date).tz(this.timeZone) : moment().tz(this.timeZone);
        return d.format("YYYY-MM-DD-HH");
    }

    /**
     * Verifica si la hora actual (o una específica) está dentro del horario laboral configurado.
     * @param {Date|string|moment.Moment|null} [checkTime=null] - Tiempo a verificar (default: ahora).
     * @returns {boolean} true si está dentro del horario laboral.
     */
    isWithinWorkingHours(checkTime = null) {
        const now = checkTime ? moment(checkTime).tz(this.timeZone) : moment().tz(this.timeZone);
        const hourDecimal = now.hour() + now.minute() / 60;
        const dayOfWeek = now.day(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado

        if (dayOfWeek === 0) return false; // Domingo fuera
        if (dayOfWeek === 6) { // Sábado
            return hourDecimal >= this.workingHours.saturday.start && hourDecimal < this.workingHours.saturday.end; // Usar < para el fin? O <=? <= es más inclusivo
        }
        // Lunes a Viernes
        return hourDecimal >= this.workingHours.weekdays.start && hourDecimal < this.workingHours.weekdays.end; // Usar < para el fin? O <=?
    }

    // --- Métodos de Procesamiento de Alertas (Algunos se modificarán en pasos siguientes) ---

    /**
     * Punto de entrada principal para el procesamiento horario de alertas acumuladas.
     * @returns {Promise<void>}
     */
    /**
   * Punto de entrada principal para el procesamiento horario de alertas acumuladas.
   * Orquesta el procesamiento de alertas de desconexión y temperatura,
   * el envío de notificaciones y las actualizaciones de la base de datos.
   * @returns {Promise<void>}
   */
    async processHourlyAlerts() {
        const now = moment().tz(this.timeZone);
        const currentHourKey = this.getHourKey(now);
        // Procesar alertas de la HORA ANTERIOR
        const prevHour = now.clone().subtract(1, 'hour');
        const prevHourKey = this.getHourKey(prevHour);

        console.log(`[NotificationCtrl] processHourlyAlerts: Iniciando procesamiento para la hora ${prevHourKey}`);

        // --- 1. Procesar Desconexiones (SIEMPRE) ---
        let disconnectionResults = null;
        try {
            console.log(`[NotificationCtrl] processHourlyAlerts: Procesando alertas de conexión/desconexión para ${prevHourKey}...`);
            // Llamar al método refactorizado que analiza y prepara datos
            disconnectionResults = await this.processHourlyDisconnectionAlerts(prevHourKey);
            console.log(`[NotificationCtrl] processHourlyAlerts: Análisis de desconexión completado para ${prevHourKey}. Alertas a enviar: ${disconnectionResults?.formattedAlerts?.length ?? 0}.`);

        } catch (error) {
            console.error(`❌ [NotificationCtrl] Error CRÍTICO durante processHourlyDisconnectionAlerts para ${prevHourKey}:`, error.message);
            // Si falla el análisis, no podemos continuar con esta parte. Registrar y seguir con temperatura.
            disconnectionResults = null; // Asegurar que no se procesa más abajo
        }

        // --- 2. Enviar Correo de Desconexión y Actualizar BD (SI HAY ALERTAS Y EL ANÁLISIS FUE EXITOSO) ---
        if (disconnectionResults && disconnectionResults.formattedAlerts.length > 0) {
            console.log(`[NotificationCtrl] processHourlyAlerts: Intentando enviar correo para ${disconnectionResults.formattedAlerts.length} alertas de conexión/desconexión...`);
            let emailSentSuccessfully = false;
            try {
                // Enviar correo SIN importar horario laboral
                emailSentSuccessfully = await emailService.sendDisconnectedSensorsEmail(disconnectionResults.formattedAlerts);

                if (emailSentSuccessfully) {
                    console.log("  -> Correo de conexión/desconexión enviado exitosamente.");
                } else {
                    console.error("  -> Fallo reportado por emailService al enviar correo de conexión/desconexión.");
                    // No actualizar BD si el correo no se envió
                }
            } catch (emailError) {
                console.error("  -> Error CRÍTICO al intentar enviar correo de conexión/desconexión:", emailError.message);
                // No actualizar BD si el envío lanza excepción
                emailSentSuccessfully = false;
            }

            // --- 2.1 Actualizar Base de Datos SOLO SI el correo se envió con éxito ---
            if (emailSentSuccessfully) {
                console.log("[NotificationCtrl] processHourlyAlerts: Procediendo a actualizar BD para last_alert_sent...");
                let connection;
                try {
                    connection = await this.pool.getConnection();
                    const nowTimestamp = moment().utc().format('YYYY-MM-DD HH:mm:ss'); // Usar UTC o la hora del servidor para DB

                    // Actualizar last_alert_sent para nuevas desconexiones notificadas
                    if (disconnectionResults.channelsToUpdateLastSent.length > 0) {
                        const idsToUpdate = disconnectionResults.channelsToUpdateLastSent;
                        console.log(`  -> Actualizando last_alert_sent a ${nowTimestamp} para canales: ${idsToUpdate.join(', ')}`);
                        const [updateResult] = await connection.query(
                            // Usar NOW() de SQL o pasar el timestamp calculado
                            "UPDATE channels_ubibot SET last_alert_sent = ? WHERE channel_id IN (?)",
                            [nowTimestamp, idsToUpdate]
                        );
                        console.log(`    -> Filas afectadas por UPDATE last_alert_sent: ${updateResult.affectedRows}`);
                    } else {
                        console.log("  -> No hay canales que requieran actualizar last_alert_sent (nuevas desconexiones).");
                    }

                    // Resetear last_alert_sent para reconexiones notificadas
                    if (disconnectionResults.channelsToResetLastSent.length > 0) {
                        const idsToReset = disconnectionResults.channelsToResetLastSent;
                        console.log(`  -> Reseteando last_alert_sent a NULL para canales: ${idsToReset.join(', ')}`);
                        const [resetResult] = await connection.query(
                            "UPDATE channels_ubibot SET last_alert_sent = NULL WHERE channel_id IN (?)",
                            [idsToReset]
                        );
                        console.log(`    -> Filas afectadas por RESET last_alert_sent: ${resetResult.affectedRows}`);
                    } else {
                        console.log("  -> No hay canales que requieran resetear last_alert_sent (reconexiones).");
                    }

                } catch (dbError) {
                    console.error("❌ [NotificationCtrl] Error CRÍTICO actualizando last_alert_sent en BD:", dbError.message);
                    // Loguear IDs que fallaron si es posible
                    console.error("   - Canales para actualizar:", disconnectionResults.channelsToUpdateLastSent);
                    console.error("   - Canales para resetear:", disconnectionResults.channelsToResetLastSent);
                    // ¿Qué hacer si falla la actualización? El correo ya se envió. Podría causar alertas repetidas.
                    // Considerar reintentar la actualización DB o loguear para revisión manual.
                } finally {
                    if (connection) {
                        connection.release();
                        console.log("  -> Conexión DB liberada después de actualizaciones.");
                    }
                }
            } else {
                console.warn("[NotificationCtrl] processHourlyAlerts: Envío de correo de conexión/desconexión falló. NO se actualizará last_alert_sent en BD.");
            }
        } else if (disconnectionResults) { // El análisis funcionó pero no había nada que notificar
            console.log(`[NotificationCtrl] processHourlyAlerts: No se requieren notificaciones de conexión/desconexión para ${prevHourKey}.`);
        }
        // Si disconnectionResults es null, el error ya se logueó antes.


        // --- 3. Procesar Temperaturas (Solo fuera de horario laboral) ---
        const isWorkingTimeNow = this.isWithinWorkingHours(now);
        console.log(`[NotificationCtrl] processHourlyAlerts: Verificando horario laboral para alertas de temperatura. ¿Es horario laboral? ${isWorkingTimeNow}`);

        if (!isWorkingTimeNow) {
            console.log(`[NotificationCtrl] processHourlyAlerts: Procesando alertas de temperatura para ${prevHourKey} (fuera de horario laboral)...`);
            // Llamar al procesamiento de temperatura (que internamente envía email/SMS)
            await this.processHourlyTemperatureAlerts(prevHourKey)
                .catch(err => console.error(`❌ Error procesando temperaturas para ${prevHourKey}:`, err));
        } else {
            console.log(`[NotificationCtrl] processHourlyAlerts: Dentro de horario laboral. Omitiendo envío de alertas de temperatura para ${prevHourKey}.`);
            // Mover alertas pendientes a la siguiente hora
            this.moveTemperatureAlertsToNextHour(prevHourKey, currentHourKey);
        }

        // --- 4. Limpieza ---
        // Limpiar buffers procesados para la hora anterior
        this.cleanupProcessedHourlyAlerts(prevHourKey);

        console.log(`[NotificationCtrl] processHourlyAlerts: Procesamiento para la hora ${prevHourKey} finalizado.`);
    }



    /**
     * Mueve alertas de temperatura no procesadas de una hora a la siguiente.
     * @param {string} fromHourKey - Clave de la hora origen.
     * @param {string} toHourKey - Clave de la hora destino.
     * @private
     */
    moveTemperatureAlertsToNextHour(fromHourKey, toHourKey) {
        if (this.temperatureAlertsByHour[fromHourKey]) {
            console.log(`[NotificationCtrl] Moviendo alertas de temperatura pendientes de ${fromHourKey} a ${toHourKey}...`);
            if (!this.temperatureAlertsByHour[toHourKey]) {
                this.temperatureAlertsByHour[toHourKey] = {};
            }
            for (const channelId in this.temperatureAlertsByHour[fromHourKey]) {
                if (!this.temperatureAlertsByHour[toHourKey][channelId]) {
                    this.temperatureAlertsByHour[toHourKey][channelId] = [];
                }
                // Añadir las alertas movidas al inicio del array de la nueva hora
                this.temperatureAlertsByHour[toHourKey][channelId].unshift(
                    ...this.temperatureAlertsByHour[fromHourKey][channelId]
                );
                console.log(`  -> ${this.temperatureAlertsByHour[fromHourKey][channelId].length} alertas movidas para canal ${channelId}`);
            }
            // No eliminar fromHourKey aquí, se hará en cleanupProcessedHourlyAlerts
        }
    }

    /**
   * Procesa las alertas de conexión/desconexión para una hora específica.
   * Analiza los eventos, consulta la BD, determina qué notificar y
   * devuelve la información necesaria para enviar el correo y actualizar la BD.
   * @param {string} hourKey - Clave de hora "YYYY-MM-DD-HH" a procesar.
   * @returns {Promise<{formattedAlerts: Array, channelsToUpdateLastSent: Array, channelsToResetLastSent: Array}>}
   *          Objeto con alertas formateadas y listas de IDs para actualizar en BD.
   * @throws {Error} Si ocurre un error grave durante el procesamiento (ej. fallo de conexión DB).
   */
    async processHourlyDisconnectionAlerts(hourKey) {
        console.log(`[NotificationCtrl] processHourlyDisconnectionAlerts: Iniciando análisis para ${hourKey}.`);
        const eventsByChannel = this.disconnectionAlertsByHour[hourKey] || {};
        const channelIdsWithEvents = Object.keys(eventsByChannel);

        const results = {
            formattedAlerts: [],
            channelsToUpdateLastSent: [],
            channelsToResetLastSent: []
        };

        if (channelIdsWithEvents.length === 0) {
            console.log(`[NotificationCtrl] processHourlyDisconnectionAlerts: No hay eventos de conexión para procesar en ${hourKey}.`);
            return results; // Salir si no hay nada que procesar
        }

        console.log(`[NotificationCtrl] processHourlyDisconnectionAlerts: Analizando ${channelIdsWithEvents.length} canales con eventos en ${hourKey}.`);

        let connection;
        try {
            connection = await this.pool.getConnection(); // Obtener una conexión para las consultas

            for (const channelId of channelIdsWithEvents) {
                const events = eventsByChannel[channelId] || [];
                if (events.length === 0) continue; // Saltar si no hay eventos (no debería pasar)

                // 1. Ordenar eventos y determinar estado final y timestamps clave
                events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                const lastEvent = events[events.length - 1];
                const finalStatus = lastEvent.event; // 'connected' o 'disconnected'
                const channelName = lastEvent.channelName; // Asumir que todos los eventos tienen el nombre

                const firstDisconnectEvent = events.find(e => e.event === 'disconnected');
                const lastConnectEvent = events.slice().reverse().find(e => e.event === 'connected'); // Buscar desde el final

                const firstDisconnectTs = firstDisconnectEvent ? moment(firstDisconnectEvent.timestamp).tz(this.timeZone) : null;
                const lastReconnectTs = lastConnectEvent ? moment(lastConnectEvent.timestamp).tz(this.timeZone) : null;

                console.log(` -> Canal ${channelId} (${channelName}): FinalStatus='${finalStatus}', FirstDisconnect=${firstDisconnectTs?.format() || 'N/A'}, LastReconnect=${lastReconnectTs?.format() || 'N/A'}`);

                // 2. Consultar estado actual en la BD
                const [channelDbStateRows] = await connection.query(
                    "SELECT is_currently_out_of_range, out_of_range_since, last_alert_sent FROM channels_ubibot WHERE channel_id = ?",
                    [channelId]
                );

                if (channelDbStateRows.length === 0) {
                    console.warn(`[NotificationCtrl] processHourlyDisconnectionAlerts: Canal ${channelId} con eventos en buffer no encontrado en BD. Omitiendo.`);
                    continue; // Saltar si el canal ya no existe
                }
                const dbState = channelDbStateRows[0];
                const dbOutOfRangeSince = dbState.out_of_range_since ? moment(dbState.out_of_range_since).tz(this.timeZone) : null;
                const dbLastAlertSent = dbState.last_alert_sent ? moment(dbState.last_alert_sent).tz(this.timeZone) : null;

                // 3. Lógica de Notificación y Preparación de Datos
                let needsDisconnectNotification = false;
                let needsReconnectNotification = false;

                if (finalStatus === 'disconnected') {
                    // El canal terminó la hora DESCONECTADO
                    console.log(`  -> Verificando si necesita alerta de DESCONEXIÓN (DB: outSince=${dbOutOfRangeSince?.format()}, lastSent=${dbLastAlertSent?.format()})`);
                    // Solo notificar si:
                    // - Hay una fecha de inicio de desconexión en la BD Y
                    // - No hay alerta enviada O la última alerta enviada es ANTERIOR al inicio de esta desconexión
                    if (dbOutOfRangeSince && (!dbLastAlertSent || dbLastAlertSent.isBefore(dbOutOfRangeSince))) {
                        console.log(`  -> SÍ necesita notificación de desconexión.`);
                        needsDisconnectNotification = true;
                    } else {
                        console.log(`  -> NO necesita notificación de desconexión (ya notificada o estado inconsistente).`);
                    }

                    // Si necesita notificación, prepararla
                    if (needsDisconnectNotification) {
                        results.formattedAlerts.push({
                            name: channelName,
                            channelId: channelId,
                            finalStatus: 'DESCONECTADO', // Estado final
                            // Usar la hora de la BD como la hora oficial de inicio de desconexión
                            horaDesconexion: dbOutOfRangeSince ? dbOutOfRangeSince.format("DD/MM HH:mm:ss") : 'N/A',
                            horaReconexion: 'N/A en periodo', // Estaba desconectado al final
                            // Incluir eventos para posible depuración o formato avanzado
                            // events: events // Descomentar si es necesario
                        });
                        // Marcar para actualizar last_alert_sent en la BD DESPUÉS de enviar
                        results.channelsToUpdateLastSent.push(channelId);
                    }

                } else { // finalStatus === 'connected'
                    // El canal terminó la hora CONECTADO
                    console.log(`  -> Necesita notificación de RECONEXIÓN.`);
                    needsReconnectNotification = true;

                    // Formatear horas para el correo
                    // Hora de Desconexión: Usar la primera desconexión de ESTA HORA si existe,
                    // si no, usar el out_of_range_since de la BD (si existía antes)
                    const horaDesconexionParaCorreo = firstDisconnectTs
                        ? firstDisconnectTs.format("DD/MM HH:mm:ss")
                        : (dbOutOfRangeSince ? dbOutOfRangeSince.format("DD/MM HH:mm:ss") : 'N/A');
                    // Hora de Reconexión: Usar la última reconexión de esta hora
                    const horaReconexionParaCorreo = lastReconnectTs
                        ? lastReconnectTs.format("DD/MM HH:mm:ss")
                        : 'N/A'; // Debería existir si finalStatus es 'connected'

                    results.formattedAlerts.push({
                        name: channelName,
                        channelId: channelId,
                        finalStatus: 'CONECTADO',
                        horaDesconexion: horaDesconexionParaCorreo,
                        horaReconexion: horaReconexionParaCorreo,
                        // events: events // Descomentar si es necesario
                    });
                    // Marcar para resetear last_alert_sent en la BD DESPUÉS de enviar
                    results.channelsToResetLastSent.push(channelId);
                }
            } // Fin del bucle for channelId

            console.log(`[NotificationCtrl] processHourlyDisconnectionAlerts: Análisis para ${hourKey} completado.`);
            console.log(`  -> Alertas a enviar: ${results.formattedAlerts.length}`);
            console.log(`  -> Canales para actualizar last_alert_sent: ${results.channelsToUpdateLastSent.length}`);
            console.log(`  -> Canales para resetear last_alert_sent: ${results.channelsToResetLastSent.length}`);

            return results; // Devolver el objeto con las listas preparadas

        } catch (error) {
            console.error(`❌ [NotificationCtrl] Error CRÍTICO en processHourlyDisconnectionAlerts para ${hourKey}:`, error.message);
            // console.error(error.stack); // Log stack trace
            // Relanzar el error para que processHourlyAlerts sepa que falló
            throw error;
        } finally {
            if (connection) {
                connection.release();
                console.log(`[NotificationCtrl] processHourlyDisconnectionAlerts: Conexión DB liberada para ${hourKey}.`);
            }
        }
    }

    /**
     * Procesa las alertas de temperatura para una hora específica (si está fuera de horario laboral).
     * *** Este método parece mayormente correcto según plan anterior, revisar si necesita ajustes ***
     * @param {string} hourKey - Clave de hora "YYYY-MM-DD-HH".
     */
    async processHourlyTemperatureAlerts(hourKey) {
        console.log(`[NotificationCtrl] processHourlyTemperatureAlerts: Iniciando para ${hourKey}.`);
        const alertsData = this.temperatureAlertsByHour[hourKey] || {};
        const channelsWithAlerts = Object.keys(alertsData);

        if (channelsWithAlerts.length === 0) {
            console.log(`[NotificationCtrl] processHourlyTemperatureAlerts: No hay alertas de temperatura para la hora ${hourKey}.`);
            return;
        }
        console.log(`[NotificationCtrl] processHourlyTemperatureAlerts: ${channelsWithAlerts.length} canales con alertas de temperatura en ${hourKey}.`);

        // Preparar los datos agregados por canal para el email/SMS
        const formattedAlerts = [];
        for (const channelId of channelsWithAlerts) {
            const alertsForChannel = alertsData[channelId] || [];
            if (alertsForChannel.length === 0) continue;

            // Usar la última alerta para el resumen (podría mejorarse para mostrar rango o promedio)
            const lastAlert = alertsForChannel[alertsForChannel.length - 1];
            formattedAlerts.push({
                name: lastAlert.channelName,
                channelId: lastAlert.channelId,
                temperature: lastAlert.temperature,
                timestamp: lastAlert.timestamp || lastAlert.detectedAt, // Usar timestamp de lectura si está
                minThreshold: lastAlert.minThreshold,
                maxThreshold: lastAlert.maxThreshold,
                // Podríamos añadir 'allReadings: alertsForChannel' si el email necesita detalles
            });
        }

        if (formattedAlerts.length > 0) {
            console.log(`[NotificationCtrl] processHourlyTemperatureAlerts: Enviando ${formattedAlerts.length} alertas de temperatura...`);
            // Enviar por Email (respetando el chequeo horario ya hecho antes de llamar a esta función)
            try {
                const emailResult = await emailService.sendTemperatureRangeAlertsEmail(formattedAlerts, new Date(), null, true); // force=true porque ya validamos horario
                console.log(`  -> Email temp enviado: ${emailResult ? 'Éxito' : 'Fallo'}`);
            } catch (error) {
                console.error("  -> Error enviando email de temperatura:", error);
            }

            // Enviar por SMS (respetando chequeo horario)
            try {
                const smsResult = await smsService.sendTemperatureAlert(formattedAlerts, null, true); // force=true
                console.log(`  -> SMS temp enviado: ${smsResult.success ? 'Éxito' : 'Fallo'}`);
            } catch (error) {
                console.error("  -> Error enviando SMS de temperatura:", error);
            }
        }
    }

    /**
     * Limpia los buffers horarios para una hora específica después de procesarla.
     * @param {string} hourKey - Clave de la hora a limpiar.
     * @private
     */
    cleanupProcessedHourlyAlerts(hourKey) {
        let cleanedTemp = false;
        let cleanedDisc = false;
        if (this.temperatureAlertsByHour[hourKey]) {
            delete this.temperatureAlertsByHour[hourKey];
            cleanedTemp = true;
        }
        if (this.disconnectionAlertsByHour[hourKey]) {
            delete this.disconnectionAlertsByHour[hourKey];
            cleanedDisc = true;
        }
        if (cleanedTemp || cleanedDisc) {
            console.log(`[NotificationCtrl] Buffers horarios limpiados para la hora: ${hourKey}`);
        }
    }

    /**
    * Limpia buffers horarios y contadores muy antiguos.
    * @private
    */
    cleanupOldHourlyAlerts() {
        const now = moment().tz(this.timeZone);
        const cutoffHours = 48; // Mantener buffers de las últimas 48 horas (ajustable)
        const cutoffTime = now.clone().subtract(cutoffHours, 'hours');
        let cleanedKeys = 0;

        console.log(`[NotificationCtrl] cleanupOldHourlyAlerts: Limpiando buffers anteriores a ${cutoffTime.format()}`);

        // Limpiar alertas de temperatura
        for (const hourKey in this.temperatureAlertsByHour) {
            // Asumiendo formato YYYY-MM-DD-HH
            const hourMoment = moment(hourKey, "YYYY-MM-DD-HH").tz(this.timeZone, true); // true = mantener hora local
            if (!hourMoment.isValid() || hourMoment.isBefore(cutoffTime)) {
                delete this.temperatureAlertsByHour[hourKey];
                cleanedKeys++;
            }
        }
        // Limpiar alertas de desconexión
        for (const hourKey in this.disconnectionAlertsByHour) {
            const hourMoment = moment(hourKey, "YYYY-MM-DD-HH").tz(this.timeZone, true);
            if (!hourMoment.isValid() || hourMoment.isBefore(cutoffTime)) {
                delete this.disconnectionAlertsByHour[hourKey];
                cleanedKeys++;
            }
        }
        if (cleanedKeys > 0) {
            console.log(`[NotificationCtrl] cleanupOldHourlyAlerts: ${cleanedKeys} claves horarias antiguas eliminadas de los buffers.`);
        }
    }

    // --- Métodos de Procesamiento de Eventos Individuales ---

    /**
     * Procesa un evento de cambio de estado de conexión recibido desde ubibotService.
     * Almacena el evento en un buffer horario si el canal es operativo.
     * *** ESTE MÉTODO YA ESTÁ ACTUALIZADO SEGÚN PASO 2 ***
     * @param {string} channelId - ID del canal.
     * @param {string} channelName - Nombre del canal.
     * @param {boolean} isOnline - Estado actual reportado por la API (true=online, false=offline).
     * @param {boolean} wasOffline - Estado anterior registrado en la BD (true=offline, false=online).
     * @param {Date|string|null} outOfRangeSince - Timestamp de cuándo empezó el periodo offline actual (desde BD).
     * @param {Date|string|null} lastAlertSent - Timestamp de la última alerta de desconexión enviada (desde BD).
     * @param {boolean} isOperational - Si el canal está marcado como operativo en la BD.
     * @returns {Promise<void>}
     */
    async processConnectionStatusChange(
        channelId,
        channelName,
        isOnline,
        wasOffline, // Estado previo en BD
        outOfRangeSince, // Inicio del offline actual en BD
        lastAlertSent, // Última alerta enviada en BD
        isOperational // Operatividad desde BD
    ) {
        // Log detallado de entrada para depuración
        console.log(`[NotificationCtrl] processConnectionStatusChange: Recibido evento para canal ${channelId} (${channelName})`);
        console.log(`  -> Datos recibidos: isOnline=${isOnline}, wasOffline=${wasOffline}, isOperational=${isOperational}`);
        console.log(`  -> Timestamps BD: outOfRangeSince=${outOfRangeSince}, lastAlertSent=${lastAlertSent}`);

        try {
            // 1. IGNORAR SI NO ES OPERATIVO
            if (!isOperational) {
                console.log(`[NotificationCtrl] processConnectionStatusChange: Canal ${channelId} NO operativo. Evento ignorado.`);
                return;
            }

            // 2. DETERMINAR EL TIPO DE EVENTO ACTUAL
            const currentEvent = isOnline ? "connected" : "disconnected";
            const eventTimestamp = new Date(); // Hora actual como hora del evento detectado

            // 3. OBTENER CLAVE HORARIA Y BUFFER
            const hourKey = this.getHourKey(eventTimestamp);

            // Asegurar que el buffer para la hora existe
            if (!this.disconnectionAlertsByHour[hourKey]) {
                this.disconnectionAlertsByHour[hourKey] = {};
            }
            // Asegurar que el array para el canal existe dentro de la hora
            if (!this.disconnectionAlertsByHour[hourKey][channelId]) {
                this.disconnectionAlertsByHour[hourKey][channelId] = [];
                console.log(`[NotificationCtrl] processConnectionStatusChange: Creando buffer horario [${hourKey}][${channelId}]`);
            }

            // 4. CREAR OBJETO DE EVENTO
            const eventData = {
                event: currentEvent, // 'connected' o 'disconnected'
                timestamp: eventTimestamp.toISOString(), // Guardar timestamp del evento detectado
                channelId: channelId,
                channelName: channelName,
            };

            // 5. AÑADIR EVENTO AL ARRAY DEL BUFFER
            this.disconnectionAlertsByHour[hourKey][channelId].push(eventData);

            console.log(`[NotificationCtrl] processConnectionStatusChange: Evento '${currentEvent}' para canal ${channelId} (${channelName}) añadido al buffer [${hourKey}]. Total eventos para este canal/hora: ${this.disconnectionAlertsByHour[hourKey][channelId].length}`);

        } catch (error) {
            console.error(`❌ [NotificationCtrl] Error en processConnectionStatusChange para ${channelId}:`, error.message);
        }
    }

    /**
     * Procesa una nueva lectura de temperatura recibida desde ubibotService.
     * Incrementa contadores y agrega alertas al buffer horario si es necesario.
     * @param {string} channelId - ID del canal.
     * @param {string} channelName - Nombre del canal.
     * @param {number} temperature - Temperatura detectada.
     * @param {string} timestamp - Timestamp de la lectura (formato 'YYYY-MM-DD HH:mm:ss').
     * @param {number} minThreshold - Umbral mínimo de temperatura.
     * @param {number} maxThreshold - Umbral máximo de temperatura.
     * @param {boolean} isOperational - Si el canal está operativo.
     * @returns {Promise<void>}
     */
    async processTemperatureReading(
        channelId,
        channelName,
        temperature,
        timestamp, // Recibe timestamp ya formateado
        minThreshold,
        maxThreshold,
        isOperational
    ) {
        // Log detallado de entrada
        // console.log(`[NotificationCtrl] processTemperatureReading: Canal ${channelId}, Temp=${temperature}, Op=${isOperational}`);

        try {
            // 1. IGNORAR SI NO ES OPERATIVO
            if (!isOperational) {
                // console.log(`[NotificationCtrl] processTemperatureReading: Canal ${channelId} NO operativo. Lectura ignorada.`);
                return;
            }

            // 2. VALIDAR DATOS (Básico)
            if (isNaN(temperature) || minThreshold === null || maxThreshold === null || isNaN(minThreshold) || isNaN(maxThreshold)) {
                console.warn(`[NotificationCtrl] processTemperatureReading: Datos inválidos para ${channelId}. Temp=${temperature}, Min=${minThreshold}, Max=${maxThreshold}`);
                return;
            }

            // 3. VERIFICAR RANGO
            const isOutOfRange = temperature < minThreshold || temperature > maxThreshold;

            // Obtener contador para este canal
            if (!this.tempAlertCounters[channelId]) {
                this.tempAlertCounters[channelId] = { count: 0, lastUpdate: new Date(), values: [] };
            }
            const counter = this.tempAlertCounters[channelId];

            if (isOutOfRange) {
                // Temperatura FUERA de rango
                counter.count++;
                counter.lastUpdate = new Date();
                // Guardar las últimas N lecturas fuera de rango podría ser útil
                counter.values.push({ temperature, timestamp });
                // Limitar el historial guardado (opcional)
                if (counter.values.length > 10) counter.values.shift();

                console.log(`Canal ${channelName} (${channelId}): Temperatura fuera de rango (${temperature}°C). Contador: ${counter.count}/3`);

                // 4. ¿ALCANZÓ UMBRAL PARA ALERTA? (ej. 3 consecutivas o la política que definas)
                // Por ahora, mantenemos la lógica de 3 para generar la alerta en buffer
                if (counter.count >= 3) {
                    console.log(`[NotificationCtrl] processTemperatureReading: Canal ${channelId} alcanzó umbral de 3 lecturas fuera de rango. Añadiendo a buffer horario.`);

                    const now = new Date();
                    const hourKey = this.getHourKey(now);

                    // Asegurar buffers
                    if (!this.temperatureAlertsByHour[hourKey]) this.temperatureAlertsByHour[hourKey] = {};
                    if (!this.temperatureAlertsByHour[hourKey][channelId]) this.temperatureAlertsByHour[hourKey][channelId] = [];

                    // Registrar la alerta para procesamiento horario
                    this.temperatureAlertsByHour[hourKey][channelId].push({
                        channelId,
                        channelName,
                        temperature,
                        timestamp, // Timestamp de la LECTURA que disparó la alerta
                        minThreshold,
                        maxThreshold,
                        detectedAt: now.toISOString() // Timestamp de CUÁNDO se detectó el umbral
                    });
                    console.log(` -> Alerta temp añadida a buffer [${hourKey}][${channelId}]`);

                    // Resetear contador después de registrar la alerta para evitar alertas múltiples por la misma secuencia
                    counter.count = 0;
                    counter.values = [];
                    console.log(` -> Contador reseteado para canal ${channelId}.`);
                }
            } else {
                // Temperatura DENTRO de rango
                if (counter.count > 0) {
                    // Si había un contador activo, significa que volvió a la normalidad
                    console.log(`Canal ${channelName} (${channelId}): Temperatura normalizada (${temperature}°C). Reseteando contador.`);
                    counter.count = 0; // Resetear contador
                    counter.values = [];
                }
                // Si count ya era 0, no hacer nada.
            }
        } catch (error) {
            console.error(`❌ [NotificationCtrl] Error en processTemperatureReading para ${channelId}:`, error.message);
            // console.error(error.stack); // Opcional
        }
    }


    /**
     * Limpia contadores de temperatura antiguos que no se han actualizado recientemente.
     * @private
     */
    cleanupOldCounters() {
        const now = new Date();
        // Usar el mismo intervalo de limpieza general
        const cutoffTimeMs = (this.cleanupInterval || 720) * 60 * 1000;
        const cutoffTime = new Date(now.getTime() - cutoffTimeMs);
        let cleanupCount = 0;

        // console.log(`[NotificationCtrl] cleanupOldCounters: Limpiando contadores no actualizados desde ${cutoffTime.toISOString()}`);

        for (const channelId in this.tempAlertCounters) {
            const counter = this.tempAlertCounters[channelId];
            // Si el contador no se ha actualizado recientemente (ni incrementado ni reseteado), eliminarlo
            if (counter.lastUpdate < cutoffTime) {
                delete this.tempAlertCounters[channelId];
                cleanupCount++;
            }
        }

        if (cleanupCount > 0) {
            console.log(`[NotificationCtrl] cleanupOldCounters: Limpiados ${cleanupCount} contadores de temperatura antiguos/inactivos.`);
        }
    }

    // --- Métodos de Formateo (Sin cambios necesarios ahora) ---
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

    // --- Métodos de Logging a BD (Sin cambios necesarios ahora) ---
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
    async logError(errorMessage) {
        const fullMessage = `ERROR: ${errorMessage}`;
        await this.logToDatabase(fullMessage);
    }
}

module.exports = new NotificationController();
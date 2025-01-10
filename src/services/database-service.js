const mysql = require('mysql2/promise');
const { DateTime } = require('luxon'); // Agregamos importación de Luxon
const config = require('../config/js_files/config-loader');
const { ValidationError, DatabaseError, NotFoundError } = require('../utils/errors');
const transformUtils = require('../utils/transformUtils');


class DatabaseService {
    constructor() {
        this.pool = null;
        this.initialized = false;
        this.connected = false;
        this.config = config.getConfig();
        this.timezone = this.config.measurement.zona_horaria || 'America/Santiago';
    }

    async initialize() {
        if (this.initialized) return;

        const { database: dbConfig } = this.config;
        this.pool = mysql.createPool({
            host: dbConfig.host,
            port: dbConfig.port,
            user: dbConfig.username,
            password: dbConfig.password,
            database: dbConfig.database,
            connectionLimit: dbConfig.pool.max_size,
            connectTimeout: dbConfig.pool.timeout * 1000,
            waitForConnections: true,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0
        });

        await this.validateDatabaseSchema();
        this.initialized = true;
    }

    async validateDatabaseSchema() {
        const requiredTables = [
            'sem_dispositivos',
            'sem_grupos',
            'sem_mediciones',
            'sem_estado_dispositivo',
            'sem_control_calidad',
            'sem_promedios_hora',
            'sem_promedios_dia',
            'sem_promedios_mes',
            'sem_totales_hora',
            'sem_totales_dia',
            'sem_totales_mes'
        ];

        const [tables] = await this.pool.query(`
            SELECT TABLE_NAME 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
        `);

        const existingTables = tables.map(t => t.TABLE_NAME);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));

        if (missingTables.length > 0) {
            throw new Error(`Missing required tables: ${missingTables.join(', ')}`);
        }
    }

    async insertDeviceStatus(data) {
        if (!this.validateDeviceData(data)) {
            throw new ValidationError('Invalid device data structure');
        }

        const conn = await this.pool.getConnection();
        try {
            await conn.beginTransaction();

            const timestamp = this.getTimestamp(data);
            const device = await this.ensureDeviceExists(conn, data);

            const emData = data.device_status['em:0'] || {};
            const emdData = data.device_status['emdata:0'] || {};

            // Insertar mediciones por fase
            const phases = ['a', 'b', 'c'];
            for (const phase of phases) {
                const phaseKey = phase.toLowerCase();
                const measurementData = {
                    shelly_id: device.shelly_id,
                    timestamp_local: timestamp,
                    fase: phase,
                    voltaje: parseFloat(emData[`${phaseKey}_voltage`] || 0),
                    corriente: parseFloat(emData[`${phaseKey}_current`] || 0),
                    potencia_activa: parseFloat(emData[`${phaseKey}_act_power`] || 0),
                    potencia_aparente: parseFloat(emData[`${phaseKey}_aprt_power`] || 0),
                    factor_potencia: parseFloat(emData[`${phaseKey}_pf`] || 0),
                    frecuencia: parseFloat(emData.c_freq || 50),
                    // Actualización: usar datos de energía del objeto emdata:0
                    energia_activa: parseFloat(emdData[`${phaseKey}_total_act_energy`] || 0),
                    energia_reactiva: parseFloat(emdData[`${phaseKey}_total_act_ret_energy`] || 0),
                    calidad_lectura: this.evaluateReadingQuality(data),
                    intervalo_segundos: 10
                };

                measurementData.validacion_detalle = this.generateValidationDetails({
                    voltaje: measurementData.voltaje,
                    corriente: measurementData.corriente,
                    factor_potencia: measurementData.factor_potencia
                });

                await conn.query('INSERT INTO sem_mediciones SET ?', measurementData);
            }

            // Insertar medición total con datos actualizados
            const totalMeasurement = {
                shelly_id: device.shelly_id,
                timestamp_local: timestamp,
                fase: 'TOTAL',
                voltaje: ((parseFloat(emData.a_voltage || 0) +
                    parseFloat(emData.b_voltage || 0) +
                    parseFloat(emData.c_voltage || 0)) / 3).toFixed(2),
                corriente: parseFloat(emData.total_current || 0),
                potencia_activa: parseFloat(emData.total_act_power || 0),
                potencia_aparente: parseFloat(emData.total_aprt_power || 0),
                factor_potencia: this.calculateTotalPowerFactor(emData),
                frecuencia: parseFloat(emData.c_freq || 50),
                // Actualización: usar datos totales de energía del objeto emdata:0
                energia_activa: parseFloat(emdData.total_act || 0),
                energia_reactiva: parseFloat(emdData.total_act_ret || 0),
                calidad_lectura: this.evaluateReadingQuality(data),
                intervalo_segundos: 10
            };

            totalMeasurement.validacion_detalle = this.generateValidationDetails({
                voltaje: totalMeasurement.voltaje,
                corriente: totalMeasurement.corriente,
                factor_potencia: totalMeasurement.factor_potencia
            });

            await conn.query('INSERT INTO sem_mediciones SET ?', totalMeasurement);

            // Actualizar control de calidad
            await this.updateQualityControl(conn, device.shelly_id, timestamp, {
                calidadLectura: this.evaluateReadingQuality(data),
                voltajePromedio: totalMeasurement.voltaje,
                corrienteTotal: totalMeasurement.corriente
            });

            await conn.commit();

            return {
                success: true,
                deviceId: device.shelly_id,
                timestamp: timestamp,
                measurements: {
                    total: totalMeasurement,
                    quality: await this.getQualityStatus(device.shelly_id, timestamp)
                }
            };

        } catch (error) {
            await conn.rollback();
            console.error('Error in insertDeviceStatus:', {
                error: error.message,
                stack: error.stack,
                deviceId: data?.device_status?.id
            });
            throw new DatabaseError('Error inserting device status', error);
        } finally {
            conn.release();
        }
    }

    async updateDeviceState(conn, shellyId, data) {
        const deviceStatus = data.device_status;
        const stateData = {
            shelly_id: shellyId,
            timestamp_local: new Date(),
            estado_conexion: deviceStatus.cloud?.connected ? 'CONECTADO' : 'DESCONECTADO',
            rssi_wifi: deviceStatus.wifi?.rssi || null,
            direccion_ip: deviceStatus.wifi?.sta_ip || null,
            temperatura_celsius: deviceStatus['temperature:0']?.tC || null,
            uptime_segundos: deviceStatus.sys?.uptime || null
        };

        await conn.query('INSERT INTO sem_estado_dispositivo SET ?', stateData);
    }

    async updateQualityControl(conn, shellyId, timestamp, measurementData) {
        const hourStart = new Date(timestamp);
        hourStart.setMinutes(0, 0, 0);

        const hourEnd = new Date(hourStart);
        hourEnd.setHours(hourStart.getHours() + 1);

        const [existingControl] = await conn.query(
            `SELECT * FROM sem_control_calidad 
         WHERE shelly_id = ? 
         AND inicio_periodo = ?`,
            [shellyId, hourStart]
        );

        if (existingControl.length === 0) {
            // Crear nuevo registro de control de calidad
            const controlData = {
                shelly_id: shellyId,
                inicio_periodo: hourStart,
                fin_periodo: hourEnd,
                lecturas_esperadas: 360, // 10 segundos = 360 lecturas por hora
                lecturas_recibidas: 1,
                lecturas_validas: measurementData.calidadLectura === 'NORMAL' ? 1 : 0,
                lecturas_alertas: measurementData.calidadLectura === 'ALERTA' ? 1 : 0,
                lecturas_error: measurementData.calidadLectura === 'ERROR' ? 1 : 0,
                lecturas_interpoladas: 0,
                porcentaje_calidad: 100,
                estado_validacion: 'PENDIENTE',
                detalles_validacion: JSON.stringify({
                    ultima_lectura: {
                        timestamp: timestamp,
                        voltaje_promedio: measurementData.voltajePromedio,
                        corriente_total: measurementData.corrienteTotal
                    }
                })
            };

            await conn.query('INSERT INTO sem_control_calidad SET ?', controlData);
        } else {
            // Actualizar registro existente
            const control = existingControl[0];
            const updateData = {
                lecturas_recibidas: control.lecturas_recibidas + 1,
                lecturas_validas: control.lecturas_validas + (measurementData.calidadLectura === 'NORMAL' ? 1 : 0),
                lecturas_alertas: control.lecturas_alertas + (measurementData.calidadLectura === 'ALERTA' ? 1 : 0),
                lecturas_error: control.lecturas_error + (measurementData.calidadLectura === 'ERROR' ? 1 : 0)
            };

            updateData.porcentaje_calidad =
                (updateData.lecturas_validas / control.lecturas_esperadas) * 100;

            await conn.query(
                `UPDATE sem_control_calidad
                 SET ?
                 WHERE shelly_id = ? AND inicio_periodo = ?`,
                [updateData, shellyId, hourStart]
            );
        }
    }


    evaluateReadingQuality(data) {
        if (!data.device_status || !data.device_status.reading_quality) {
            return 'NORMAL';
        }

        const qualityMap = {
            'GOOD': 'NORMAL',
            'WARN': 'ALERTA',
            'BAD': 'ERROR'
        };

        return qualityMap[data.device_status.reading_quality] || 'NORMAL';
    }

    generateValidationDetails(data) {
        const validationDetails = {
            voltaje: {
                valor: data.voltaje,
                calidad: this.validateVoltage(data.voltaje)
            },
            corriente: {
                valor: data.corriente,
                calidad: this.validateCurrent(data.corriente)
            }
        };

        if (data.factor_potencia !== undefined) {
            validationDetails.factor_potencia = {
                valor: data.factor_potencia,
                calidad: this.validatePowerFactor(data.factor_potencia)
            };
        }

        return JSON.stringify(validationDetails);
    }

    validateVoltage(voltage) {
        const minVoltage = 198; // 220V -10%
        const maxVoltage = 242; // 220V +10%

        if (voltage === null || voltage === undefined || voltage === 0) {
            return 'ERROR';
        }

        if (voltage >= minVoltage && voltage <= maxVoltage) {
            return 'NORMAL';
        }

        if (voltage > 0 && (voltage < minVoltage || voltage > maxVoltage)) {
            return 'ALERTA';
        }

        return 'ERROR';
    }

    validateCurrent(current) {
        if (current === null || current === undefined) {
            return 'ERROR';
        }

        if (current >= 0 && current <= 100) {
            return 'NORMAL';
        }

        if (current > 100) {
            return 'ALERTA';
        }

        return 'ERROR';
    }

    validatePowerFactor(pf) {
        if (pf === null || pf === undefined) {
            return 'ERROR';
        }

        if (Math.abs(pf) >= 0.93) {
            return 'NORMAL';
        }

        if (Math.abs(pf) >= 0.85) {
            return 'ALERTA';
        }

        return 'ERROR';
    }

    calculateTotalPowerFactor(emData) {
        if (!emData.total_act_power || !emData.total_aprt_power) return 0;
        return emData.total_act_power / emData.total_aprt_power;
    }

    validateDeviceData(data) {
        if (!data || !data.device_status) {
            return false;
        }

        const requiredFields = ['id', 'em:0', 'sys'];
        return requiredFields.every(field => data.device_status[field] !== undefined);
    }

    async ensureDeviceExists(conn, data) {
        const deviceId = data.device_status.id;
        const [rows] = await conn.query(
            'SELECT * FROM sem_dispositivos WHERE shelly_id = ?',
            [deviceId]
        );

        if (!rows || rows.length === 0) {
            throw new NotFoundError(`Device ${deviceId} not found in database`);
        }

        return rows[0];
    }

    /**
     * Convierte el timestamp unix a hora local
     * @param {Object} data - Datos del dispositivo
     * @returns {Date} Fecha en hora local
     */
    getTimestamp(data) {
        let timestamp;

        if (data.device_status.sys?.unixtime) {
            // Convertir unixtime (segundos) a milisegundos y crear objeto DateTime
            const utcDateTime = DateTime.fromMillis(data.device_status.sys.unixtime * 1000)
                .setZone('UTC');

            // Convertir a la zona horaria local configurada
            const localDateTime = utcDateTime.setZone(this.timezone);

            // Verificar si la conversión fue exitosa
            if (!localDateTime.isValid) {
                console.error('Error converting timestamp:', localDateTime.invalidReason);
                // Si hay error, usar la hora actual local
                timestamp = DateTime.local().setZone(this.timezone).toJSDate();
            } else {
                timestamp = localDateTime.toJSDate();
            }
        } else {
            // Si no hay unixtime, usar la hora actual en la zona horaria configurada
            timestamp = DateTime.local().setZone(this.timezone).toJSDate();
        }

        console.log('Timestamp conversion:', {
            original_unixtime: data.device_status.sys?.unixtime,
            converted_local: timestamp,
            timezone: this.timezone
        });

        return timestamp;
    }

    async getLatestStatus() {
        const [rows] = await this.pool.query(`
            SELECT m.*, d.nombre as device_name, g.nombre as group_name,
                   ed.temperatura_celsius, ed.rssi_wifi
            FROM sem_mediciones m
            JOIN sem_dispositivos d ON m.shelly_id = d.shelly_id
            JOIN sem_grupos g ON d.grupo_id = g.id
            JOIN sem_estado_dispositivo ed ON m.shelly_id = ed.shelly_id
            WHERE m.fase = 'TOTAL'
            AND m.timestamp_local = (
                SELECT MAX(timestamp_local) 
                FROM sem_mediciones 
                WHERE shelly_id = m.shelly_id
            )
        `);

        return transformUtils.transformApiResponse(rows);
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.initialized = false;
            this.connected = false;
        }
    }

    async testConnection() {
        try {
            if (!this.pool) await this.initialize();
            await this.pool.query('SELECT 1');
            this.connected = true;
            return true;
        } catch (error) {
            this.connected = false;
            throw new DatabaseError('Database connection test failed', error);
        }
    }

    async getQualityStatus(deviceId, timestamp) {
        const [qualityRows] = await this.pool.query(
            `SELECT * FROM sem_control_calidad 
         WHERE shelly_id = ? 
         AND inicio_periodo <= ? 
         AND fin_periodo >= ?`,
            [deviceId, timestamp, timestamp]
        );
        return qualityRows[0] || null;
    }

}

module.exports = new DatabaseService();
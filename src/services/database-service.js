const mysql = require('mysql2/promise');
const config = require('../config/config-loader');
const { ValidationError, DatabaseError, NotFoundError } = require('../utils/errors');
const transformUtils = require('../utils/transformUtils');

class DatabaseService {
    constructor() {
        this.pool = null;
        this.initialized = false;
        this.connected = false;
        this.config = config.getConfig();
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

    // Métodos de Dispositivo
    async getDeviceById(deviceId) {
        if (!deviceId) throw new ValidationError('Device ID is required');
        
        const [rows] = await this.pool.query(
            'SELECT * FROM sem_dispositivos WHERE shelly_id = ?',
            [deviceId]
        );
        
        if (!rows[0]) throw new NotFoundError('Device not found');
        return rows[0];
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
            
            // Obtener los datos de energía del dispositivo
            const emData = data.device_status['em:0'] || {};
            
            // Preparar datos para la inserción por fase
            const phases = ['a', 'b', 'c'];
            for (const phase of phases) {
                let calidadLectura = this.mapReadingQuality(data.device_status.reading_quality);

                const localTimestamp = timestamp;
                const utcTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
                // Primero creamos el objeto measurementData sin el validacion_detalle
                const measurementData = {
                    shelly_id: device.shelly_id,
                    timestamp_utc: utcTimestamp,
                    timestamp_local: localTimestamp,
                    fase: phase.toUpperCase(),
                    voltaje: emData[`${phase}_voltage`] || 0,
                    corriente: emData[`${phase}_current`] || 0,
                    potencia_activa: emData[`${phase}_act_power`] || 0,
                    potencia_aparente: emData[`${phase}_aprt_power`] || 0,
                    factor_potencia: emData[`${phase}_pf`] || 0,
                    frecuencia: emData.c_freq || 50,
                    energia_activa: emData[`${phase}_act_energy`] || 0,
                    energia_reactiva: emData[`${phase}_react_energy`] || 0,
                    calidad_lectura: calidadLectura
                };
    
                // Ahora agregamos el validacion_detalle
                measurementData.validacion_detalle = this.generateValidationDetails(measurementData);
    
                const query = `INSERT INTO sem_mediciones SET ?`;
                await conn.query(query, measurementData);
            }
    
            await conn.commit();
            return {
                success: true,
                deviceId: device.shelly_id,
                timestamp,
                qualityStatus: await this.getQualityStatus(device.shelly_id, timestamp)
            };
        } catch (error) {
            await conn.rollback();
            console.error('Error in insertDeviceStatus:', {
                error: error.message,
                stack: error.stack,
                deviceId: data?.device_status?.code
            });
            throw new DatabaseError('Error inserting device status', error);
        } finally {
            conn.release();
        }
    }

    // Métodos de Mediciones
    async getLatestMeasurements() {
        const [rows] = await this.pool.query(`
            SELECT m.*, d.nombre as device_name, g.nombre as group_name,
                   ed.temperatura_celsius, ed.rssi_wifi
            FROM sem_mediciones m
            JOIN sem_dispositivos d ON m.shelly_id = d.shelly_id
            JOIN sem_grupos g ON d.grupo_id = g.id
            JOIN sem_estado_dispositivo ed ON m.shelly_id = ed.shelly_id
            WHERE m.fase = 'TOTAL'
            AND m.timestamp_utc = (
                SELECT MAX(timestamp_utc) 
                FROM sem_mediciones 
                WHERE shelly_id = m.shelly_id
            )
        `);

        return transformUtils.transformApiResponse(rows);
    }

    // Métodos de Promedios y Totales
    async getHourlyAverages(startDate, endDate, groupId = null) {
        const params = [startDate, endDate];
        let groupFilter = '';
        
        if (groupId) {
            groupFilter = 'AND d.grupo_id = ?';
            params.push(groupId);
        }

        const [rows] = await this.pool.query(`
            SELECT 
                ph.*,
                d.nombre as device_name,
                g.nombre as group_name
            FROM sem_promedios_hora ph
            JOIN sem_dispositivos d ON ph.shelly_id = d.shelly_id
            JOIN sem_grupos g ON d.grupo_id = g.id
            WHERE ph.hora_utc BETWEEN ? AND ?
            ${groupFilter}
            ORDER BY ph.hora_utc DESC
        `, params);

        return rows;
    }

    async getDailyTotals(startDate, endDate, groupId = null) {
        const params = [startDate, endDate];
        let groupFilter = '';
        
        if (groupId) {
            groupFilter = 'AND d.grupo_id = ?';
            params.push(groupId);
        }

        const [rows] = await this.pool.query(`
            SELECT 
                td.*,
                d.nombre as device_name,
                g.nombre as group_name
            FROM sem_totales_dia td
            JOIN sem_dispositivos d ON td.shelly_id = d.shelly_id
            JOIN sem_grupos g ON d.grupo_id = g.id
            WHERE td.fecha_utc BETWEEN ? AND ?
            ${groupFilter}
            ORDER BY td.fecha_utc DESC
        `, params);

        return rows;
    }

    // Métodos de Grupos
    async getGroupAverages(groupId, startDate, endDate, period = 'hour') {
        const tableName = this.getAveragesTableName(period);
        const timeField = this.getTimeFieldByPeriod(period);

        const [rows] = await this.pool.query(`
            SELECT * FROM ${tableName}
            WHERE grupo_id = ?
            AND ${timeField} BETWEEN ? AND ?
            ORDER BY ${timeField} DESC
        `, [groupId, startDate, endDate]);

        return rows;
    }

    // Métodos de Control de Calidad
    async getQualityStatus(deviceId, timestamp) {
        const [rows] = await this.pool.query(`
            SELECT * FROM sem_control_calidad
            WHERE shelly_id = ?
            AND inicio_periodo <= ?
            AND fin_periodo >= ?
        `, [deviceId, timestamp, timestamp]);

        return rows[0];
    }

    // Métodos Auxiliares
    validateDeviceData(data) {
        return data?.device_status && 
               data.device_status.id &&  // Cambiado a id
               data.device_status['em:0'];
    }
    getTimestamp(data) {
        return data.device_status.sys?.unixtime ? 
            new Date(data.device_status.sys.unixtime * 1000) : 
            new Date();
    }

    async ensureDeviceExists(conn, data) {
        const [device] = await conn.query(
            'SELECT * FROM sem_dispositivos WHERE shelly_id = ?',
            [data.device_status.id]  // Cambiado a id
        );
    
        if (!device[0]) {
            throw new NotFoundError('Device not registered in the system');
        }
    
        return device[0];
    }
    
    

    getAveragesTableName(period) {
        const tables = {
            hour: 'sem_promedios_hora',
            day: 'sem_promedios_dia',
            month: 'sem_promedios_mes'
        };
        return tables[period] || tables.hour;
    }

    getTimeFieldByPeriod(period) {
        const fields = {
            hour: 'hora_utc',
            day: 'fecha_utc',
            month: 'CONCAT(año, "-", LPAD(mes, 2, "0"), "-01")'
        };
        return fields[period] || fields.hour;
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

    mapReadingQuality(quality) {
        const qualityMap = {
            'GOOD': 'NORMAL',
            'WARN': 'ALERTA',
            'BAD': 'ERROR'
        };
        return qualityMap[quality] || 'NORMAL';
    }
    generateValidationDetails(data) {
        return JSON.stringify({
            voltaje: {
                valor: data.voltaje,
                calidad: this.validateVoltage(data.voltaje)
            },
            corriente: {
                valor: data.corriente,
                calidad: this.validateCurrent(data.corriente)
            },
            frecuencia: {
                valor: data.frecuencia,
                calidad: this.validateFrequency(data.frecuencia)
            },
            factor_potencia: {
                valor: data.factor_potencia,
                calidad: this.validatePowerFactor(data.factor_potencia)
            }
        });
    }

    validateVoltage(voltage) {
        return voltage >= 180 && voltage <= 260 ? 'NORMAL' : 'ERROR';
    }

    validateCurrent(current) {
        return current >= 0 && current <= 200 ? 'NORMAL' : 'ERROR';
    }

    validateFrequency(freq) {
        return freq >= 49 && freq <= 51 ? 'NORMAL' : 'ERROR';
    }

    validatePowerFactor(pf) {
        return pf >= -1 && pf <= 1 ? 'NORMAL' : 'ERROR';
    }
}

module.exports = new DatabaseService();
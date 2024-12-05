// database-service.js
const mysql = require('mysql2/promise');
const config = require('../../config/config-loader');

class DatabaseService {
    constructor() {
        const { database: dbConfig } = config.getConfig();
        
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

        this.measurementConfig = null;
        this.loadMeasurementConfig();
    }

    async loadMeasurementConfig() {
        try {
            const [rows] = await this.pool.query('SELECT parameter_name, parameter_value FROM energy_measurement_config');
            this.measurementConfig = rows.reduce((config, row) => {
                config[row.parameter_name] = row.parameter_value;
                return config;
            }, {});
        } catch (error) {
            console.error('Error loading measurement config:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            await connection.query('SELECT 1');
            console.log('✅ Conexión a la base de datos establecida correctamente');
            connection.release();
            return true;
        } catch (error) {
            console.error('❌ Error de conexión a la base de datos:', error.message);
            return false;
        }
    }

    async updateMeasurementQualityControl(conn, energyMeterId, timestamp) {
        try {
            // Obtener el período de control (última hora)
            const startTime = new Date(timestamp);
            startTime.setHours(startTime.getHours() - 1);
    
            // Consultar las mediciones en el período
            const [rows] = await conn.query(`
                SELECT 
                    COUNT(*) as total_readings,
                    COUNT(CASE WHEN reading_quality = 'GOOD' THEN 1 END) as good_readings,
                    COUNT(CASE WHEN reading_quality = 'INTERPOLATED' THEN 1 END) as interpolated_readings,
                    MIN(measurement_timestamp) as start_timestamp,
                    MAX(measurement_timestamp) as end_timestamp
                FROM energy_meter
                WHERE measurement_timestamp BETWEEN ? AND ?
            `, [startTime, timestamp]);
    
            if (rows[0].total_readings > 0) {
                const data = rows[0];
                const expectedReadings = Math.floor((timestamp - startTime) / (parseInt(this.measurementConfig?.intervalo_medicion || 10) * 1000));
                const missingIntervals = Math.max(0, expectedReadings - data.total_readings);
                const qualityScore = data.good_readings / expectedReadings;
    
                // Insertar o actualizar el control de calidad
                await conn.query(`
                    INSERT INTO measurement_quality_control 
                    (energy_meter_id, start_timestamp, end_timestamp, expected_readings, 
                    actual_readings, missing_intervals, interpolated_readings, quality_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    actual_readings = VALUES(actual_readings),
                    missing_intervals = VALUES(missing_intervals),
                    interpolated_readings = VALUES(interpolated_readings),
                    quality_score = VALUES(quality_score)
                `, [
                    energyMeterId,
                    data.start_timestamp,
                    data.end_timestamp,
                    expectedReadings,
                    data.total_readings,
                    missingIntervals,
                    data.interpolated_readings,
                    qualityScore
                ]);
            }
        } catch (error) {
            console.error('Error updating measurement quality control:', error);
            throw error;
        }
    }

    getDefaultTimestamp() {
        return new Date();
    }

    validateDeviceData(data) {
        if (!data || !data.device_status) {
            throw new Error('Datos del dispositivo inválidos o vacíos');
        }
        return true;
    }

    ensureNumericValue(value, defaultValue = 0) {
        return typeof value === 'number' ? value : defaultValue;
    }

    async insertDeviceStatus(data) {
        this.validateDeviceData(data);
        const conn = await this.pool.getConnection();
        
        try {
            await conn.beginTransaction();

            // Asegurar timestamp válido
            const currentTimestamp = data.device_status.sys?.unixtime 
                ? new Date(data.device_status.sys.unixtime * 1000)
                : this.getDefaultTimestamp();

            // Datos del medidor de energía
            const emData = data.device_status['em:0'] || {};
            const [emResult] = await conn.query(
                `INSERT INTO energy_meter SET ?`,
                {
                    fase_a_act_power: this.ensureNumericValue(emData.a_act_power),
                    fase_a_aprt_power: this.ensureNumericValue(emData.a_aprt_power),
                    fase_a_current: this.ensureNumericValue(emData.a_current),
                    fase_a_freq: this.ensureNumericValue(emData.a_freq),
                    fase_a_pf: this.ensureNumericValue(emData.a_pf),
                    fase_a_voltage: this.ensureNumericValue(emData.a_voltage),
                    fase_b_act_power: this.ensureNumericValue(emData.b_act_power),
                    fase_b_aprt_power: this.ensureNumericValue(emData.b_aprt_power),
                    fase_b_current: this.ensureNumericValue(emData.b_current),
                    fase_b_freq: this.ensureNumericValue(emData.b_freq),
                    fase_b_pf: this.ensureNumericValue(emData.b_pf),
                    fase_b_voltage: this.ensureNumericValue(emData.b_voltage),
                    fase_c_act_power: this.ensureNumericValue(emData.c_act_power),
                    fase_c_aprt_power: this.ensureNumericValue(emData.c_aprt_power),
                    fase_c_current: this.ensureNumericValue(emData.c_current),
                    fase_c_freq: this.ensureNumericValue(emData.c_freq),
                    fase_c_pf: this.ensureNumericValue(emData.c_pf),
                    fase_c_voltage: this.ensureNumericValue(emData.c_voltage),
                    total_act_power: this.ensureNumericValue(emData.total_act_power),
                    total_aprt_power: this.ensureNumericValue(emData.total_aprt_power),
                    total_current: this.ensureNumericValue(emData.total_current),
                    measurement_timestamp: currentTimestamp,
                    interval_seconds: parseInt(this.measurementConfig?.intervalo_medicion || 10),
                    reading_quality: data.device_status.reading_quality || 'GOOD',
                    readings_count: 1,
                    user_calibrated_phases: Boolean(emData.user_calibrated_phase?.length > 0)
                }
            );

            // Datos de temperatura
            const tempData = data.device_status['temperature:0'] || {};
            const [tempResult] = await conn.query(
                `INSERT INTO temperature SET ?`,
                {
                    celsius: this.ensureNumericValue(tempData.tC),
                    fahrenheit: this.ensureNumericValue(tempData.tF)
                }
            );

            // Datos adicionales del medidor
            const emdData = data.device_status['emdata:0'] || {};
            const [emdataResult] = await conn.query(
                `INSERT INTO energy_meter_data SET ?`,
                {
                    a_total_act_energy: this.ensureNumericValue(emdData.a_total_act_energy),
                    a_total_act_ret_energy: this.ensureNumericValue(emdData.a_total_act_ret_energy),
                    b_total_act_energy: this.ensureNumericValue(emdData.b_total_act_energy),
                    b_total_act_ret_energy: this.ensureNumericValue(emdData.b_total_act_ret_energy),
                    c_total_act_energy: this.ensureNumericValue(emdData.c_total_act_energy),
                    c_total_act_ret_energy: this.ensureNumericValue(emdData.c_total_act_ret_energy),
                    total_act_energy: this.ensureNumericValue(emdData.total_act),
                    total_act_ret_energy: this.ensureNumericValue(emdData.total_act_ret)
                }
            );

            // Estado del dispositivo
            const [deviceResult] = await conn.query(
                `INSERT INTO device_status SET ?`,
                {
                    code: data.device_status.code || null,
                    em0_id: emResult.insertId,
                    temperature0_id: tempResult.insertId,
                    emdata0_id: emdataResult.insertId,
                    updated: currentTimestamp,
                    cloud_connected: Boolean(data.device_status.cloud?.connected),
                    wifi_sta_ip: data.device_status.wifi?.sta_ip || null,
                    wifi_status: data.device_status.wifi?.status || null,
                    wifi_ssid: data.device_status.wifi?.ssid || null,
                    wifi_rssi: this.ensureNumericValue(data.device_status.wifi?.rssi),
                    sys_mac: data.device_status.sys?.mac || null,
                    sys_restart_required: Boolean(data.device_status.sys?.restart_required),
                    sys_time: data.device_status.sys?.time || null,
                    sys_timestamp: currentTimestamp,
                    sys_uptime: this.ensureNumericValue(data.device_status.sys?.uptime),
                    sys_ram_size: this.ensureNumericValue(data.device_status.sys?.ram_size),
                    sys_ram_free: this.ensureNumericValue(data.device_status.sys?.ram_free),
                    sys_fs_size: this.ensureNumericValue(data.device_status.sys?.fs_size),
                    sys_fs_free: this.ensureNumericValue(data.device_status.sys?.fs_free),
                    sys_cfg_rev: this.ensureNumericValue(data.device_status.sys?.cfg_rev),
                    sys_kvs_rev: this.ensureNumericValue(data.device_status.sys?.kvs_rev),
                    sys_schedule_rev: this.ensureNumericValue(data.device_status.sys?.schedule_rev),
                    sys_webhook_rev: this.ensureNumericValue(data.device_status.sys?.webhook_rev),
                    sys_reset_reason: this.ensureNumericValue(data.device_status.sys?.reset_reason)
                }
            );

            await this.updateMeasurementQualityControl(conn, emResult.insertId, currentTimestamp);

            await conn.commit();
            return { success: true, deviceId: deviceResult.insertId };
        } catch (error) {
            await conn.rollback();
            console.error('Error al insertar el estado del dispositivo:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    async getLatestStatus() {
        try {
            const [rows] = await this.pool.query(`
                SELECT 
                    ds.*,
                    em.fase_a_voltage, em.fase_b_voltage, em.fase_c_voltage,
                    em.fase_a_current, em.fase_b_current, em.fase_c_current,
                    em.total_act_power, em.total_current, em.reading_quality,
                    t.celsius, t.fahrenheit,
                    emd.total_act_energy, emd.total_act_ret_energy
                FROM device_status ds
                LEFT JOIN energy_meter em ON ds.em0_id = em.id
                LEFT JOIN temperature t ON ds.temperature0_id = t.id
                LEFT JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
                ORDER BY ds.sys_timestamp DESC
                LIMIT 1
            `);
            return rows[0] || null;
        } catch (error) {
            console.error('Error al obtener el último estado:', error);
            throw error;
        }
    }

    async getHistory(hours = 24) {
        try {
            const [rows] = await this.pool.query(`
                SELECT 
                    ds.sys_timestamp,
                    em.total_act_power,
                    em.total_current,
                    em.reading_quality,
                    t.celsius,
                    emd.total_act_energy
                FROM device_status ds
                LEFT JOIN energy_meter em ON ds.em0_id = em.id
                LEFT JOIN temperature t ON ds.temperature0_id = t.id
                LEFT JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
                WHERE ds.sys_timestamp >= NOW() - INTERVAL ? HOUR
                  AND em.reading_quality = 'GOOD'
                ORDER BY ds.sys_timestamp ASC
            `, [hours]);
            return rows;
        } catch (error) {
            console.error('Error al obtener el historial:', error);
            throw error;
        }
    }

    async close() {
        try {
            await this.pool.end();
            console.log('✅ Conexiones de base de datos cerradas correctamente');
        } catch (error) {
            console.error('❌ Error al cerrar las conexiones de base de datos:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();
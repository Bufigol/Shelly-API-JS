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

    validateNumericField(value, fieldName, defaultValue = 0) {
        if (value === null || value === undefined) {
            console.warn(`Field ${fieldName} is null or undefined, using default: ${defaultValue}`);
            return defaultValue;
        }
        
        const numValue = Number(value);
        if (isNaN(numValue)) {
            console.warn(`Field ${fieldName} is not a valid number: ${value}, using default: ${defaultValue}`);
            return defaultValue;
        }
        
        return numValue;
    }

    async loadMeasurementConfig() {
        try {
            const [rows] = await this.pool.query('SELECT parameter_name, parameter_value FROM energy_measurement_config');
            this.measurementConfig = rows.reduce((config, row) => ({
                ...config,
                [row.parameter_name]: row.parameter_value
            }), {});
            console.log('✅ Measurement config loaded');
        } catch (error) {
            console.error('❌ Error loading measurement config:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            const connection = await this.pool.getConnection();
            await connection.query('SELECT 1');
            console.log('✅ Database connection established');
            connection.release();
            return true;
        } catch (error) {
            console.error('❌ Database connection error:', error.message);
            return false;
        }
    }

    async updateMeasurementQualityControl(conn, energyMeterId, timestamp) {
        try {
            const startTime = new Date(timestamp);
            startTime.setHours(startTime.getHours() - 1);
            
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
                const { total_readings, good_readings, interpolated_readings, start_timestamp, end_timestamp } = rows[0];
                const expectedReadings = Math.floor((timestamp - startTime) / (parseInt(this.measurementConfig?.intervalo_medicion || 10) * 1000));
                const missingIntervals = Math.max(0, expectedReadings - total_readings);
                const qualityScore = good_readings / expectedReadings;

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
                `, [energyMeterId, start_timestamp, end_timestamp, expectedReadings, 
                    total_readings, missingIntervals, interpolated_readings, qualityScore]);
            }
        } catch (error) {
            console.error('Error updating measurement quality control:', error);
            throw error;
        }
    }

    validateDeviceData(data) {
        if (!data?.device_status) {
            throw new Error('Invalid or empty device data');
        }
        
        if (!data.device_status['em:0']) {
            console.warn('Missing em:0 data in device status');
        }
        
        return true;
    }

    prepareEnergyMeterData(emData, timestamp) {
        console.log('Preparing energy meter data:', JSON.stringify(emData, null, 2));
        
        return {
            fase_a_act_power: this.validateNumericField(emData.a_act_power, 'a_act_power'),
            fase_a_aprt_power: this.validateNumericField(emData.a_aprt_power, 'a_aprt_power'),
            fase_a_current: this.validateNumericField(emData.a_current, 'a_current'),
            fase_a_freq: this.validateNumericField(emData.a_freq, 'a_freq'),
            fase_a_pf: this.validateNumericField(emData.a_pf, 'a_pf'),
            fase_a_voltage: this.validateNumericField(emData.a_voltage, 'a_voltage'),
            fase_b_act_power: this.validateNumericField(emData.b_act_power, 'b_act_power'),
            fase_b_aprt_power: this.validateNumericField(emData.b_aprt_power, 'b_aprt_power'),
            fase_b_current: this.validateNumericField(emData.b_current, 'b_current'),
            fase_b_freq: this.validateNumericField(emData.b_freq, 'b_freq'),
            fase_b_pf: this.validateNumericField(emData.b_pf, 'b_pf'),
            fase_b_voltage: this.validateNumericField(emData.b_voltage, 'b_voltage'),
            fase_c_act_power: this.validateNumericField(emData.c_act_power, 'c_act_power'),
            fase_c_aprt_power: this.validateNumericField(emData.c_aprt_power, 'c_aprt_power'),
            fase_c_current: this.validateNumericField(emData.c_current, 'c_current'),
            fase_c_freq: this.validateNumericField(emData.c_freq, 'c_freq'),
            fase_c_pf: this.validateNumericField(emData.c_pf, 'c_pf'),
            fase_c_voltage: this.validateNumericField(emData.c_voltage, 'c_voltage'),
            total_act_power: this.validateNumericField(emData.total_act_power, 'total_act_power'),
            total_aprt_power: this.validateNumericField(emData.total_aprt_power, 'total_aprt_power'),
            total_current: this.validateNumericField(emData.total_current, 'total_current'),
            measurement_timestamp: timestamp,
            interval_seconds: 10,
            reading_quality: 'GOOD',
            readings_count: 1,
            user_calibrated_phases: Array.isArray(emData.user_calibrated_phase) && emData.user_calibrated_phase.length > 0
        };
    }

    async insertDeviceStatus(data) {
        this.validateDeviceData(data);
        const conn = await this.pool.getConnection();
        
        try {
            await conn.beginTransaction();
            console.log('Transaction started');

            const currentTimestamp = data.device_status.sys?.unixtime ? 
                new Date(data.device_status.sys.unixtime * 1000) : 
                new Date();

            // Insert energy meter data
            const emData = this.prepareEnergyMeterData(data.device_status['em:0'] || {}, currentTimestamp);
            const [emResult] = await conn.query('INSERT INTO energy_meter SET ?', emData);
            console.log('Energy meter data inserted, ID:', emResult.insertId);

            // Insert temperature data
            const tempData = data.device_status['temperature:0'] || {};
            const [tempResult] = await conn.query('INSERT INTO temperature SET ?', {
                celsius: this.validateNumericField(tempData.tC, 'temperature_celsius'),
                fahrenheit: this.validateNumericField(tempData.tF, 'temperature_fahrenheit')
            });
            console.log('Temperature data inserted, ID:', tempResult.insertId);

            // Insert energy meter additional data
            const emdData = data.device_status['emdata:0'] || {};
            const [emdataResult] = await conn.query('INSERT INTO energy_meter_data SET ?', {
                a_total_act_energy: this.validateNumericField(emdData.a_total_act_energy, 'a_total_act_energy'),
                a_total_act_ret_energy: this.validateNumericField(emdData.a_total_act_ret_energy, 'a_total_act_ret_energy'),
                b_total_act_energy: this.validateNumericField(emdData.b_total_act_energy, 'b_total_act_energy'),
                b_total_act_ret_energy: this.validateNumericField(emdData.b_total_act_ret_energy, 'b_total_act_ret_energy'),
                c_total_act_energy: this.validateNumericField(emdData.c_total_act_energy, 'c_total_act_energy'),
                c_total_act_ret_energy: this.validateNumericField(emdData.c_total_act_ret_energy, 'c_total_act_ret_energy'),
                total_act_energy: this.validateNumericField(emdData.total_act, 'total_act'),
                total_act_ret_energy: this.validateNumericField(emdData.total_act_ret, 'total_act_ret')
            });
            console.log('Energy meter additional data inserted, ID:', emdataResult.insertId);

            // Insert device status
            const [deviceResult] = await conn.query('INSERT INTO device_status SET ?', {
                code: data.device_status.code,
                em0_id: emResult.insertId,
                temperature0_id: tempResult.insertId,
                emdata0_id: emdataResult.insertId,
                updated: currentTimestamp,
                cloud_connected: Boolean(data.device_status.cloud?.connected),
                wifi_sta_ip: data.device_status.wifi?.sta_ip,
                wifi_status: data.device_status.wifi?.status,
                wifi_ssid: data.device_status.wifi?.ssid,
                wifi_rssi: this.validateNumericField(data.device_status.wifi?.rssi, 'wifi_rssi'),
                sys_mac: data.device_status.sys?.mac,
                sys_restart_required: Boolean(data.device_status.sys?.restart_required),
                sys_time: data.device_status.sys?.time,
                sys_timestamp: currentTimestamp,
                sys_uptime: this.validateNumericField(data.device_status.sys?.uptime, 'sys_uptime'),
                sys_ram_size: this.validateNumericField(data.device_status.sys?.ram_size, 'sys_ram_size'),
                sys_ram_free: this.validateNumericField(data.device_status.sys?.ram_free, 'sys_ram_free'),
                sys_fs_size: this.validateNumericField(data.device_status.sys?.fs_size, 'sys_fs_size'),
                sys_fs_free: this.validateNumericField(data.device_status.sys?.fs_free, 'sys_fs_free'),
                sys_cfg_rev: this.validateNumericField(data.device_status.sys?.cfg_rev, 'sys_cfg_rev'),
                sys_kvs_rev: this.validateNumericField(data.device_status.sys?.kvs_rev, 'sys_kvs_rev'),
                sys_schedule_rev: this.validateNumericField(data.device_status.sys?.schedule_rev, 'sys_schedule_rev'),
                sys_webhook_rev: this.validateNumericField(data.device_status.sys?.webhook_rev, 'sys_webhook_rev'),
                sys_reset_reason: this.validateNumericField(data.device_status.sys?.reset_reason, 'sys_reset_reason')
            });
            console.log('Device status inserted, ID:', deviceResult.insertId);

            await this.updateMeasurementQualityControl(conn, emResult.insertId, currentTimestamp);
            await conn.commit();
            console.log('Transaction committed successfully');

            return { 
                success: true, 
                deviceId: deviceResult.insertId,
                timestamp: currentTimestamp 
            };
        } catch (error) {
            await conn.rollback();
            console.error('Error in insertDeviceStatus:', error);
            throw error;
        } finally {
            conn.release();
        }
    }

    async getLatestStatus() {
        try {
            const [rows] = await this.pool.query(`
                SELECT 
                    ds.*, em.*, t.*, emd.*
                FROM device_status ds
                LEFT JOIN energy_meter em ON ds.em0_id = em.id
                LEFT JOIN temperature t ON ds.temperature0_id = t.id
                LEFT JOIN energy_meter_data emd ON ds.emdata0_id = emd.id
                ORDER BY ds.sys_timestamp DESC
                LIMIT 1
            `);
            return rows[0] || null;
        } catch (error) {
            console.error('Error getting latest status:', error);
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
            console.error('Error getting history:', error);
            throw error;
        }
    }

    async close() {
        try {
            await this.pool.end();
            console.log('✅ Database connections closed');
        } catch (error) {
            console.error('❌ Error closing database connections:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();
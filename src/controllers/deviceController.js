const databaseService = require('../services/database-service');
const { DeviceError, NotFoundError } = require('../utils/errors');
const { transformUtils } = require('../utils/transformUtils');

class DeviceController {
    async getLatestStatus(req, res, next) {
        try {
            const status = await databaseService.getLatestStatus();
            if (!status) {
                throw new NotFoundError('No se encontró estado del dispositivo');
            }
            res.json(transformUtils.transformApiResponse(status));
        } catch (error) {
            next(error);
        }
    }

    async getStatusHistory(req, res, next) {
        try {
            const { hours = 24 } = req.query;
            const history = await databaseService.getHistory(parseInt(hours));
            res.json(transformUtils.transformApiResponse(history));
        } catch (error) {
            next(error);
        }
    }

    async insertDeviceStatus(req, res, next) {
        try {
            const result = await databaseService.insertDeviceStatus(req.validatedMeasurement);
            res.status(201).json(transformUtils.transformApiResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async getDeviceConfig(req, res, next) {
        try {
            const { deviceId } = req.params;
            const config = await databaseService.getDeviceConfig(deviceId);
            if (!config) {
                throw new NotFoundError('Configuración no encontrada', deviceId);
            }
            res.json(transformUtils.transformApiResponse(config));
        } catch (error) {
            next(error);
        }
    }

    async updateDeviceConfig(req, res, next) {
        try {
            const { deviceId } = req.params;
            const result = await databaseService.updateDeviceConfig(deviceId, req.body);
            res.json(transformUtils.transformApiResponse(result));
        } catch (error) {
            next(error);
        }
    }

    async getLatestDevicesMeasurements(req, res, next) {
        try {
            const query = `
                SELECT 
                    d.shelly_id,
                    cur.nombre_ubicacion as location,
                    m.potencia_activa as activePower,
                    m.timestamp_local as lastUpdate
                FROM sem_dispositivos d
                LEFT JOIN catalogo_ubicaciones_reales cur ON d.ubicacion = cur.idcatalogo_ubicaciones_reales
                LEFT JOIN (
                    SELECT 
                        shelly_id,
                        potencia_activa,
                        timestamp_local,
                        ROW_NUMBER() OVER (PARTITION BY shelly_id ORDER BY timestamp_local DESC) as rn
                    FROM sem_mediciones
                    WHERE fase = 'TOTAL'
                ) m ON d.shelly_id = m.shelly_id AND m.rn = 1
                WHERE d.activo = 1
                ORDER BY cur.nombre_ubicacion`;
    
            const [rows] = await databaseService.pool.query(query);
    
            const devices = rows.map(row => ({
                deviceId: row.shelly_id,
                location: row.location,
                activePower: row.activePower ? parseFloat(row.activePower) : 0,
                lastUpdate: row.lastUpdate
            }));
    
            res.json({
                success: true,
                data: devices,
                timestamp: new Date()
            });
    
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new DeviceController();
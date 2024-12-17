// controllers/totalesController.js
const databaseService = require('../services/database-service');
const { transformUtils } = require('../utils/transformUtils');

class TotalesController {
    async getDailyTotalsByDevice(req, res, next) {
         try {
             const { date } = req.validatedDates;

            const query = `
                SELECT 
                    shelly_id,
                    hora_local,
                    energia_activa_total,
                    costo_total,
                    SUM(costo_total) OVER (
                        PARTITION BY shelly_id 
                        ORDER BY hora_local
                    ) AS costo_acumulado
                FROM 
                    sem_totales_hora
                WHERE 
                    DATE(hora_local) = ?
                ORDER BY 
                    shelly_id,
                    hora_local;
            `;

            const [rows] = await databaseService.pool.query(query, [date]);
            
             res.json(transformUtils.transformApiResponse(rows));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TotalesController();
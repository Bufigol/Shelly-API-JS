// controllers/totalesController.js
const databaseService = require("../services/database-service");
const transformUtils = require("../utils/transformUtils");
const { DateTime } = require("luxon");

class TotalesController {
    async getDailyTotalsByDevice(req, res, next) {
        try {
            const { date } = req.validatedDates;

            const query = `
                SELECT 
                    dispo.ubicacion,
                    tot.shelly_id,
                    tot.hora_local,
                    tot.energia_activa_total,
                    tot.costo_total, 
                    SUM(tot.costo_total) OVER (
                        PARTITION BY tot.shelly_id
                        ORDER BY tot.hora_local
                    ) AS costo_acumulado
                FROM 
                    sem_totales_hora AS tot
                JOIN
                    sem_dispositivos AS dispo
                ON
                    tot.shelly_id = dispo.shelly_id
                WHERE 
                    DATE(hora_local) = ?  
                ORDER BY 
                    tot.shelly_id,
                    tot.hora_local;
            `;

            const [rows] = await databaseService.pool.query(query, [date]);

            res.json(transformUtils.transformApiResponse(rows));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TotalesController();

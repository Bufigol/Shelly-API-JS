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

  async getMonthlyTotalsByDevice(req, res, next) {
    try {
      const { date } = req.validatedDates;

      const query = `
                SELECT 
                    std.fecha_local,
                    std.shelly_id,
                    std.energia_activa_total,
                    std.costo_total,
                    std.precio_kwh_promedio,
                    cur.nombre_ubicacion as ubicacion_nombre,
                    sd.nombre as dispositivo_nombre
                FROM sem_totales_dia std
                JOIN sem_dispositivos sd ON std.shelly_id = sd.shelly_id
                JOIN catalogo_ubicaciones_reales cur ON sd.ubicacion = cur.idcatalogo_ubicaciones_reales
                WHERE
                    YEAR(std.fecha_local) = YEAR(?) AND MONTH(std.fecha_local) = MONTH(?)
                ORDER BY
                    std.fecha_local, cur.nombre_ubicacion, sd.nombre
            `;

      const [rows] = await databaseService.pool.query(query, [date, date]);

      res.json(transformUtils.transformApiResponse(rows));
    } catch (error) {
      next(error);
    }
  }

  async getYearlyTotalsByDevice(req, res, next) {
    try {
      const { year } = req.validatedDates;

      const query = `
            SELECT 
                stm.id,
                stm.shelly_id,
                stm.año as anio,
                stm.mes,
                stm.energia_activa_total,
                stm.energia_reactiva_total,
                stm.potencia_maxima,
                stm.potencia_minima,
                stm.precio_kwh_promedio,
                stm.costo_total,
                stm.dias_con_datos,
                stm.horas_con_datos,
                stm.fecha_creacion,
                stm.fecha_actualizacion,
                cur.nombre_ubicacion as ubicacion_nombre,
                sd.nombre as dispositivo_nombre
            FROM 
                sem_totales_mes stm
            JOIN 
                sem_dispositivos sd ON stm.shelly_id = sd.shelly_id
            JOIN 
                catalogo_ubicaciones_reales cur ON sd.ubicacion = cur.idcatalogo_ubicaciones_reales
            WHERE 
                stm.año = ?
            ORDER BY 
                stm.mes, cur.nombre_ubicacion, sd.nombre
        `;

      const [rows] = await databaseService.pool.query(query, [parseInt(year)]);

      res.json(transformUtils.transformApiResponse(rows));
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TotalesController();

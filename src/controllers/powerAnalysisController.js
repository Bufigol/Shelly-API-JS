const databaseService = require("../services/database-service");
const moment = require("moment-timezone");

class PowerAnalysisController {
  async handleTemperaturePowerLocations(req, res) {
    try {
      const query = `
                SELECT DISTINCT 
                    c.ubicacion_real as ubicacion_id,
                    cat.nombre_ubicacion,
                    c.channel_id,
                    c.name as channel_name,
                    c.esOperativa,
                    d.shelly_id,
                    d.nombre as shelly_name
                FROM channels_ubibot c
                JOIN catalogo_ubicaciones_reales cat ON c.ubicacion_real = cat.idcatalogo_ubicaciones_reales
                JOIN sem_dispositivos d ON d.ubicacion = c.ubicacion_real
                WHERE d.activo = 1
                ORDER BY cat.nombre_ubicacion, c.name
            `;

      const [results] = await databaseService.pool.query(query);

      // Procesar los resultados para una estructura más organizada
      const locations = results.reduce((acc, item) => {
        if (!acc[item.ubicacion_id]) {
          acc[item.ubicacion_id] = {
            id: item.ubicacion_id,
            nombre: item.nombre_ubicacion,
            shellyDevice: {
              id: item.shelly_id,
              name: item.shelly_name,
            },
            channels: [],
          };
        }

        acc[item.ubicacion_id].channels.push({
          id: item.channel_id,
          name: item.channel_name,
          isOperative: item.esOperativa === 1,
        });

        return acc;
      }, {});

      res.json(Object.values(locations));
    } catch (error) {
      console.error("Error fetching locations and channels:", error);
      res.status(500).json({
        error: "Error retrieving locations and channels data",
        details: error.message,
      });
    }
  }
  async handleTemperaturePowerAnalysis(req, res) {
    const { ubicacion, channelId } = req.query;
    const date = req.params.date;

    try {
      const query = `
        WITH temp_mediciones AS (
          SELECT 
            DATE_FORMAT(
              DATE_ADD(timestamp_local,
              INTERVAL -(MINUTE(timestamp_local) % 15) MINUTE
            ), '%Y-%m-%d %H:%i:00') as intervalo_tiempo,
            AVG(CASE 
              WHEN calidad_lectura = 'NORMAL' AND potencia_activa IS NOT NULL 
              THEN potencia_activa / 1000 
              ELSE NULL 
            END) as potencia_promedio,
            COUNT(*) as lecturas_potencia
          FROM sem_mediciones
          WHERE DATE(timestamp_local) = ?
            AND fase = 'TOTAL'
            AND shelly_id IN (SELECT shelly_id FROM sem_dispositivos WHERE ubicacion = ?)
          GROUP BY intervalo_tiempo
        ),
        temp_temperaturas AS (
          SELECT 
            DATE_FORMAT(
              DATE_ADD(timestamp,
              INTERVAL -(MINUTE(timestamp) % 15) MINUTE
            ), '%Y-%m-%d %H:%i:00') as intervalo_tiempo,
            AVG(external_temperature) as temperatura_promedio,
            COUNT(*) as lecturas_temperatura
          FROM sensor_readings_ubibot
          WHERE DATE(timestamp) = ?
            AND channel_id = ?
          GROUP BY intervalo_tiempo
        )
        SELECT 
          m.intervalo_tiempo,
          cat.nombre_ubicacion,
          ROUND(t.temperatura_promedio, 2) as promedio_temperatura_externa,
          ROUND(m.potencia_promedio, 3) as promedio_potencia_kw,
          t.lecturas_temperatura,
          m.lecturas_potencia
        FROM temp_mediciones m
        LEFT JOIN temp_temperaturas t ON t.intervalo_tiempo = m.intervalo_tiempo
        JOIN sem_dispositivos d ON d.ubicacion = ?
        JOIN catalogo_ubicaciones_reales cat ON cat.idcatalogo_ubicaciones_reales = d.ubicacion
        ORDER BY m.intervalo_tiempo;
      `;

      const [results] = await databaseService.pool.query(query, [
        date,
        ubicacion,
        date,
        channelId,
        ubicacion
      ]);

      res.json(results);
    } catch (error) {
      console.error("Error in temperature-power analysis:", error);
      res.status(500).json({ error: "Error analyzing temperature and power data" });
    }
  }
}

module.exports = new PowerAnalysisController();

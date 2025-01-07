// controllers/ubibotController.js
const databaseService = require("../services/database-service");
const transformUtils = require("../utils/transformUtils");

class ubibotController {
  async getTemperatureRangeData(req, res) {
    try {
      const { startDate, endDate, deviceId } = req.query;
      console.log("Received request for:", { startDate, endDate, deviceId });
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ error: "Se requieren fechas de inicio y fin" });
      }

      // Crear el rango de fechas sin conversión de zona horaria
      const start = moment(startDate).startOf("day");
      const end = moment(endDate).endOf("day");
      console.log(
        "Querying from:",
        start.format("YYYY-MM-DD HH:mm:ss"),
        "to:",
        end.format("YYYY-MM-DD HH:mm:ss")
      );

      let query = `
              SELECT sr.channel_id, sr.external_temperature, sr.external_temperature_timestamp, c.name
              FROM sensor_readings_ubibot sr
              JOIN channels_ubibot c ON sr.channel_id = c.channel_id
              WHERE sr.external_temperature_timestamp >= ? AND sr.external_temperature_timestamp <= ?
            `;

      let params = [
        start.format("YYYY-MM-DD HH:mm:ss"),
        end.format("YYYY-MM-DD HH:mm:ss"),
      ];
      if (deviceId) {
        query += " AND sr.channel_id = ?";
        params.push(deviceId);
      }
      query += " ORDER BY sr.channel_id, sr.external_temperature_timestamp ASC";

      const [rows] = await pool.query(query, params);
      console.log("Query returned", rows.length, "rows");

      // Agrupar los datos por canal
      const groupedData = rows.reduce((acc, row) => {
        if (!acc[row.channel_id]) {
          acc[row.channel_id] = {
            channel_id: row.channel_id,
            name: row.name,
            data: [],
          };
        }
        acc[row.channel_id].data.push({
          timestamp: moment(row.external_temperature_timestamp).format(
            "YYYY-MM-DD HH:mm:ss"
          ),
          external_temperature: parseFloat(row.external_temperature),
        });
        return acc;
      }, {});

      const processedData = Object.values(groupedData);
      console.log(
        "Processed data:",
        processedData.map((d) => ({
          channel_id: d.channel_id,
          name: d.name,
          dataPoints: d.data.length,
        }))
      );
      res.json(processedData);
    } catch (error) {
      console.error("Error fetching temperature data:", error);
      res.status(500).json({ error: "Error del servidor" });
    }
  }

  /**
   * Endpoint para obtener los dispositivos de temperatura
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   */
  async getTemperatureDevices(req, res) {
    try {
      const [devices] = await pool.query(
        "SELECT channel_id, name FROM channels_ubibot"
      );
      res.json(devices);
    } catch (error) {
      console.error("Error fetching temperature devices:", error);
      res.status(500).send("Server Error");
    }
  }
}

module.exports = new ubibotController();

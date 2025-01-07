// controllers/ubibotController.js
const databaseService = require("../services/database-service");
const transformUtils = require("../utils/transformUtils");
const moment = require("moment");
const pool = require("../config/database");
const TemperatureAnalyzer = require("../utils/TemperatureAnalyzer"); // o similar
const { getDefrostData } = require("../services/defrost-service"); // o similar
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

  /**
   * Actualiza el estado de un canal de temperatura
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   * @param {number} req.body.channelId - ID del canal de temperatura
   * @param {boolean} req.body.esOperativa - Indica si el canal está en estado operativo
   */
  async updateChannelStatus(req, res) {
    const { channelId, esOperativa } = req.body;
    try {
      await pool.query(
        "UPDATE channels_ubibot SET esOperativa = ? WHERE channel_id = ?",
        [esOperativa, channelId]
      );
      res.sendStatus(200);
    } catch (error) {
      console.error("Error updating channel status:", error);
      res.status(500).send("Server Error");
    }
  }

  async getChannelStatus(req, res) {
    try {
      const [results] = await pool.query(
        "SELECT channel_id, name, esOperativa FROM channels_ubibot"
      );
      res.json(results);
    } catch (error) {
      console.error("Error fetching channel status:", error);
      res.status(500).send("Server Error");
    }
  }

  async handleUpdateChannelStatus(req, res) {
    const { channelId, esOperativa } = req.body;
    try {
      await pool.query(
        "UPDATE channels_ubibot SET esOperativa = ? WHERE channel_id = ?",
        [esOperativa, channelId]
      );
      res.sendStatus(200);
    } catch (error) {
      console.error("Error updating channel status:", error);
      res.status(500).send("Server Error");
    }
  }

  /**
   * Generates a defrost report for the given channel and date
   * @param {Object} req - The request object
   * @param {string} req.body.channelId - The ID of the channel to generate the report for
   * @param {string} req.body.date - The date to generate the report for
   * @param {Object} res - The response object
   * @returns {Promise<void>}
   * @throws {Error} If there was an error generating the report
   */
  async handleGenerateDefrostReport(req, res) {
    const { channelId, date } = req.body;

    try {
      const [cameraInfo] = await pool.query(
        "SELECT name FROM channels_ubibot WHERE channel_id = ?",
        [channelId]
      );
      const cameraName = cameraInfo[0]?.name || "Unknown";

      // Get the selected date and the date 7 days before
      const selectedDate = moment(date);
      const previousDate = moment(date).subtract(7, "days");

      const { results: currentData } = await getDefrostData(
        channelId,
        selectedDate.format("YYYY-MM-DD"),
        cameraName
      );
      const { results: previousData, fileName } = await getDefrostData(
        channelId,
        previousDate.format("YYYY-MM-DD"),
        cameraName
      );
      if (!currentData || currentData.length === 0) {
        return res.status(400).json({
          error: "No hay datos disponibles para esta fecha",
        });
      }
      const analyzer = new TemperatureAnalyzer();
      // Process the data for each period
      await analyzer.analyzeData(currentData, previousData, cameraName, date);

      const pdfBuffer = await analyzer.generatePDF(cameraName, date); // <-- line 1839

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({
        error: "Error generando el informe",
        details: error.message,
      });
    }
  }

  /**
   * Returns the temperature data for the selected date and the previous week.
   * Data is returned in two arrays, one for the current period and one for the
   * previous period.
   * @param {Object} req HTTP request object
   * @param {string} req.query.channelId The ID of the Ubibot channel
   * @param {string} req.query.date The date to retrieve data for, in YYYY-MM-DD format
   * @param {Object} res HTTP response object
   * @return {Object} JSON response with two properties: currentData and previousData
   * @property {Array} currentData Array of objects with temperature and timestamp
   * @property {Array} previousData Array of objects with temperature and timestamp
   */
  async getDefrostAnalysisData(req, res) {
    const { channelId, date } = req.query;

    try {
      // Fecha seleccionada
      const startOfDay = moment(date)
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      const endOfDay = moment(date).endOf("day").format("YYYY-MM-DD HH:mm:ss");

      // Fecha del domingo anterior
      const startOfPreviousDay = moment(date)
        .subtract(7, "days")
        .startOf("day")
        .format("YYYY-MM-DD HH:mm:ss");
      const endOfPreviousDay = moment(date)
        .subtract(7, "days")
        .endOf("day")
        .format("YYYY-MM-DD HH:mm:ss");

      const query = `
      (SELECT 
        external_temperature as temperature,
        external_temperature_timestamp as timestamp,
        'current' as period
      FROM sensor_readings_ubibot 
      WHERE channel_id = ? 
      AND external_temperature_timestamp BETWEEN ? AND ?)
      UNION ALL
      (SELECT 
        external_temperature as temperature,
        external_temperature_timestamp as timestamp,
        'previous' as period
      FROM sensor_readings_ubibot 
      WHERE channel_id = ? 
      AND external_temperature_timestamp BETWEEN ? AND ?)
      ORDER BY timestamp ASC
    `;

      const [results] = await pool.query(query, [
        channelId,
        startOfDay,
        endOfDay,
        channelId,
        startOfPreviousDay,
        endOfPreviousDay,
      ]);

      if (results.length === 0) {
        return res
          .status(404)
          .json({ message: "No data found for selected dates" });
      }

      // Separar los datos por período
      const currentData = results.filter((r) => r.period === "current");
      const previousData = results.filter((r) => r.period === "previous");

      res.json({
        currentData,
        previousData,
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Server Error" });
    }
  }

  /**
   * Retrieves temperature data for cameras on a specified date.
   * Fetches temperature readings from the database, groups them by channel,
   * sorts them by timestamp, and orders the channels for display based on their names.
   *
   * @param {import("express").Request} req - HTTP request object
   * @param {import("express").Response} res - HTTP response object
   *
   * @throws Will return a 400 error if the date is not provided in the request.
   * @throws Will return a 500 error if there is an issue fetching data from the database.
   */

  async getTemperatureCamarasData(req, res) {
    try {
      const { date } = req.query;
      console.log("Received request for date:", date);

      if (!date) {
        return res.status(400).json({ error: "Se requiere una fecha" });
      }

      // Crear el rango de fechas en hora de Santiago sin conversiones adicionales
      // Ya que los datos en la BD están en esa zona horaria
      const start = `${date} 00:00:00`;
      const end = `${date} 23:59:59`;

      console.log("Querying from:", start, "to:", end);
      console.log("Start:", start, "End:", end);

      const query = `
        SELECT sr.id, sr.channel_id, sr.external_temperature, sr.external_temperature_timestamp, c.name
        FROM sensor_readings_ubibot sr
        JOIN channels_ubibot c ON sr.channel_id = c.channel_id
        WHERE sr.external_temperature_timestamp BETWEEN ? AND ?
        ORDER BY sr.external_temperature_timestamp ASC
      `;

      const [rows] = await pool.query(query, [start, end]);
      console.log("Query returned", rows.length, "rows");

      // Agrupar los datos por canal manteniendo los timestamps originales
      const groupedData = rows.reduce((acc, row) => {
        if (!acc[row.channel_id]) {
          acc[row.channel_id] = {
            id: row.id,
            channel_id: row.channel_id,
            name: row.name,
            data: [],
          };
        }

        acc[row.channel_id].data.push({
          id: row.id,
          timestamp: row.external_temperature_timestamp,
          external_temperature: parseFloat(row.external_temperature),
        });

        return acc;
      }, {});

      // Ordenar los datos dentro de cada canal por timestamp
      Object.values(groupedData).forEach((channel) => {
        channel.data.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeA - timeB;
        });
      });

      // Función para determinar el orden de visualización
      const getOrderIndex = (name) => {
        if (name.startsWith("Camara")) {
          return parseInt(name.split(" ")[1]);
        } else if (name.startsWith("Reefer")) {
          const letter = name.split(" ")[1];
          return 6 + letter.charCodeAt(0) - "A".charCodeAt(0);
        }
        return Infinity;
      };

      // Ordenar los canales según la lógica establecida
      const sortedData = Object.values(groupedData).sort((a, b) => {
        return getOrderIndex(a.name) - getOrderIndex(b.name);
      });

      // Log de los datos procesados para debugging
      console.log(
        "Processed data:",
        sortedData.map((d) => ({
          id: d.id,
          channel_id: d.channel_id,
          name: d.name,
          dataPoints: d.data.length,
        }))
      );

      res.json(sortedData);
    } catch (error) {
      console.error("Error fetching temperature data:", error);
      res.status(500).json({ error: "Error del servidor" });
    }
  }
  /**
   * Retrieves temperature data for a specified camera and date range for weekly defrost analysis.
   * Fetches temperature readings from the database, groups them by channel and period (current or previous),
   * sorts them by timestamp, and orders the channels for display based on their names.
   * Returns an object with current and previous data points for the selected channel
   * and the periods for each.
   *
   * @param {import("express").Request} req - HTTP request object
   * @param {import("express").Response} res - HTTP response object
   *
   * @throws Will return a 500 error if there is an issue fetching data from the database.
   */
  async getWeeklyDefrostAnalysisData(req, res) {
    const { channelId, date } = req.query;

    // Calcular fechas para la semana actual
    const endDate = moment(date);
    const startDate = moment(date).subtract(6, "days").startOf("day");
    const endCurrentWeek = moment(date).endOf("day"); // Fixed log

    // Calcular fechas para la semana anterior
    const prevEndDate = moment(date).subtract(7, "days");
    const prevStartDate = moment(date).subtract(13, "days").startOf("day");

    // Log the dates before querying the database
    console.log("API /api/weekly-defrost-analysis-data - Dates:");
    console.log("  Selected Date:", endDate.format("YYYY-MM-DD HH:mm:ss"));
    console.log(
      "  Current Week Start:",
      startDate.format("YYYY-MM-DD HH:mm:ss")
    );
    console.log(
      "  Current Week End:",
      endCurrentWeek.format("YYYY-MM-DD HH:mm:ss")
    ); // Fixed log
    console.log(
      "  Previous Week Start:",
      prevStartDate.format("YYYY-MM-DD HH:mm:ss")
    );
    console.log(
      "  Previous Week End:",
      prevEndDate.format("YYYY-MM-DD HH:mm:ss")
    );

    try {
      const query = `
        (SELECT 
          external_temperature as temperature,
          external_temperature_timestamp as timestamp,
          'current' as period
        FROM sensor_readings_ubibot 
        WHERE channel_id = ? 
        AND external_temperature_timestamp BETWEEN ? AND ?)
        UNION ALL
        (SELECT 
          external_temperature as temperature,
          external_temperature_timestamp as timestamp,
          'previous' as period
        FROM sensor_readings_ubibot 
        WHERE channel_id = ? 
        AND external_temperature_timestamp BETWEEN ? AND ?)
        ORDER BY timestamp ASC
      `;

      const [results] = await pool.query(query, [
        channelId,
        startDate.format("YYYY-MM-DD HH:mm:ss"),
        endCurrentWeek.format("YYYY-MM-DD HH:mm:ss"),
        channelId,
        prevStartDate.format("YYYY-MM-DD HH:mm:ss"),
        prevEndDate.format("YYYY-MM-DD HH:mm:ss"),
      ]);

      const currentData = results.filter((r) => r.period === "current");
      const previousData = results.filter((r) => r.period === "previous");
      // Log the number of records returned
      console.log("API /api/weekly-defrost-analysis-data - Results:");
      console.log("  Current Data Length:", currentData.length);
      console.log("  Previous Data Length:", previousData.length);
      if (currentData && currentData.length > 0) {
        console.log("First current record:", currentData[0].timestamp);
        console.log(
          "Last current record:",
          currentData[currentData.length - 1].timestamp
        );
      }
      if (previousData && previousData.length > 0) {
        console.log("First previous record:", previousData[0].timestamp);
        console.log(
          "Last previous record:",
          previousData[previousData.length - 1].timestamp
        );
      }

      res.json({
        currentData,
        previousData,
        periods: {
          current: {
            start: startDate.format("YYYY-MM-DD"),
            end: endDate.format("YYYY-MM-DD"),
          },
          previous: {
            start: prevStartDate.format("YYYY-MM-DD"),
            end: prevEndDate.format("YYYY-MM-DD"),
          },
        },
      });
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "Server Error" });
    }
  }

  async getTemperatureDashboardData(req, res) {
    try {
      const query = `
          SELECT c.channel_id, c.name, s.external_temperature, s.external_temperature_timestamp
          FROM channels_ubibot c
          JOIN (
            SELECT channel_id, external_temperature, external_temperature_timestamp,
                   ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY external_temperature_timestamp DESC) as rn
            FROM sensor_readings_ubibot
          ) s ON c.channel_id = s.channel_id
          WHERE s.rn = 1 order by name
        `;
      const [results] = await pool.query(query);

      const processedResults = results.map((item) => ({
        ...item,
        external_temperature:
          item.external_temperature != null
            ? parseFloat(item.external_temperature)
            : null,
        external_temperature_timestamp: item.external_temperature_timestamp, // Enviamos el timestamp sin modificar
      }));

      res.json(processedResults);
    } catch (error) {
      console.error("Error fetching temperature dashboard data:", error);
      res.status(500).send("Server Error");
    }
  }

  /**
   * Returns the status of the Ubibot process.
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   * @returns {Promise<void>}
   */
  async getUbibotStatus(req, res) {
    res.json({ status: "Ubibot process running", lastExecution: new Date() });
  }
}

module.exports = new ubibotController();

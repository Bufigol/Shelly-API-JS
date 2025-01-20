// src/controllers/ubibot-controller.js

const moment = require("moment");
const axios = require("axios");
const fs = require("fs").promises;
const config = require("../config/js_files/config-loader");
const databaseService = require("../services/database-service");
const WeeklyTemperatureAnalyzer = require("../utils/WeeklyTemperatureAnalyzer");
const temperatureAnalyzer = require("../utils/TemperatureAnalyzer");

class UbibotController {
  /**
   * Initializes a new instance of the UbibotController class.
   * Retrieves and sets the account key and token file path from the configuration.
   */

  constructor() {
    const { ubibot: ubibotConfig } = config.getConfig();
    this.accountKey = ubibotConfig.accountKey;
    this.tokenFile = ubibotConfig.tokenFile;
  }

  /**
   * Requests a new access token from the Ubibot API using the configured account key.
   * Writes the token to the specified token file if successful.
   *
   * @returns {Promise<string|null>} The token ID if successful, or null if an error occurs.
   *
   * @throws {Error} If the token generation fails due to an invalid account key.
   */

  async getNewToken() {
    try {
      const response = await axios.get(
        "https://webapi.ubibot.com/accounts/generate_access_token",
        {
          params: { account_key: this.accountKey },
        }
      );

      if (response.data.result === "success") {
        const tokenId = response.data.token_id;
        await fs.writeFile(this.tokenFile, tokenId);
        console.log("Ubibot: Token generado y guardado con éxito.");
        return tokenId;
      } else {
        throw new Error(
          "Ubibot: Error al generar el token, verifique su account_key."
        );
      }
    } catch (error) {
      console.error("Ubibot: Error al obtener el token:", error.message);
      return null;
    }
  }

  /**
   * Reads the access token from the specified token file.
   *
   * @returns {Promise<string|null>} The token as a string if read successfully, or null if an error occurs.
   *
   * @throws {Error} Logs an error message if the token file cannot be read.
   */

  async readToken() {
    try {
      return await fs.readFile(this.tokenFile, "utf8");
    } catch (error) {
      console.error("Ubibot: Error al leer el token:", error.message);
      return null;
    }
  }

  /**
   * Validates the given token ID by making a request to the Ubibot API.
   *
   * @param {string} tokenId - The token ID to be validated.
   * @returns {Promise<boolean>} True if the token is valid, false otherwise.
   *
   * @throws {Error} Logs an error message if the token validation fails due to a network or API error.
   */

  async isTokenValid(tokenId) {
    try {
      const response = await axios.get(`https://webapi.ubibot.com/channels`, {
        params: { token_id: tokenId },
      });
      return response.data.result === "success";
    } catch (error) {
      console.error("Ubibot: Error al validar el token:", error.message);
      return false;
    }
  }

  /**
   * Retrieves the list of Ubibot channels, excluding any channels specified in
   * the configuration file.
   *
   * @returns {Promise<Array<Object>>} An array of channel objects if the request
   * is successful, or an empty array if not.
   *
   * @throws {Error} Logs an error message if the request fails due to a network or
   * API error.
   */
  async getChannels() {
    let tokenId = await this.readToken();

    if (!tokenId || !(await this.isTokenValid(tokenId))) {
      tokenId = await this.getNewToken();
    }

    if (tokenId) {
      try {
        const response = await axios.get("https://webapi.ubibot.com/channels", {
          params: { token_id: tokenId },
        });

        if (response.data.result === "success") {
          const excludedChannels =
            config.getConfig().ubibot.excludedChannels || [];
          return response.data.channels.filter(
            (channel) => !excludedChannels.includes(channel.channel_id)
          );
        } else {
          throw new Error("Ubibot: Error al obtener los canales.");
        }
      } catch (error) {
        console.error("Ubibot: Error al obtener los canales:", error.message);
        return [];
      }
    }
  }

  /**
   * Retrieves the data of a specific Ubibot channel, given its ID.
   *
   * @param {number} channelId - The ID of the channel to retrieve.
   * @returns {Promise<Object>} The channel data object if the request is
   * successful, or null if not.
   *
   * @throws {Error} Logs an error message if the request fails due to a network
   * or API error.
   */
  async getChannelData(channelId) {
    let tokenId = await this.readToken();

    if (!tokenId || !(await this.isTokenValid(tokenId))) {
      tokenId = await this.getNewToken();
    }

    if (tokenId) {
      try {
        const response = await axios.get(
          `https://webapi.ubibot.com/channels/${channelId}`,
          {
            params: { token_id: tokenId },
          }
        );
        if (response.data && response.data.result === "success") {
          return response.data.channel;
        } else {
          throw new Error(
            `Ubibot: Error al obtener datos del canal ${channelId}.`
          );
        }
      } catch (error) {
        console.error(
          `Ubibot: Error al obtener datos del canal ${channelId}:`,
          error.message
        );
        return null;
      }
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
      const [results] = await databaseService.pool.query(query);

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

      const [rows] = await databaseService.pool.query(query, [start, end]);
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
  async getTemperatureDevices(req, res) {
    try {
      const [devices] = await databaseService.pool.query(
        "SELECT channel_id, name FROM channels_ubibot"
      );
      res.json(devices);
    } catch (error) {
      console.error(
        "Ubibot: Error al obtener datos de los dispositivos de temperatura:",
        error.message
      );
      res.status(500).send("Server Error");
    }
  }

  async getTemperatureRangeData(req, res) {
    try {
      const { startDate, endDate, deviceId } = req.query;
      if (!startDate || !endDate || !deviceId) {
        return res
          .status(400)
          .json({ error: "Faltan datos (startDate, endDate, deviceId)" });
      }
      const start = `${startDate} 00:00:00`;
      const end = `${endDate} 23:59:59`;

      const query = `
         SELECT sr.channel_id, sr.external_temperature, sr.external_temperature_timestamp
         FROM sensor_readings_ubibot sr
         WHERE sr.channel_id = ?
         AND sr.external_temperature_timestamp BETWEEN ? AND ?
       `;

      const [rows] = await databaseService.pool.query(query, [
        deviceId,
        start,
        end,
      ]);

      const data = rows.map((item) => ({
        timestamp: item.external_temperature_timestamp,
        external_temperature: parseFloat(item.external_temperature),
      }));

      res.json(data || []);
    } catch (error) {
      console.error(
        "Ubibot: Error al obtener datos de rango de temperatura:",
        error.message
      );
      res.status(500).json({ error: "Error del servidor" });
    }
  }

  async getChannelStatus(req, res) {
    try {
      const [results] = await databaseService.pool.query(
        "SELECT channel_id, name, esOperativa FROM channels_ubibot"
      );
      res.json(results);
    } catch (error) {
      console.error("Error fetching channel status:", error);
      res.status(500).send("Server Error");
    }
  }

  // Dentro de la clase UbibotController en ubibotController.js
  async handleUpdateChannelStatus(req, res) {
    try {
      const { channelId, esOperativa } = req.body;
      await databaseService.pool.query(
        "UPDATE channels_ubibot SET esOperativa = ? WHERE channel_id = ?",
        [esOperativa, channelId]
      );
      res.sendStatus(200);
    } catch (error) {
      console.error(
        "Ubibot: Error al actualizar el estado del canal:",
        error.message
      );
      res.status(500).send("Server Error");
    }
  }

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

      const [results] = await databaseService.pool.query(query, [
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

      const [results] = await databaseService.pool.query(query, [
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
  /**
   * Genera un reporte de descongelamiento para la cámara especificada en
   * el cuerpo de la solicitud y la fecha especificada.
   *
   * @param {Object} req - La solicitud que contiene los parámetros
   *                        channelId y date.
   * @param {Object} res - La respuesta que se devuelve al cliente.
   */
  async handleGenerateDefrostReport(req, res) {
    try {
      const { channelId, date } = req.body;

      // Get camera name
      const [cameraInfo] = await databaseService.pool.query(
        "SELECT name FROM channels_ubibot WHERE channel_id = ?",
        [channelId]
      );
      const cameraName = cameraInfo[0]?.name || "Unknown";

      // Get data for current date and 7 days before
      const selectedDate = moment(date);
      const previousDate = moment(date).subtract(7, "days");

      // Get current and previous data
      const { results: currentData } = await this.getDefrostData(
        channelId,
        selectedDate.format("YYYY-MM-DD"),
        cameraName
      );

      const { results: previousData, fileName } = await this.getDefrostData(
        channelId,
        previousDate.format("YYYY-MM-DD"),
        cameraName
      );

      if (!currentData || currentData.length === 0) {
        return res.status(400).json({
          error: "No hay datos disponibles para esta fecha",
        });
      }

      const TemperatureAnalyzer = require("../utils/TemperatureAnalyzer");
      const analyzer = new TemperatureAnalyzer();

      // Process the data
      await analyzer.analyzeData(currentData, previousData, cameraName, date);

      // Generate PDF
      const pdfBuffer = await analyzer.generatePDF(cameraName, date);

      // Send response
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

  async handleGenerateWeeklyDefrostReport(req, res) {
    const { channelId, date } = req.body;

    try {
      const [cameraInfo] = await databaseService.pool.query(
        "SELECT name FROM channels_ubibot WHERE channel_id = ?",
        [channelId]
      );
      const cameraName = cameraInfo[0]?.name || "Unknown";

      // Obtener fechas para la semana actual y anterior
      const selectedDate = moment(date);
      const startOfCurrentWeek = moment(date).subtract(6, "days");
      const endOfCurrentWeek = moment(date).endOf("day"); // Fixed log
      const startOfPreviousWeek = moment(date).subtract(13, "days");
      const endOfPreviousWeek = moment(date).subtract(7, "days").endOf("day"); // Fixed log

      // Log the dates before querying the database
      console.log("API /api/generate-weekly-defrost-report - Dates:");
      console.log(
        "  Selected Date:",
        selectedDate.format("YYYY-MM-DD HH:mm:ss")
      );
      console.log(
        "  Current Week Start:",
        startOfCurrentWeek.format("YYYY-MM-DD HH:mm:ss")
      );
      console.log(
        "  Current Week End:",
        endOfCurrentWeek.format("YYYY-MM-DD HH:mm:ss")
      );
      console.log(
        "  Previous Week Start:",
        startOfPreviousWeek.format("YYYY-MM-DD HH:mm:ss")
      );
      console.log(
        "   Previous Week End:",
        endOfPreviousWeek.format("YYYY-MM-DD HH:mm:ss")
      ); // Fixed log

      // Obtener datos de temperatura para ambas semanas
      const query = `
      SELECT 
        external_temperature as temperature,
        external_temperature_timestamp as timestamp
      FROM sensor_readings_ubibot 
      WHERE channel_id = ? 
      AND external_temperature_timestamp >= ? AND external_temperature_timestamp <= ?
      ORDER BY external_temperature_timestamp ASC
    `;

      const [currentWeekData] = await databaseService.pool.query(query, [
        channelId,
        startOfCurrentWeek.format("YYYY-MM-DD HH:mm:ss"),
        endOfCurrentWeek.format("YYYY-MM-DD HH:mm:ss"), // Fixed log
      ]);

      const [previousWeekData] = await databaseService.pool.query(query, [
        channelId,
        startOfPreviousWeek.format("YYYY-MM-DD HH:mm:ss"),
        endOfPreviousWeek.format("YYYY-MM-DD HH:mm:ss"), // Fixed log
      ]);

      if (!currentWeekData || currentWeekData.length === 0) {
        return res.status(400).json({
          error: "No hay datos disponibles para esta semana",
        });
      }

      // Crear una instancia del analizador semanalmperatureAnalyzer');
      const analyzer = new WeeklyTemperatureAnalyzer();

      console.log(
        "API /api/generate-weekly-defrost-report - Passing data to WeeklyTemperatureAnalyzer:"
      );
      console.log("  Current Week Data Length:", currentWeekData.length);
      console.log("  Previous Week Data Length:", previousWeekData.length);
      // Log the first and last record to verify date ranges
      if (currentWeekData && currentWeekData.length > 0) {
        console.log("  First current record:", currentWeekData[0].timestamp);
        console.log(
          "  Last current record:",
          currentWeekData[currentWeekData.length - 1].timestamp
        );
      }
      if (previousWeekData && previousWeekData.length > 0) {
        console.log("  First previous record:", previousWeekData[0].timestamp);
        console.log(
          "  Last previous record:",
          previousWeekData[previousWeekData.length - 1].timestamp
        );
      }
      // Procesar los datos para ambas semanas
      await analyzer.analyzeData(
        currentWeekData,
        previousWeekData,
        cameraName,
        date
      );

      // Generar el PDF
      const pdfBuffer = await analyzer.generatePDF(cameraName, date);

      // Crear nombre del archivo
      const sanitizedCameraName = cameraName.replace(/\s+/g, "_").trim();
      const fileName = `Weekly_Temperature_Analysis_${sanitizedCameraName}_${moment(
        date
      ).format("DD-MM-YYYY")}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating weekly report:", error);
      res.status(500).json({
        error: "Error generando el informe semanal",
        details: error.message,
      });
    }
  }

  async getDefrostData(channelId, date, cameraName) {
    const startOfDay = moment(date)
      .startOf("day")
      .format("YYYY-MM-DD HH:mm:ss");
    const endOfDay = moment(date).endOf("day").format("YYYY-MM-DD HH:mm:ss");
    const formattedDate = moment(date).format("DD-MM-YYYY");

    // Create filename
    const sanitizedCameraName = cameraName.replace(/\s+/g, "_").trim();
    const fileName = `Defrost_Analysis_${sanitizedCameraName}_${formattedDate}.pdf`;

    const query = `
      SELECT 
        external_temperature as temperature,
        external_temperature_timestamp as timestamp
      FROM sensor_readings_ubibot 
      WHERE channel_id = ? 
      AND external_temperature_timestamp BETWEEN ? AND ?
      ORDER BY external_temperature_timestamp ASC
    `;

    const [results] = await databaseService.pool.query(query, [
      channelId,
      startOfDay,
      endOfDay,
    ]);
    return { results, fileName };
  }
}
module.exports = new UbibotController();

/* controllers/gpsController.js */
const moment = require('moment');
const { pool } = require("../services/database-service.js");

class gpsController {
  async getHistoricalGpsData(req, res) {
    const { device_id, date, startHour, endHour } = req.query;

    // Construct the datetime range
    const startDateTime = moment(
      `${date} ${startHour}:00`,
      "YYYY-MM-DD HH:mm:ss"
    ).unix();
    const endDateTime = moment(
      `${date} ${endHour}:59`,
      "YYYY-MM-DD HH:mm:ss"
    ).unix();

    console.log(
      `Received request with device_id: ${device_id}, date: ${date}, startHour: ${startHour}, endHour: ${endHour}`
    );
    console.log(
      `Constructed datetime range: ${startDateTime} to ${endDateTime}`
    );

    try {
      const query = `
      SELECT latitude, longitude, timestamp
      FROM gps_data
      WHERE device_name = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `;
      const [results] = await pool.query(query, [
        device_id,
        startDateTime,
        endDateTime,
      ]);

      console.log(`Query results: ${JSON.stringify(results)}`);
      if (results.length === 0) {
        console.log(
          `No data found for device_id: ${device_id} between ${startDateTime} and ${endDateTime}`
        );
      }

      res.json(results);
    } catch (error) {
      console.error("Error fetching historical GPS data:", error);
      res.status(500).send("Server Error");
    }
  }

  async getLastKnownPosition(req, res) {
    // Extract ident from query parameters
    const { ident } = req.query;

    try {
      // Check if ident is provided
      if (!ident) {
        console.log("Error: ident is required");
        return res.status(400).send("ident is required");
      }

      // Log the received ident for debugging purposes
      console.log("Received ident:", ident);

      // Query to get the last known position of the device
      const [lastKnownPosition] = await pool.query(
        `
      SELECT ident, latitude, longitude, timestamp * 1000 AS unixTimestamp
      FROM gps_data
      WHERE ident = ? AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 1
    `,
        [ident]
      );

      // Check if any data is available for the given ident
      if (lastKnownPosition.length === 0) {
        console.log("Error: No data available for ident:", ident);
        return res.status(404).send("No data available");
      }

      // Log the last known position for debugging purposes
      console.log("Last known position:", lastKnownPosition);

      /* Query to get the last coordinate change of the device
    const [lastCoordinateChange] = await pool.query(`
      SELECT timestamp * 1000 AS changeTimestamp
      FROM gps_data
      WHERE (latitude != ? OR longitude != ?) AND ident = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [
      lastKnownPosition[0].latitude || defaultPosition.lat, 
      lastKnownPosition[0].longitude || defaultPosition.lng, 
      ident
    ]);

    // Log the last coordinate change for debugging purposes
    console.log('Last coordinate change:', lastCoordinateChange);*/

      // Construct the response object
      const response = {
        ...lastKnownPosition[0],
        //,
        //changeTimestamp: lastCoordinateChange.length > 0 ? lastCoordinateChange[0].changeTimestamp : null
      };

      // Set default coordinates if latitude or longitude is null
      response.latitude =
        response.latitude !== null ? response.latitude : defaultPosition.lat;
      response.longitude =
        response.longitude !== null ? response.longitude : defaultPosition.lng;

      // Log the response object for debugging purposes
      console.log("Response:", response);

      // Send the response as JSON
      res.json(response);
    } catch (error) {
      // Log any errors that occur during the query execution
      console.error("Error fetching last known position:", error);
      // Send a 500 Internal Server Error response if an error occurs
      res.status(500).send("Server Error");
    }
  }

  async getLatestGpsData(req, res) {
    const { device_name, startTime, endTime } = req.query;

    console.log(
      `Buscando datos para ${device_name} entre ${startTime} y ${endTime}`
    );

    try {
      const query = `
      SELECT latitude, longitude, timestamp, ble_beacons, event_enum
      FROM gps_data
      WHERE device_name = ? AND timestamp BETWEEN ? AND ?
      ORDER BY timestamp DESC
      LIMIT 1
    `;
      const [results] = await pool.query(query, [
        device_name,
        startTime,
        endTime,
      ]);

      console.log(`Resultados para ${device_name}:`, results);

      res.json({ data: results });
    } catch (error) {
      console.error("Error fetching latest GPS data:", error);
      res.status(500).send("Server Error");
    }
  }

  async getGpsData(req, res) {
    const { startDate, endDate, device_name } = req.query;

    // Agregar logs para verificar los valores de los parámetros recibidos
    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);
    console.log("Device Name:", device_name);

    const query = `
      SELECT device_id, latitude, longitude, timestamp AS unixTimestamp
      FROM gps_data
      WHERE timestamp BETWEEN ? AND ? AND device_name = ?
  `;

    const params = [parseInt(startDate), parseInt(endDate), device_name];

    try {
      const [results] = await pool.query(query, params);

      // Agregar logs para verificar los resultados de la consulta
      if (results.length === 0) {
        console.log(
          `No data found for device_name: ${device_name} between ${startDate} and ${endDate}`
        );
        return res.json({ data: [], message: "No data found" });
      }

      console.log("Query Results:", results);

      res.json({ data: results, message: "Data found" });
    } catch (error) {
      console.error("Error fetching GPS data:", error);
      res.status(500).send("Server Error");
    }
  }

  async getPreviousValidPosition(req, res) {
    const { ident, timestamp } = req.query;

    try {
      // Query to get the previous valid position
      const [previousValidPosition] = await pool.query(
        `
      SELECT ident, latitude, longitude, timestamp * 1000 AS unixTimestamp
      FROM gps_data
      WHERE ident = ? AND timestamp < ? AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT 1
    `,
        [ident, timestamp / 1000]
      );

      if (previousValidPosition.length === 0) {
        return res.status(404).send("No previous valid position found");
      }

      res.json(previousValidPosition[0]);
    } catch (error) {
      console.error("Error fetching previous valid position:", error);
      res.status(500).send("Server Error");
    }
  }
}
module.exports = new gpsController();

class beaconsController {
  async getDoorStatus(req, res) {
    if (!startDate || !endDate) {
      return res.status(400).send("startDate and endDate are required");
    }

    try {
      const query = `
      SELECT ds.sector, ds.magnet_status, ds.temperature, ds.timestamp
      FROM door_status ds
      JOIN beacons b ON ds.sector = b.ubicacion
      WHERE ds.timestamp BETWEEN ? AND ? AND b.esPuerta = 1
      ORDER BY ds.timestamp ASC
    `;
      const [rows] = await pool.query(query, [startDate, endDate]);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching door status:", error);
      res.status(500).send("Server Error");
    }
  }

  async getBeaconEntriesExits(req, res) {
    const { startDate, endDate, device_id } = req.query;

    // Determinar la tabla a utilizar basado en el device_id
    let tableName;
    switch (device_id) {
      case "865413057599200":
        tableName = "FMC920_865413057599200";
        break;
      case "352592573522828":
        tableName = "gh_5200_data_352592573522828";
        break;
      case "869671071061129":
        tableName = "TAT240_869671071061129";
        break;
      default:
        return res.status(400).send("Invalid device_id");
    }

    const startTimestamp = new Date(startDate).getTime() / 1000;
    const endTimestamp = new Date(endDate).getTime() / 1000;

    const query = `
      SELECT timestamp, beacon_id
      FROM ${tableName}
      WHERE timestamp BETWEEN ? AND ? AND beacon_id IS NOT NULL AND beacon_id != 'no encontrado: NULL'
      ORDER BY timestamp ASC
  `;

    try {
      const [results] = await pool.query(query, [startTimestamp, endTimestamp]);
      const processedResults = [];
      let currentBeacon = null;
      let entryTimestamp = null;

      results.forEach((record) => {
        const beacon = { id: record.beacon_id };
        if (beacon.id) {
          if (currentBeacon === null || beacon.id !== currentBeacon.id) {
            if (currentBeacon !== null) {
              processedResults.push({
                beaconId: currentBeacon.id,
                sector: getSector(currentBeacon.id),
                entrada: entryTimestamp,
                salida: record.timestamp * 1000,
                tiempoPermanencia: record.timestamp * 1000 - entryTimestamp,
              });
            }
            currentBeacon = beacon;
            entryTimestamp = record.timestamp * 1000;
          }
        }
      });

      if (currentBeacon !== null) {
        processedResults.push({
          beaconId: currentBeacon.id,
          sector: getSector(currentBeacon.id),
          entrada: entryTimestamp,
          salida: null,
          tiempoPermanencia: "En progreso",
        });
      }

      res.json(processedResults);
    } catch (error) {
      console.error("Error fetching beacon entries and exits:", error);
      res.status(500).send("Server Error");
    }
  }

  async getAllBeacons(req, res) {
    try {
      // Ejecutar una consulta SQL para seleccionar todos los registros de la tabla 'beacons'
      const [rows] = await pool.query(
        "SELECT * FROM beacons WHERE esTemperatura = 0"
      );

      // Enviar los resultados de la consulta como una respuesta JSON
      res.json(rows);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching beacons:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error en formato JSON
      res.status(500).json({ error: "Error fetching beacons" });
    }
  }

  async getBeaconDetectionStatus(req, res) {
    // Extraer startDate y endDate de los parámetros de la solicitud
    const { startDate, endDate } = req.query;

    // Validar que startDate y endDate estén presentes
    if (!startDate || !endDate) {
      return res.status(400).send("startDate and endDate are required");
    }

    try {
      // Definir la consulta SQL para seleccionar registros de la tabla beacons_detection_status
      // La consulta filtra los registros cuyo status_timestamp esté entre startDate y endDate
      const query = `
      SELECT *
      FROM beacons_detection_status
      WHERE status_timestamp BETWEEN ? AND ?
    `;

      // Ejecutar la consulta SQL con los parámetros startDate y endDate
      const [rows] = await pool.query(query, [startDate, endDate]);

      // Enviar los resultados de la consulta como una respuesta JSON
      res.json(rows);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching beacons detection status:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error en formato JSON
      res
        .status(500)
        .json({ error: "Error fetching beacons detection status" });
    }
  }

  /**
   * Retrieves the latest beacon sectors for each device and returns them in a JSON response.
   *
   * This function queries the database for devices, and for each device, it determines the appropriate
   * table to fetch the latest beacon data. It processes the results to calculate the time since the latest
   * detection and formats the data for the response. The function also logs detailed information for debugging purposes.
   *
   * @param {Object} req - The request object, containing query parameters.
   * @param {Object} res - The response object, used to send the JSON response.
   *
   * @returns {void} Sends a JSON response with the latest sectors and server time.
   *
   * Logs:
   * - Current time and start of the day
   * - Processing details for each device
   * - Query results and time calculations
   * - Final data to be sent
   *
   * Errors:
   * - Logs and handles errors during database queries.
   * - Sends a 500 status code with "Server Error" in case of error.
   */

  async getLatestSectors(req, res) {
    try {
      const [devices] = await pool.query(
        "SELECT id, device_asignado FROM devices"
      );
      const latestSectors = [];
      const now = moment().tz("America/Santiago");
      const startOfDay = now.clone().startOf("day").unix();

      console.log(`Tiempo actual: ${now.format("YYYY-MM-DD HH:mm:ss")}`);
      console.log(
        `Inicio del día: ${moment
          .unix(startOfDay)
          .format("YYYY-MM-DD HH:mm:ss")}`
      );

      for (const device of devices) {
        console.log(`\nProcesando dispositivo: ${device.id}`);

        let tableName;
        switch (device.id) {
          case "865413057599200":
            tableName = "FMC920_865413057599200";
            break;
          case "352592573522828":
            tableName = "gh_5200_data_352592573522828";
            break;
          default:
            console.log(
              `No se encontró una tabla para el dispositivo ${device.id}`
            );
            continue;
        }

        const query = `
            SELECT beacon_id, timestamp
            FROM ${tableName}
            WHERE timestamp >= ? AND beacon_id IS NOT NULL AND beacon_id != 'no encontrado: NULL'
            ORDER BY timestamp DESC
          `;

        try {
          const [results] = await pool.query(query, [startOfDay]);
          console.log(`Resultados obtenidos: ${results.length}`);

          if (results.length > 0) {
            let latestBeaconId = results[0].beacon_id;
            let latestTimestamp = results[0].timestamp;
            let oldestTimestamp = results[0].timestamp;

            for (let i = 1; i < results.length; i++) {
              if (results[i].beacon_id !== latestBeaconId) {
                oldestTimestamp = results[i - 1].timestamp;
                break;
              }
              oldestTimestamp = results[i].timestamp;
            }

            const [sector] = await pool.query(
              "SELECT nombre FROM sectores WHERE id = ?",
              [latestBeaconId]
            );
            const timeDiff = now.unix() - oldestTimestamp;
            const hours = Math.floor(timeDiff / 3600);
            const minutes = Math.floor((timeDiff % 3600) / 60);

            console.log(`Beacon más reciente: ${latestBeaconId}`);
            console.log(
              `Timestamp más reciente: ${moment
                .unix(latestTimestamp)
                .format("YYYY-MM-DD HH:mm:ss")}`
            );
            console.log(
              `Timestamp más antiguo del mismo beacon: ${moment
                .unix(oldestTimestamp)
                .format("YYYY-MM-DD HH:mm:ss")}`
            );
            console.log(
              `Tiempo transcurrido: ${hours} horas y ${minutes} minutos`
            );

            latestSectors.push({
              device_id: device.id,
              sector: sector.length > 0 ? sector[0].nombre : "Desconocido",
              timestamp: moment
                .unix(oldestTimestamp)
                .format("YYYY-MM-DD HH:mm:ss"),
              timeSinceDetection: `${hours
                .toString()
                .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`,
            });
          } else {
            console.log(
              `No se encontraron datos para el dispositivo ${device.id} en el día actual`
            );
            latestSectors.push({
              device_id: device.id,
              sector: "Sin datos para este día",
              timestamp: null,
              timeSinceDetection: "00:00",
            });
          }
        } catch (innerError) {
          console.error(
            `Error fetching data for device ${device.id}:`,
            innerError
          );
          latestSectors.push({
            device_id: device.id,
            sector: "Error al obtener datos",
            timestamp: null,
            timeSinceDetection: "00:00",
          });
        }
      }

      console.log("\nDatos finales a enviar:");
      console.log(JSON.stringify(latestSectors, null, 2));

      // Añadir el tiempo del servidor a la respuesta
      const serverTime = now.format("YYYY-MM-DD HH:mm:ss");

      res.json({
        sectors: latestSectors,
        serverTime: serverTime,
      });
    } catch (error) {
      console.error("Error fetching latest sectors:", error);
      res.status(500).send("Server Error");
    }
  }

  async getActiveBeacons(req, res) {
    try {
      // Query to get the latest record with non-empty ble_beacons from gps_data table
      const [latestRecord] = await pool.query(`
                SELECT ble_beacons FROM gps_data
                WHERE ble_beacons != '[]'
                ORDER BY timestamp DESC
                LIMIT 1
            `);

      // Check if the latest record exists and contains non-empty ble_beacons
      if (
        latestRecord.length &&
        latestRecord[0].ble_beacons &&
        latestRecord[0].ble_beacons !== "[]"
      ) {
        // Parse the ble_beacons JSON string to an array
        const beaconsData = JSON.parse(latestRecord[0].ble_beacons);
        // Extract the IDs of active beacons
        const activeBeaconIds = beaconsData.map((beacon) => beacon.id);
        // Send the active beacon IDs as a JSON response
        res.json({ activeBeaconIds });
      } else {
        // Log a message if no active beacons are found
        console.log("No active beacons found.");
        // Send an empty array as the response
        res.json({ activeBeaconIds: [] });
      }
    } catch (error) {
      // Log any errors that occur during the query execution
      console.error("Error fetching active beacons:", error);
      // Send a 500 Internal Server Error response if an error occurs
      res.status(500).send("Server Error");
    }
  }

  /**
   * Retrieves the timestamp of the oldest detection for a specified active beacon.
   *
   * This function processes a request to identify the oldest timestamp at which
   * a specified active beacon (identified by `activeBeaconId`) was last detected.
   * It queries the `gps_data` table for records where the `ble_beacons` field is
   * not empty and orders the results by timestamp in descending order. The function
   * iterates through the results to find the first occurrence of the beacon and
   * returns the timestamp of the record immediately after the last detection of
   * the beacon, indicating when the beacon was no longer detected.
   *
   * @param {Object} req - The Express request object, with `activeBeaconId` as a query parameter.
   * @param {Object} res - The Express response object used to send the JSON response or error status.
   *
   * @returns {void} Responds with a JSON object containing the timestamp of the oldest beacon detection,
   * or sends an appropriate error response if the `activeBeaconId` is missing or no matching records are found.
   */

  async getOldestActiveBeaconDetections(req, res) {
    try {
      // Extract activeBeaconId from query parameters
      const activeBeaconId = req.query.activeBeaconId;
      if (!activeBeaconId) {
        // If activeBeaconId is not provided, send a 400 Bad Request response
        return res.status(400).send("activeBeaconId is required");
      }

      // SQL query to select timestamp and ble_beacons from gps_data table
      // The query filters records where ble_beacons is not an empty array
      // The results are ordered by timestamp in descending order
      const query = `
                SELECT timestamp, ble_beacons
                FROM gps_data
                WHERE ble_beacons != '[]'
                ORDER BY timestamp DESC
            `;

      // Execute the SQL query
      const [results] = await pool.query(query);

      // Initialize variables to track the beacon detection
      let foundBeacon = false;
      let timestamp = null;

      // Iterate over each record in the query results
      for (let i = 0; i < results.length; i++) {
        const record = results[i];
        // Parse the ble_beacons JSON string to an array
        const beacons = JSON.parse(record.ble_beacons || "[]");

        // Check if the activeBeaconId is present in the current record's beacons
        if (beacons.some((beacon) => beacon.id === activeBeaconId)) {
          if (!foundBeacon) {
            // If the beacon is found for the first time, set foundBeacon to true
            foundBeacon = true;
          }
        } else if (foundBeacon) {
          // If the beacon was previously found but is not in the current record
          // Set the timestamp to the current record's timestamp and break the loop
          timestamp = record.timestamp * 1000;
          break;
        }
      }

      // If a timestamp was found, send it as a JSON response
      if (timestamp) {
        res.json({ [activeBeaconId]: { timestamp } });
      } else {
        // If no matching records were found, send a 404 Not Found response
        res.status(404).send("No matching records found");
      }
    } catch (error) {
      // Log any errors that occur during the query execution
      console.error("Error fetching oldest beacon detections:", error);
      // Send a 500 Internal Server Error response if an error occurs
      res.status(500).send("Server Error");
    }
  }

  
  /**
   * Retrieves temperature data for a specified date.
   *
   * This function processes a request to obtain temperature records from the 
   * `registro_temperaturas` table for a given date. It joins the temperature 
   * records with the `beacons` table to acquire location details and fetches 
   * minimum and maximum threshold values from the `parametrizaciones` table. 
   * The results are organized by `beacon_id` and include temperature 
   * measurements, timestamps, location, and threshold information.
   *
   * @param {Object} req - The Express request object, with `date` as a query parameter.
   * @param {Object} res - The Express response object used to send the JSON response or error status.
   *
   * @returns {void} Responds with a JSON array of temperature data objects 
   * organized by beacon, or sends an appropriate error response if the query fails.
   */

  async getTemperatureData(req, res) {
    try {
      const { date } = req.query;
      const query = `
          SELECT rt.beacon_id, rt.temperatura, rt.timestamp, b.lugar, b.ubicacion,
                 (SELECT minimo FROM parametrizaciones WHERE param_id = 6) AS minimo,
                 (SELECT maximo FROM parametrizaciones WHERE param_id = 6) AS maximo
          FROM registro_temperaturas rt
          JOIN beacons b ON rt.beacon_id = b.id
          WHERE DATE(rt.timestamp) = ?
          ORDER BY rt.timestamp ASC
        `;

      const [rows] = await pool.query(query, [date]);

      const data = rows.reduce((acc, row) => {
        if (!acc[row.beacon_id]) {
          acc[row.beacon_id] = {
            beacon_id: row.beacon_id,
            location: `Cámara de Frío: ${row.lugar || "Desconocido"}`,
            ubicacion: row.ubicacion || "Desconocido",
            temperatures: [],
            timestamps: [],
            minimo: row.minimo,
            maximo: row.maximo,
          };
        }
        acc[row.beacon_id].temperatures.push(row.temperatura);
        acc[row.beacon_id].timestamps.push(row.timestamp);
        return acc;
      }, {});

      res.json(Object.values(data));
    } catch (error) {
      console.error("Error fetching temperature data:", error);
      res.status(500).send("Server Error");
    }
  }
}

module.exports = new beaconsController();

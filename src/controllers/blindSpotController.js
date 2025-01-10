//controllers/blindSpotController.js
const databaseService = require("../services/database-service");
const { ValidationError } = require("../utils/errors");

class blindSpotController {
  /**
   * Maneja la consulta de intrusiones en la zona de blindspot para una fecha dada.
   * La fecha se proporciona como par metro de consulta "date" en el formato "YYYY-MM-DD".
   * La respuesta se devuelve en formato JSON y contiene los siguientes campos:
   *
   * - dispositivo (string): id del dispositivo que detect  la intrusi n
   * - mac_address (string): direcci n MAC del dispositivo que detect  la intrusi n
   * - timestamp (string): fecha y hora de la intrusi n en formato "YYYY-MM-DD HH:mm:ss"
   * - device_asignado (string): nombre del dispositivo asignado a la zona de blindspot
   * - ubicacion (string): ubicaci n de la zona de blindspot
   *
   * @param {import("express").Request} req
   * @param {import("express").Response} res
   */
  async handleBlindSpotIntrusions(req, res) {
    try {
      const { date } = req.query;

      // Convertir la fecha a la zona horaria de Chile
      const startOfDay = moment
        .tz(date, "YYYY-MM-DD", "America/Santiago")
        .startOf("day");
      const endOfDay = moment(startOfDay).endOf("day");

      const query = `
          SELECT hc.dispositivo, hc.mac_address, hc.timestamp,
                 d.device_asignado, b.ubicacion
          FROM historico_llamadas_blindspot hc
          LEFT JOIN devices d ON hc.dispositivo = d.id
          LEFT JOIN beacons b ON hc.mac_address = b.mac
          WHERE hc.timestamp BETWEEN ? AND ?
          ORDER BY hc.timestamp ASC
        `;

      const [rows] = await pool.query(query, [
        startOfDay.toDate(),
        endOfDay.toDate(),
      ]);

      // Convertir los timestamps a la zona horaria de Chile
      const formattedRows = rows.map((row) => ({
        ...row,
        timestamp: moment(row.timestamp)
          .tz("America/Santiago")
          .format("YYYY-MM-DD HH:mm:ss"),
      }));

      res.json(formattedRows);
    } catch (error) {
      console.error("Error fetching blind spot intrusions:", error);
      res.status(500).send("Server Error");
    }
  }
}

module.exports = new blindSpotController();

// controllers/sectoresController.js
const databaseService = require("../services/database-service");
const { ValidationError } = require("../utils/errors");

class sectoresController {
  async getAllSectores(req, res) {
    try {
      // Ejecutar una consulta SQL para seleccionar todos los registros de la tabla 'sectores'
      const [results] = await pool.query("SELECT * FROM sectores");

      // Enviar los resultados de la consulta como una respuesta JSON
      res.json(results);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching sectors:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }

  async getMapWithQuadrantsInformation(req, res) {
    try {
      // Obtener sectores
      const [sectors] = await pool.query("SELECT * FROM sectores");

      // Obtener configuración
      const [configuration] = await pool.query("SELECT * FROM configuracion");

      // Obtener umbrales
      const [thresholds] = await pool.query("SELECT * FROM configuracion");

      // Obtener dispositivos
      const [devices] = await pool.query("SELECT * FROM devices");

      // Obtener personal
      const [personal] = await pool.query("SELECT * FROM personal");

      // Construir el objeto de respuesta consolidada
      const combinedData = {
        sectors,
        configuration,
        thresholds,
        devices,
        personal, // Añadir los datos de personal aquí
      };

      // Enviar la respuesta consolidada como JSON
      res.json(combinedData);
    } catch (error) {
      console.error("Error fetching combined data:", error);
      res.status(500).send("Server Error");
    }
  }
}

module.exports = new sectoresController();

// src/controllers/sectoresController.js
const databaseService = require("../services/database-service");
const { ValidationError } = require("../utils/errors");

class sectoresController {
  /**
   * Retrieves all sectors from the database.
   *
   * This function executes a SQL query to select all records from the 'sectores' table.
   * It returns the results as a JSON response or sends a 500 error if something goes wrong.
   *
   * @param {Object} req - The Express request object.
   * @param {Object} res - The Express response object.
   * @returns {void} Sends a JSON response with all sectors or an error response.
   */
  async getAllSectores(req, res) {
    try {
      // Ejecutar una consulta SQL para seleccionar todos los registros de la tabla 'sectores'
      const [results] = await databaseService.pool.query(
        "SELECT * FROM sectores"
      );

      // Enviar los resultados de la consulta como una respuesta JSON
      res.json(results);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching sectors:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }

  /**
   * Retrieves combined data including sectors, configuration, thresholds, devices, and personal.
   *
   * This function fetches data from multiple tables (sectors, configuracion, devices, and personal)
   * using separate queries and combines the results into a single JSON response.
   *
   * @param {Object} req - The Express request object.
   * @param {Object} res - The Express response object.
   * @returns {void} Sends a JSON response with the combined data or an error response.
   */
  async getMapWithQuadrantsInformation(req, res) {
    try {
      // Obtener sectores
      const [sectors] = await databaseService.pool.query(
        "SELECT * FROM sectores"
      );

      // Obtener configuración
      const [configuration] = await databaseService.pool.query(
        "SELECT * FROM configuracion"
      );

      // Obtener umbrales, se utiliza la misma tabla que configuracion ya que no se ha dado una tabla nueva
      const [thresholds] = await databaseService.pool.query(
        "SELECT * FROM configuracion"
      );

      // Obtener dispositivos
      const [devices] = await databaseService.pool.query(
        "SELECT * FROM devices"
      );

      // Obtener personal
      const [personal] = await databaseService.pool.query(
        "SELECT * FROM personal"
      );

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
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching combined data:", error);
      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }
}

module.exports = new sectoresController();

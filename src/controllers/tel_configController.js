const databaseService = require("../services/database-service");
const { ValidationError } = require("../utils/errors");

class tel_ConfigController {
  async getSystemParameters(req, res, next) {
    try {
      // Ejecutar una consulta SQL para seleccionar todos los registros de la tabla 'configuracion'
      const [results] = await pool.query("SELECT * FROM configuracion");

      // Enviar los resultados de la consulta como una respuesta JSON
      res.json(results);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching configuration:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }

  async updateSystemParameters(req, res, next) {
    // Obtener las configuraciones del cuerpo de la solicitud
    const configuraciones = req.body;

    try {
      // Vaciar la tabla 'configuracion' antes de insertar nuevas configuraciones
      await pool.query("TRUNCATE TABLE configuracion");

      // Insertar cada configuración en la tabla 'configuracion'
      for (const config of configuraciones) {
        await pool.query(
          "INSERT INTO configuracion (beacon_id, min_tiempo_permanencia, max_tiempo_permanencia, umbral_verde, umbral_amarillo, umbral_rojo) VALUES (?, ?, ?, ?, ?, ?)",
          [
            config.beacon_id,
            config.min_tiempo_permanencia,
            config.max_tiempo_permanencia,
            config.umbral_verde,
            config.umbral_amarillo,
            config.umbral_rojo,
          ]
        );
      }

      // Enviar una respuesta de éxito
      res.sendStatus(200);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la actualización de la configuración
      console.error("Error updating configuration:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }

  async configurarBeacon(req, res, next) {
    try {
      // Obtener el beaconID de los parámetros de la URL
      const { beaconID } = req.params;

      // Ejecutar una consulta SQL para seleccionar los registros de la tabla 'configuracion' donde el beaconID coincida
      const [results] = await pool.query(
        "SELECT * FROM configuracion WHERE beacon_id = ?",
        [beaconID]
      );

      // Enviar los resultados de la consulta como una respuesta JSON
      res.json(results);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching configuration:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }

  async getConfigTemperaturaUmbral(req, res, next) {
    try {
      console.log("Accediendo a getConfigTemperaturaUmbral"); // Log para debug
      const [results] = await databaseService.pool.query(
        "SELECT * FROM parametrizaciones WHERE param_id IN (7, 8)"
      );
      console.log("Resultados:", results); // Log para debug
      return res.status(200).json(results);
    } catch (error) {
      console.error("Error fetching temperature thresholds:", error);
      return res.status(500).json({
        error: "Error fetching temperature thresholds",
        details: error.message,
      });
    }
  }

  async setConfigTemperaturaUmbral(req, res, next) {
    const params = req.body;
    try {
      for (const param of params) {
        await pool.query(
          "UPDATE parametrizaciones SET minimo = ?, maximo = ? WHERE param_id = ?",
          [param.minimo, param.maximo, param.param_id]
        );
      }
      res.sendStatus(200);
    } catch (error) {
      console.error("Error updating temperature thresholds:", error);
      res.status(500).send("Server Error");
    }
  }

  async getConfigUmbrales(req, res, next) {
    try {
      // Ejecutar una consulta SQL para seleccionar el primer registro de la tabla 'umbrales'
      const [results] = await pool.query("SELECT * FROM configuracion LIMIT 1");

      // Enviar el primer resultado de la consulta como una respuesta JSON
      res.json(results[0]);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la ejecución de la consulta
      console.error("Error fetching thresholds:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }

  async setConfigUmbrales(req, res, next) {
    // Extraer los umbrales del cuerpo de la solicitud
    const { umbral_verde, umbral_amarillo, umbral_rojo } = req.body;
    try {
      // Vaciar la tabla 'umbrales' antes de insertar nuevos umbrales
      await pool.query("TRUNCATE TABLE configuracion");

      // Insertar los nuevos umbrales en la tabla 'umbrales'
      await pool.query(
        "INSERT INTO umbrales (umbral_verde, umbral_amarillo, umbral_rojo) VALUES (?, ?, ?)",
        [umbral_verde, umbral_amarillo, umbral_rojo]
      );

      // Enviar una respuesta de éxito
      res.sendStatus(200);
    } catch (error) {
      // Registrar cualquier error que ocurra durante la actualización de los umbrales
      console.error("Error updating thresholds:", error);

      // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
      res.status(500).send("Server Error");
    }
  }
}
module.exports = new tel_ConfigController();

const databaseService = require('../services/database-service');
const { ValidationError } = require('../utils/errors');

class tel_ConfigController {
    async getSystemParameters(req, res, next) {
        try {
            // Ejecutar una consulta SQL para seleccionar todos los registros de la tabla 'configuracion'
            const [results] = await pool.query('SELECT * FROM configuracion');
            
            // Enviar los resultados de la consulta como una respuesta JSON
            res.json(results);
          } catch (error) {
            // Registrar cualquier error que ocurra durante la ejecución de la consulta
            console.error('Error fetching configuration:', error);
            
            // Enviar una respuesta de error 500 (Internal Server Error) con un mensaje de error
            res.status(500).send('Server Error');
          }
    }
}

module.exports = new tel_ConfigController();

/**
 *   
 */
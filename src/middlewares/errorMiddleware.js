const { ValidationError } = require('../utils/errors');

class ErrorMiddleware {
    // Middleware de manejo de errores central
    handle(err, req, res, next) {
        console.error('Error caught in middleware:', err);

        // Manejar errores de validación
        if (err instanceof ValidationError) {
            return res.status(400).json({
                error: 'Validation Error',
                message: err.message,
                details: err.details,
                timestamp: new Date().toISOString()
            });
        }

        // Manejar errores de base de datos
        if (err.code && err.code.startsWith('ER_')) {
            return res.status(503).json({
                error: 'Database Error',
                message: 'Error en la operación de base de datos',
                reference: err.code,
                timestamp: new Date().toISOString()
            });
        }

        // Error genérico
        return res.status(500).json({
            error: 'Internal Server Error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Se produjo un error interno',
            timestamp: new Date().toISOString()
        });
    }

    // Middleware para rutas no encontradas
    handleNotFound(req, res) {
        res.status(404).json({
            error: 'Not Found',
            message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = new ErrorMiddleware();
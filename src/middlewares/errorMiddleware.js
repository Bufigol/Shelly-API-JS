// errorMiddleware.js
const { isKnownError } = require('../utils/errors');

class ErrorMiddleware {
    handle(err, req, res, next) {
        console.error('Error caught in middleware:', err);

        if(isKnownError(err)){
            return res.status(err.statusCode).json({
                error: err.name,
                message: err.message,
                details: err.details || undefined,
                reference: err.code || undefined,
                resource: err.resource || undefined,
                deviceId: err.deviceId || undefined,
                errorCode: err.errorCode || undefined,
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
    handleNotFound(req, res) {
        // Usar el error NotFoundError desde errors.js
        return res.status(404).json({
            error: 'Not Found',
            message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = new ErrorMiddleware();
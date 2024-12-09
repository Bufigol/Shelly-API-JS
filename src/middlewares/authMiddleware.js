const config = require('../config/config-loader');

class AuthMiddleware {
    constructor() {
        this.config = config.getConfig();
    }

    // Middleware de autenticación básica
    authenticate(req, res, next) {
        const apiKey = req.header('X-API-Key');
        
        if (!apiKey) {
            return res.status(401).json({
                error: 'Authentication Error',
                message: 'API key no proporcionada',
                timestamp: new Date().toISOString()
            });
        }

        // Verificar API key contra la configuración
        if (apiKey !== this.config.api.auth_key) {
            return res.status(403).json({
                error: 'Authentication Error',
                message: 'API key inválida',
                timestamp: new Date().toISOString()
            });
        }

        next();
    }

    // Middleware para verificar permisos específicos
    checkPermissions(requiredPermissions) {
        return (req, res, next) => {
            // Aquí podrías implementar lógica más compleja de permisos
            // Por ahora solo verificamos la autenticación básica
            this.authenticate(req, res, next);
        };
    }

    // Middleware para limitar tasa de solicitudes
    rateLimit(options = {}) {
        const {
            windowMs = 15 * 60 * 1000, // 15 minutos por defecto
            max = 100 // 100 solicitudes por ventana por defecto
        } = options;

        const requests = new Map();

        return (req, res, next) => {
            const clientIp = req.ip;
            const now = Date.now();
            const windowStart = now - windowMs;

            // Limpiar solicitudes antiguas
            requests.forEach((timestamp, ip) => {
                if (timestamp < windowStart) {
                    requests.delete(ip);
                }
            });

            // Verificar límite de tasa
            const clientRequests = Array.from(requests.entries())
                .filter(([ip, timestamp]) => ip === clientIp && timestamp > windowStart)
                .length;

            if (clientRequests >= max) {
                return res.status(429).json({
                    error: 'Rate Limit Exceeded',
                    message: 'Demasiadas solicitudes, intente más tarde',
                    timestamp: new Date().toISOString()
                });
            }

            // Registrar nueva solicitud
            requests.set(clientIp, now);
            next();
        };
    }
}

module.exports = new AuthMiddleware();
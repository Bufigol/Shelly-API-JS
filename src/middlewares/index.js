const errorMiddleware = require('./errorMiddleware');
const authMiddleware = require('./authMiddleware');
const validationMiddleware = require('./validationMiddleware');

module.exports = {
    errorMiddleware,
    authMiddleware,
    validationMiddleware,
    
    // Configuración de middleware para Express
    setup(app) {
        // Middleware de autenticación global
        app.use(authMiddleware.authenticate.bind(authMiddleware));
        
        // Rate limiting global
        app.use(authMiddleware.rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 100 // límite de solicitudes por ventana
        }));
        
        // Middleware de manejo de errores (debe ir al final)
        app.use(errorMiddleware.handle.bind(errorMiddleware));
        app.use(errorMiddleware.handleNotFound.bind(errorMiddleware));
    }
};
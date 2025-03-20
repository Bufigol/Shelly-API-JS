// index.js
const errorMiddleware = require('./errorMiddleware');
const authMiddleware = require('./authMiddleware');
const validationMiddleware = require('./validationMiddleware');

module.exports = {
    errorMiddleware,
    authMiddleware,
    validationMiddleware,

    setup: (app) => {
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
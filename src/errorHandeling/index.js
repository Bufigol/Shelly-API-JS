// src/errorHandling/index.js

const databaseErrors = require('./databaseErrors');

module.exports = {
    ...databaseErrors,

    // Función para comprobar si un error es conocido por nuestro sistema
    isKnownError(err) {
        return err instanceof databaseErrors.DatabaseBaseError;
    },

    // Función para manejar errores generales
    handleError(err, context = 'general') {
        if (err instanceof databaseErrors.DatabaseBaseError) {
            // Ya es un error personalizado, simplemente loguearlo
            console.error(`Error ${context}:`, err.getDetails());
            return err;
        }

        // Verificar si es un error de MySQL
        if (err.code && (
            err.code.startsWith('ER_') ||
            ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST'].includes(err.code)
        )) {
            return databaseErrors.handleMySQLError(err, context);
        }

        // Error genérico
        console.error(`Error ${context} no manejado:`, err);
        return new Error(`Error inesperado en ${context}: ${err.message}`);
    }
};
// src/errorHandling/databaseErrors.js

/**
 * Errores específicos para operaciones de base de datos
 * Permite un manejo más estructurado de los errores en la aplicación
 */

/**
 * Error base para operaciones de base de datos
 * @extends Error
 */
class DatabaseBaseError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = 500;
        this.originalError = originalError;
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * Obtiene los detalles del error para logging o respuesta al cliente
     * @returns {Object} Objeto con los detalles del error
     */
    getDetails() {
        return {
            error: this.name,
            message: this.message,
            statusCode: this.statusCode,
            originalError: this.originalError ? {
                message: this.originalError.message,
                code: this.originalError.code
            } : undefined
        };
    }
}

/**
 * Error de conexión a la base de datos
 * @extends DatabaseBaseError
 */
class DatabaseConnectionError extends DatabaseBaseError {
    constructor(message, originalError = null) {
        super(message || 'Error de conexión a la base de datos', originalError);
        this.statusCode = 503; // Service Unavailable
    }
}

/**
 * Error de consulta a la base de datos
 * @extends DatabaseBaseError
 */
class DatabaseQueryError extends DatabaseBaseError {
    constructor(message, query = null, params = null, originalError = null) {
        super(message || 'Error al ejecutar consulta en la base de datos', originalError);
        this.query = query;
        this.params = params;
    }

    getDetails() {
        return {
            ...super.getDetails(),
            query: this.query ? this.query.replace(/\s+/g, ' ').trim() : undefined,
            params: this.params
        };
    }
}

/**
 * Error de transacción en la base de datos
 * @extends DatabaseBaseError
 */
class DatabaseTransactionError extends DatabaseBaseError {
    constructor(message, originalError = null) {
        super(message || 'Error en transacción de base de datos', originalError);
    }
}

/**
 * Error de validación de datos para base de datos
 * @extends DatabaseBaseError
 */
class DatabaseValidationError extends DatabaseBaseError {
    constructor(message, invalidFields = null, originalError = null) {
        super(message || 'Error de validación para la base de datos', originalError);
        this.statusCode = 400; // Bad Request
        this.invalidFields = invalidFields;
    }

    getDetails() {
        return {
            ...super.getDetails(),
            invalidFields: this.invalidFields
        };
    }
}

/**
 * Error cuando no se encuentra un registro en la base de datos
 * @extends DatabaseBaseError
 */
class DatabaseNotFoundError extends DatabaseBaseError {
    constructor(entityName, identifier, originalError = null) {
        super(`No se encontró ${entityName} con identificador: ${identifier}`, originalError);
        this.statusCode = 404; // Not Found
        this.entityName = entityName;
        this.identifier = identifier;
    }

    getDetails() {
        return {
            ...super.getDetails(),
            entityName: this.entityName,
            identifier: this.identifier
        };
    }
}

/**
 * Error cuando hay un intento de operación duplicada
 * @extends DatabaseBaseError
 */
class DatabaseDuplicateError extends DatabaseBaseError {
    constructor(entityName, field, value, originalError = null) {
        super(`Ya existe un ${entityName} con ${field}: ${value}`, originalError);
        this.statusCode = 409; // Conflict
        this.entityName = entityName;
        this.field = field;
        this.value = value;
    }

    getDetails() {
        return {
            ...super.getDetails(),
            entityName: this.entityName,
            field: this.field,
            value: this.value
        };
    }
}

/**
 * Convierte errores MySQL a errores personalizados de la aplicación
 * @param {Error} error - Error original de MySQL
 * @param {string} context - Contexto donde ocurrió el error
 * @param {string} [query] - Consulta SQL que causó el error
 * @param {Array} [params] - Parámetros utilizados en la consulta
 * @returns {DatabaseBaseError} Error personalizado
 */
function handleMySQLError(error, context, query = null, params = null) {
    // Errores de conexión
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        return new DatabaseConnectionError(
            `Error de conexión a la base de datos (${context}): ${error.message}`,
            error
        );
    }

    // Errores de consulta
    if (error.code === 'ER_PARSE_ERROR') {
        return new DatabaseQueryError(
            `Error de sintaxis SQL (${context}): ${error.message}`,
            query,
            params,
            error
        );
    }

    // Errores de restricción
    if (error.code === 'ER_DUP_ENTRY') {
        // Extraer el campo y valor duplicados del mensaje de error
        const matches = error.message.match(/Duplicate entry '(.+)' for key '(.+)'/);
        const value = matches ? matches[1] : 'desconocido';
        const keyName = matches ? matches[2] : 'desconocido';

        return new DatabaseDuplicateError(
            'registro',
            keyName,
            value,
            error
        );
    }

    if (error.code === 'ER_NO_REFERENCED_ROW' || error.code === 'ER_NO_REFERENCED_ROW_2') {
        return new DatabaseValidationError(
            `Error de integridad referencial (${context}): ${error.message}`,
            null,
            error
        );
    }

    // Error genérico de base de datos
    return new DatabaseQueryError(
        `Error de base de datos (${context}): ${error.message}`,
        query,
        params,
        error
    );
}

module.exports = {
    DatabaseBaseError,
    DatabaseConnectionError,
    DatabaseQueryError,
    DatabaseTransactionError,
    DatabaseValidationError,
    DatabaseNotFoundError,
    DatabaseDuplicateError,
    handleMySQLError
};
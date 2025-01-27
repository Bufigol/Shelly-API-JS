class ValidationError extends Error {
    constructor(message, details = null) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
        this.statusCode = 400;
        Error.captureStackTrace(this, this.constructor);
    }
}

class DatabaseError extends Error {
    constructor(message, query = null, code = null) {
        super(message);
        this.name = 'DatabaseError';
        this.query = query;
        this.code = code;
        this.statusCode = 503;
        Error.captureStackTrace(this, this.constructor);
    }
}

class AuthenticationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthenticationError';
        this.statusCode = 401;
        Error.captureStackTrace(this, this.constructor);
    }
}

class NotFoundError extends Error {
    constructor(message, resource = null) {
        super(message);
        this.name = 'NotFoundError';
        this.resource = resource;
        this.statusCode = 404;
        Error.captureStackTrace(this, this.constructor);
    }
}

class BusinessError extends Error {
    constructor(message, code = null) {
        super(message);
        this.name = 'BusinessError';
        this.code = code;
        this.statusCode = 422;
        Error.captureStackTrace(this, this.constructor);
    }
}

class DeviceError extends Error {
    constructor(message, deviceId = null, errorCode = null) {
        super(message);
        this.name = 'DeviceError';
        this.deviceId = deviceId;
        this.errorCode = errorCode;
        this.statusCode = 503;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    ValidationError,
    DatabaseError,
    AuthenticationError,
    NotFoundError,
    BusinessError,
    DeviceError,
    
    // Función helper para determinar si un error es conocido
    isKnownError(error) {
        return error instanceof ValidationError ||
               error instanceof DatabaseError ||
               error instanceof AuthenticationError ||
               error instanceof NotFoundError ||
               error instanceof BusinessError ||
               error instanceof DeviceError;
    }
};
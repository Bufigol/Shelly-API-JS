// src/services/jwt-service.js
const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/js_files/jwt-config-loader');

class JwtService {
    constructor() {
        this.config = this.loadConfig();
        this.initialize();
    }

    /**
     * Carga la configuración JWT
     * @returns {Object} - Configuración JWT
     */
    loadConfig() {
        return jwtConfig.getJwtConfig();
    }

    /**
     * Inicializa el servicio JWT
     */
    initialize() {
        // Recargar configuración para asegurar que tenemos los datos más recientes
        this.config = this.loadConfig();
        console.log('JWT Service inicializado');
    }

    /**
     * Recarga la configuración JWT
     */
    reloadConfig() {
        this.config = this.loadConfig();
        console.log('JWT Service: Configuración recargada');
    }

    /**
     * Genera un token JWT para un usuario
     * 
     * @param {Object} payload - Datos a incluir en el token
     * @param {Object} options - Opciones adicionales para el token
     * @returns {string} - Token JWT generado
     */
    generateToken(payload, options = {}) {
        if (!payload) {
            throw new Error('Se requiere un payload para generar el token');
        }

        const tokenOptions = {
            expiresIn: options.expiresIn || this.config.expires_in || '1h',
            issuer: options.issuer || this.config.issuer || 'TNS_TRACK'
        };

        try {
            return jwt.sign(payload, this.config.secret, tokenOptions);
        } catch (error) {
            console.error('Error al generar token JWT:', error.message);
            throw new Error(`Error al generar token JWT: ${error.message}`);
        }
    }

    /**
     * Verifica un token JWT
     * 
     * @param {string} token - Token JWT a verificar
     * @param {Object} options - Opciones adicionales para la verificación
     * @returns {Object} - Payload decodificado si el token es válido
     * @throws {Error} - Si el token no es válido
     */
    verifyToken(token, options = {}) {
        if (!token) {
            throw new Error('Se requiere un token para verificar');
        }

        const verifyOptions = {
            issuer: options.issuer || this.config.issuer,
            ...options
        };

        try {
            return jwt.verify(token, this.config.secret, verifyOptions);
        } catch (error) {
            console.error('Error al verificar token JWT:', error.message);
            throw new Error(`Token inválido: ${error.message}`);
        }
    }

    /**
     * Decodifica un token JWT sin verificarlo
     * 
     * @param {string} token - Token JWT a decodificar
     * @param {boolean} [complete=false] - Si es true, devuelve un objeto con header, payload y signature
     * @returns {Object} - Payload decodificado
     * @throws {Error} - Si el token no puede ser decodificado
     */
    decodeToken(token, complete = true) {
        if (!token) {
            throw new Error('Se requiere un token para decodificar');
        }

        try {
            return jwt.decode(token, { complete }) || {};
        } catch (error) {
            console.error('Error al decodificar token JWT:', error.message);
            throw new Error(`No se pudo decodificar el token: ${error.message}`);
        }
    }

    /**
     * Renueva un token JWT existente
     * 
     * @param {string} token - Token JWT a renovar
     * @param {Object} additionalPayload - Datos adicionales a incluir en el nuevo token
     * @param {Object} options - Opciones adicionales para el nuevo token
     * @returns {string} - Nuevo token JWT
     * @throws {Error} - Si el token no es válido o no puede ser renovado
     */
    renewToken(token, additionalPayload = {}, options = {}) {
        try {
            // Verificar el token actual (ignorando expiración)
            const decoded = this.verifyToken(token, { ignoreExpiration: true });

            // Crear nuevo payload fusionando el anterior con el adicional
            const newPayload = {
                ...decoded,
                ...additionalPayload
            };

            // Eliminar propiedades que no deben estar en el nuevo token
            delete newPayload.exp;
            delete newPayload.iat;
            delete newPayload.jti;
            // Eliminar también el issuer para evitar conflictos
            delete newPayload.iss;

            // Generar nuevo token
            return this.generateToken(newPayload, options);
        } catch (error) {
            console.error('Error al renovar token JWT:', error.message);
            throw new Error(`No se pudo renovar el token: ${error.message}`);
        }
    }

    /**
     * Verifica si un token está próximo a expirar
     * 
     * @param {string} token - Token JWT a verificar
     * @param {number} thresholdMinutes - Tiempo en minutos para considerar próximo a expirar
     * @returns {boolean} - true si el token expira dentro del umbral indicado
     */
    isTokenExpiringSoon(token, thresholdMinutes = 10) {
        try {
            // Decodificar sin verificar para obtener la fecha de expiración
            const decoded = this.decodeToken(token);
            const payload = decoded.payload || decoded;

            if (!payload || !payload.exp) {
                return true; // Si no tiene fecha de expiración, considerarlo como expirado
            }

            // Calcular tiempo restante en minutos
            const expirationTime = payload.exp * 1000; // Convertir a milisegundos
            const currentTime = Date.now();
            const remainingTimeMs = expirationTime - currentTime;
            const remainingMinutes = remainingTimeMs / (1000 * 60);

            return remainingMinutes <= thresholdMinutes;
        } catch (error) {
            console.error('Error al verificar expiración del token:', error.message);
            return true; // En caso de error, asumir que está por expirar
        }
    }
}

module.exports = new JwtService();
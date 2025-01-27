// config/js_files/jwt-config.js
const configLoader = require('./config-loader'); // Asegúrate de tener la ruta correcta
const path = require('path');

class JwtConfigLoader {
    constructor() {
        this.configPath = '../jsons/jwt.json';
        this.cachedConfig = null;
        this.lastLoadTime = null;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos
    }

    loadConfiguration() {
        if (this.isCacheValid()) {
            return this.cachedConfig;
        }

        try {
            const config = configLoader.loadJsonFile(this.configPath);
            this.validateConfig(config); // Validación de configuración
            this.cachedConfig = config;
            this.lastLoadTime = Date.now();
            return config;
        } catch (error) {
            throw new Error(`Error loading JWT configuration: ${error.message}`);
        }
    }
    validateConfig(config) {
        // Validación de campos obligatorios
        if (!config.secret || !config.issuer || !config.expiresIn) {
            throw new Error('Missing required JWT configuration fields');
        }
    }
    isCacheValid() {
        return (
            this.cachedConfig &&
            this.lastLoadTime &&
            Date.now() - this.lastLoadTime < this.CACHE_DURATION
        );
    }

    getJwtConfig() {
        return this.loadConfiguration();
    }
    getValue(path) {
        return path
            .split(".")
            .reduce((obj, key) => obj && obj[key], this.getJwtConfig());
    }

    hasConfig(path) {
        return this.getValue(path) !== undefined;
    }

    reloadConfig() {
        this.cachedConfig = null;
        this.lastLoadTime = null;
        return this.loadConfiguration();
    }
}

module.exports = new JwtConfigLoader();
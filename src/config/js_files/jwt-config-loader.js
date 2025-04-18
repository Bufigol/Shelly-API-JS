// config/js_files/jwt-config-loader.js
const BaseConfigLoader = require("./base-config-loader");
const path = require("path");

class JwtConfigLoader extends BaseConfigLoader {
    constructor() {
        super();
        this.configPath = "../jsons/unified-config.json";
        this.cachedConfig = null;
        this.lastLoadTime = null;
    }

    /**
     * Carga la configuración JWT desde el archivo de configuración unificado
     *
     * @returns {Object} - Configuración JWT
     * @throws {Error} - Si hay errores al cargar o parsear el archivo de configuración
     */
    loadConfiguration() {
        try {
            if (this.isCacheValid()) {
                return this.cachedConfig;
            }

            // Cargar el archivo de configuración unificado
            const unifiedConfig = this.loadJsonFile(this.configPath);

            // Extraer la sección JWT
            const jwtConfig = unifiedConfig.jwt;

            if (!jwtConfig) {
                throw new Error("No se encontró la sección JWT en la configuración unificada");
            }

            // Validar la configuración
            this.validateConfig(jwtConfig);

            // Actualizar caché
            this.cachedConfig = jwtConfig;
            this.lastLoadTime = Date.now();

            console.log("JWT Config Loader: Configuración cargada correctamente");
            return jwtConfig;
        } catch (error) {
            throw new Error(`Error al cargar la configuración JWT: ${error.message}`);
        }
    }

    /**
     * Valida la configuración JWT para asegurar que todos los campos requeridos están presentes
     *
     * @param {Object} config - Configuración a validar
     * @throws {Error} - Si faltan campos requeridos
     */
    validateConfig(config) {
        if (!config.secret) {
            throw new Error("Falta el secreto JWT en la configuración");
        }

        if (!config.expires_in) {
            console.warn("⚠️ Tiempo de expiración JWT no especificado, usando valor predeterminado");
        }

        if (!config.issuer) {
            console.warn("⚠️ Emisor JWT no especificado, usando valor predeterminado");
        }
    }

    /**
     * Obtiene la configuración JWT
     * @returns {Object} - Configuración JWT actual
     */
    getJwtConfig() {
        return this.loadConfiguration();
    }

    /**
     * Verifica si existe una configuración específica
     * @param {string} key - Clave a verificar
     * @returns {boolean} - true si la configuración existe, false en caso contrario
     */
    hasConfig(key) {
        const config = this.getJwtConfig();
        return config && config[key] !== undefined;
    }
}

module.exports = new JwtConfigLoader();
// config/js_files/jwt-config.js
const BaseConfigLoader = require("./base-config-loader");

class JwtConfigLoader extends BaseConfigLoader {
  constructor() {
    super();
    this.configPath = "../jsons/jwt.json";
  }

  /**
   * Carga la configuración JWT desde el archivo y la valida
   * @returns {Object} Configuración JWT validada
   * @throws {Error} Si hay errores en la carga o validación
   */
  loadConfiguration() {
    if (this.isCacheValid()) {
      return this.cachedConfig;
    }

    try {
      const config = this.loadJsonFile(this.configPath);

      // Normalizar la configuración para manejar diferentes estructuras
      const normalizedConfig = this.normalizeConfig(config);

      this.validateConfig(normalizedConfig);
      this.cachedConfig = normalizedConfig;
      this.lastLoadTime = Date.now();

      console.log("JWT Config Loaded:", normalizedConfig);

      return normalizedConfig;
    } catch (error) {
      console.error("JWT Config Loading Error:", error);
      throw new Error(`Error loading JWT configuration: ${error.message}`);
    }
  }

  /**
   * Normaliza la configuración para manejar diferentes estructuras
   * @param {Object} config Configuración cargada
   * @returns {Object} Configuración normalizada
   */
  normalizeConfig(config) {
    // Si ya tiene la estructura correcta, devolverlo tal cual
    if (config.jwt) return config;

    // Si es un objeto plano, envolver en un objeto JWT
    return {
      jwt: {
        secret: config.secret,
        issuer: config.issuer,
        expiresIn: config.expiresIn || "1h",
      },
    };
  }

  /**
   * Valida que la configuración JWT contenga todos los campos requeridos
   * @param {Object} config Configuración a validar
   * @throws {Error} Si falta algún campo requerido o hay valores inválidos
   */
  validateConfig(config) {
    const jwtConfig = config.jwt || config;

    // Validación de campos obligatorios
    const requiredFields = ["secret", "issuer"];
    const missingFields = requiredFields.filter((field) => !jwtConfig[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required JWT configuration fields: ${missingFields.join(", ")}`
      );
    }

    // Validación de tipos y valores
    if (typeof jwtConfig.secret !== "string" || jwtConfig.secret.length < 32) {
      throw new Error("JWT secret must be a string of at least 32 characters");
    }

    if (typeof jwtConfig.issuer !== "string" || !jwtConfig.issuer.trim()) {
      throw new Error("JWT issuer must be a non-empty string");
    }

    // Validación del formato de expiresIn (opcional)
    if (jwtConfig.expiresIn && !this.isValidExpiresIn(jwtConfig.expiresIn)) {
      throw new Error(
        'Invalid expiresIn format. Must be a string like "1h", "2d", "7d", etc.'
      );
    }
  }

  /**
   * Obtiene la configuración JWT actual
   * @returns {Object} Configuración JWT
   */
  getJwtConfig() {
    return this.loadConfiguration().jwt;
  }

  /**
   * Obtiene un valor específico de la configuración JWT
   * @param {string} key Clave de configuración
   * @returns {any} Valor de la configuración
   */
  getJwtValue(key) {
    const config = this.getJwtConfig();
    return config[key];
  }

  /**
   * Verifica si existe una configuración específica
   * @param {string} key Clave a verificar
   * @returns {boolean} true si existe la configuración
   */
  hasConfig(key) {
    const config = this.getJwtConfig();
    return config.hasOwnProperty(key);
  }

  /**
   * Valida el formato del campo expiresIn
   * @param {string} expiresIn Valor a validar
   * @returns {boolean} true si el formato es válido
   */
  isValidExpiresIn(expiresIn) {
    // Acepta formatos como "60", "2 days", "10h", "7d"
    const validFormat = /^(\d+)(s|m|h|d|w|y)?$/;
    return typeof expiresIn === "string" && validFormat.test(expiresIn);
  }
}

// Exporta una única instancia para mantener el patrón Singleton
module.exports = new JwtConfigLoader();

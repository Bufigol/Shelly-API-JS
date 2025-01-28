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
      this.validateConfig(config);
      this.cachedConfig = config;
      this.lastLoadTime = Date.now();
      return config;
    } catch (error) {
      throw new Error(`Error loading JWT configuration: ${error.message}`);
    }
  }

  /**
   * Valida que la configuración JWT contenga todos los campos requeridos
   * @param {Object} config Configuración a validar
   * @throws {Error} Si falta algún campo requerido o hay valores inválidos
   */
  validateConfig(config) {
    // Validación de campos obligatorios
    const requiredFields = ["secret", "issuer", "expiresIn"];
    const missingFields = requiredFields.filter((field) => !config[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required JWT configuration fields: ${missingFields.join(", ")}`
      );
    }

    // Validación de tipos y valores
    if (typeof config.secret !== "string" || config.secret.length < 32) {
      throw new Error("JWT secret must be a string of at least 32 characters");
    }

    if (typeof config.issuer !== "string" || !config.issuer.trim()) {
      throw new Error("JWT issuer must be a non-empty string");
    }

    // Validación del formato de expiresIn
    if (!this.isValidExpiresIn(config.expiresIn)) {
      throw new Error(
        'Invalid expiresIn format. Must be a string like "1h", "2d", "7d", etc.'
      );
    }

    // Validación de campos opcionales si están presentes
    if (
      config.algorithm &&
      !["HS256", "HS384", "HS512", "RS256"].includes(config.algorithm)
    ) {
      throw new Error("Invalid JWT algorithm");
    }

    if (config.audience && typeof config.audience !== "string") {
      throw new Error("JWT audience must be a string");
    }
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

  /**
   * Obtiene la configuración JWT actual
   * @returns {Object} Configuración JWT
   */
  getJwtConfig() {
    return this.loadConfiguration();
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
  hasJwtConfig(key) {
    const config = this.getJwtConfig();
    return config.hasOwnProperty(key);
  }

  /**
   * Recarga la configuración JWT
   * @returns {Object} Nueva configuración JWT
   */
  reloadJwtConfig() {
    return this.reloadConfig();
  }
}

// Exporta una única instancia para mantener el patrón Singleton
module.exports = new JwtConfigLoader();

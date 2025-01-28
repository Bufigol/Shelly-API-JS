// config/js_files/base-config-loader.js
const fs = require("fs");
const path = require("path");

class BaseConfigLoader {
  constructor() {
    this.cachedConfig = null;
    this.lastLoadTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos
    this.configPath = null;
  }

  /**
   * Carga un archivo JSON desde la ruta especificada
   * @param {string} filename - Ruta relativa al archivo JSON
   * @returns {Object} - Contenido del archivo JSON parseado
   * @throws {Error} - Si hay un error al cargar o parsear el archivo
   */
  loadJsonFile(filename) {
    try {
      const filePath = path.join(__dirname, filename);
      const fileContent = fs.readFileSync(filePath, "utf8");
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Error loading ${filename}: ${error.message}`);
    }
  }

  /**
   * Verifica si la caché actual es válida
   * @returns {boolean} - true si la caché es válida, false en caso contrario
   */
  isCacheValid() {
    return (
      this.cachedConfig &&
      this.lastLoadTime &&
      Date.now() - this.lastLoadTime < this.CACHE_DURATION
    );
  }

  /**
   * Obtiene un valor de la configuración usando una ruta de acceso con notación de punto
   * @param {string} path - Ruta de acceso (ejemplo: "database.host")
   * @returns {any} - Valor encontrado en la ruta especificada
   */
  getValue(path) {
    return path
      .split(".")
      .reduce((obj, key) => obj && obj[key], this.getConfig());
  }

  /**
   * Verifica si existe una configuración en la ruta especificada
   * @param {string} path - Ruta a verificar
   * @returns {boolean} - true si existe la configuración, false en caso contrario
   */
  hasConfig(path) {
    return this.getValue(path) !== undefined;
  }

  /**
   * Recarga la configuración limpiando la caché
   * @returns {Object} - Nueva configuración cargada
   */
  reloadConfig() {
    this.cachedConfig = null;
    this.lastLoadTime = null;
    return this.loadConfiguration();
  }

  /**
   * Obtiene la configuración actual
   * @returns {Object} - Configuración actual
   */
  getConfig() {
    return this.loadConfiguration();
  }

  /**
   * Método abstracto para cargar la configuración
   * Debe ser implementado por las clases hijas
   * @throws {Error} - Si no se implementa en la clase hija
   */
  loadConfiguration() {
    throw new Error("loadConfiguration must be implemented by child class");
  }

  /**
   * Método abstracto para validar la configuración
   * Debe ser implementado por las clases hijas
   * @param {Object} config - Configuración a validar
   * @throws {Error} - Si no se implementa en la clase hija
   */
  validateConfig(config) {
    throw new Error("validateConfig must be implemented by child class");
  }

  /**
   * Establece el tiempo de duración de la caché
   * @param {number} duration - Duración en milisegundos
   */
  setCacheDuration(duration) {
    this.CACHE_DURATION = duration;
  }

  /**
   * Limpia la caché actual
   */
  clearCache() {
    this.cachedConfig = null;
    this.lastLoadTime = null;
  }
}

module.exports = BaseConfigLoader;

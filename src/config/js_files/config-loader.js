// config/js_files/config-loader.js
const BaseConfigLoader = require("./base-config-loader");
const JwtConfigLoader = require("./jwt-config");
const path = require("path");

class ConfigLoader extends BaseConfigLoader {
  constructor() {
    super();
    this.config = {};
    this.measurementConfig = {};
    this.configPaths = {
      api: "../jsons/api-credentials.json",
      database: "../jsons/ddbb_produccion.json",
      measurement: "../jsons/precios_energia.json",
    };
    this.jwtConfig = JwtConfigLoader;

    this.loadConfiguration(); 
  }

  /**
   * Carga todas las configuraciones del sistema
   * @returns {Object} Configuración completa del sistema
   * @throws {Error} Si hay errores en la carga de configuración
   */
  loadConfiguration() {
    try {
      // Verificar si podemos usar la caché
      if (this.isCacheValid()) {
        return this.cachedConfig;
      }

      // Cargar configuración de API
      const apiConfig = this.loadJsonFile(this.configPaths.api);

      // Cargar configuración de base de datos
      const dbConfig = this.loadJsonFile(this.configPaths.database);

      // Cargar configuración de mediciones
      const measurementConfig = this.loadJsonFile(this.configPaths.measurement);

      // Parsear la URL JDBC
      const dbDetails = this.parseJdbcUrl(dbConfig.url);

      // Cargar configuración de Ubibot
      const ubibotConfig = this.loadJsonFile(
        "../jsons/ubibot_account_info.json"
      );

      // Construir objeto de configuración
      this.config = {
        api: apiConfig.shelly_cloud.api,
        collection: {
          interval: apiConfig.shelly_cloud.settings.collection_interval,
          retryAttempts: 3,
          retryDelay: 5000,
        },
        ubibot: {
          accountKey: ubibotConfig.ACCOUNT_KEY,
          tokenFile: ubibotConfig.TOKEN_FILE,
          excludedChannels: ubibotConfig.EXCLUDED_CHANNELS,
          collectionInterval: 600000,
        },
        database: {
          host: dbDetails.host,
          port: dbDetails.port,
          database: dbDetails.database,
          username: dbConfig.username,
          password: dbConfig.password,
          pool: dbConfig.pool,
        },
        measurement: {
          precio_kwh: measurementConfig.precios_energia.precio_kwh.valor,
          intervalos: {
            medicion: 10,
            max_desviacion: 2,
            actualizacion: {
              hora: measurementConfig.precios_energia.configuracion_calculo
                .intervalo_actualizacion_promedios.hora,
              dia: measurementConfig.precios_energia.configuracion_calculo
                .intervalo_actualizacion_promedios.dia,
              mes: measurementConfig.precios_energia.configuracion_calculo
                .intervalo_actualizacion_promedios.mes,
            },
          },
          calidad: {
            umbral_minimo: 0.8,
            max_intentos: 3,
            tiempo_espera: 5000,
          },
          zona_horaria:
            measurementConfig.precios_energia.metadatos.zona_horaria,
          proveedor:
            measurementConfig.precios_energia.metadatos.proveedor_energia,
          tipo_tarifa: measurementConfig.precios_energia.metadatos.tipo_tarifa,
        },
        jwt: this.jwtConfig.getJwtConfig(),
      };

      this.validateConfig();

      // Actualizar caché
      this.cachedConfig = this.config;
      this.lastLoadTime = Date.now();

      console.log("✅ Configuración cargada correctamente");
      return this.config;
    } catch (error) {
      throw new Error(`Error loading configuration: ${error.message}`);
    }
  }

  /**
   * Parsea una URL JDBC a sus componentes
   * @param {string} jdbcUrl URL JDBC a parsear
   * @returns {Object} Componentes de la URL
   * @throws {Error} Si el formato de la URL es inválido
   */
  parseJdbcUrl(jdbcUrl) {
    const cleanUrl = jdbcUrl.replace("jdbc:", "");
    const matches = cleanUrl.match(/mysql:\/\/([^:]+):(\d+)\/(.+)/);

    if (!matches) {
      throw new Error("Invalid JDBC URL format");
    }

    return {
      host: matches[1],
      port: parseInt(matches[2]),
      database: matches[3],
    };
  }

  /**
   * Valida la configuración completa del sistema
   * @throws {Error} Si hay campos requeridos faltantes o valores inválidos
   */
  validateConfig() {
    // Validación de configuración de base de datos
    const { database } = this.config;
    if (
      !database.host ||
      !database.port ||
      !database.database ||
      !database.username
    ) {
      throw new Error("Missing required database configuration fields");
    }

    // Validación de configuración de API
    const { api } = this.config;
    if (!api.url || !api.device_id || !api.auth_key) {
      throw new Error("Missing required API configuration fields");
    }

    // Validación de configuración de mediciones
    const { measurement } = this.config;
    if (!measurement.precio_kwh || !measurement.intervalos.medicion) {
      throw new Error("Missing required measurement configuration fields");
    }

    // Validación de configuración de Ubibot
    const { ubibot } = this.config;
    if (!ubibot.accountKey || !ubibot.tokenFile) {
      throw new Error("Missing required Ubibot configuration fields");
    }

    // Validación de configuración JWT
    if (!this.jwtConfig.hasConfig("secret")) {
      throw new Error("Missing JWT secret configuration");
    }
  }

  /**
   * Obtiene la configuración actual
   * @returns {Object} Configuración actual del sistema
   */
  getConfig() {
    return this.loadConfiguration();
  }

  /**
   * Recarga todas las configuraciones
   * @returns {Object} Nueva configuración del sistema
   */
  reloadConfig() {
    this.cachedConfig = null;
    this.lastLoadTime = null;
    this.jwtConfig.reloadConfig();
    return this.loadConfiguration();
  }

  /**
   * Obtiene un valor específico de la configuración usando notación de punto
   * @param {string} path Ruta al valor (ejemplo: "database.host")
   * @returns {any} Valor encontrado en la ruta especificada
   */
  getValue(path) {
    return path
      .split(".")
      .reduce((obj, key) => obj && obj[key], this.getConfig());
  }

  /**
   * Verifica si existe una configuración en la ruta especificada
   * @param {string} path Ruta a verificar
   * @returns {boolean} true si existe la configuración
   */
  hasConfig(path) {
    return this.getValue(path) !== undefined;
  }
}

// Exporta una única instancia para mantener el patrón Singleton
module.exports = new ConfigLoader();

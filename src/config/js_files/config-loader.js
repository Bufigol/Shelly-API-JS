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
      email: "../jsons/sgMailConfig.json", // Nuevo: ruta a la configuración de SendGrid
    };
    this.jwtConfig = JwtConfigLoader;

    this.loadConfiguration();
  }

  /**
   * Carga la configuración de la aplicación desde archivos JSON
   *
   * Primero, se verifica si la caché actual es válida. Si es así, se devuelve
   * inmediatamente la configuración en caché.
   *
   * Luego, se cargan las configuraciones de la API de Shelly Cloud, las bases
   * de datos y la configuración de mediciones. Se parsean las URLs JDBC de las
   * bases de datos y se construye el objeto de configuración.
   *
   * Finalmente, se valida la configuración y se actualiza la caché.
   *
   * @returns {Object} - Configuración cargada
   * @throws {Error} - Si hay errores al cargar o parsear los archivos de configuración
   */
  loadConfiguration() {
    try {
      if (this.isCacheValid()) {
        return this.cachedConfig;
      }

      // Cargar configuración de API
      const apiConfig = this.loadJsonFile(this.configPaths.api);

      // Cargar configuraciones de bases de datos
      const mainDbConfig = this.loadJsonFile(this.configPaths.database);

      // Cargar configuración de mediciones
      const measurementConfig = this.loadJsonFile(this.configPaths.measurement);

      // Parsear las URLs JDBC
      const mainDbDetails = this.parseJdbcUrl(mainDbConfig.url);

      // Cargar configuración de Ubibot
      const ubibotConfig = this.loadJsonFile(
        "../jsons/ubibot_account_info.json"
      );

      // Cargar configuración de SendGrid
      let emailConfig = {};
      try {
        emailConfig = this.loadJsonFile(this.configPaths.email);
        console.log("✅ Configuración de SendGrid cargada correctamente");
      } catch (error) {
        console.warn(
          `⚠️ No se pudo cargar la configuración de SendGrid: ${error.message}`
        );
      }

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
        // Nueva configuración de email
        email: emailConfig,
        // Nueva estructura para bases de datos
        databases: {
          main: {
            host: mainDbDetails.host,
            port: mainDbDetails.port,
            database: mainDbDetails.database,
            username: mainDbConfig.username,
            password: mainDbConfig.password,
            pool: mainDbConfig.pool,
          },
        },
        // Mantener compatibilidad con código existente
        database: {
          host: mainDbDetails.host,
          port: mainDbDetails.port,
          database: mainDbDetails.database,
          username: mainDbConfig.username,
          password: mainDbConfig.password,
          pool: mainDbConfig.pool,
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
   * Validates the application's configuration to ensure all required fields are present.
   *
   * This method performs a comprehensive validation of several critical parts
   * of the application configuration, including database settings, API details,
   * measurement configurations, Ubibot settings, and JWT secret configuration.
   *
   * It checks each of these sections for the presence of necessary fields and
   * throws an error if any required field is missing. Specifically, it validates:
   *
   * - Databases: Ensures that each database configuration includes host, port,
   *   database name, and username.
   * - API: Confirms that the API configuration has a URL, device ID, and auth key.
   * - Measurements: Verifies that the configuration includes the price per kWh and
   *   measurement intervals.
   * - Ubibot: Checks for the presence of account key and token file in the Ubibot
   *   configuration.
   * - JWT: Ensures that the JWT configuration contains a secret.
   *
   * @throws {Error} If any required configuration fields are missing.
   */

  validateConfig() {
    // Validación de bases de datos
    for (const [dbName, dbConfig] of Object.entries(this.config.databases)) {
      if (
        !dbConfig.host ||
        !dbConfig.port ||
        !dbConfig.database ||
        !dbConfig.username
      ) {
        throw new Error(
          `Missing required database configuration fields for ${dbName}`
        );
      }
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

    // Verificar configuración de email (no obligatoria, solo log informativo)
    const { email } = this.config;
    if (!email || !email.SENDGRID_API_KEY) {
      console.warn(
        "⚠️ No se encontró configuración de SendGrid o está incompleta"
      );
    } else {
      console.log("✅ Configuración de SendGrid verificada");
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

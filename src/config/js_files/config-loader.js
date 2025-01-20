// config/config-loader.js
const fs = require("fs");
const path = require("path");

class ConfigLoader {
  constructor() {
    this.config = {};
    this.measurementConfig = {};
    this.configPaths = {
      api: "../jsons/api-credentials.json",
      database: "../jsons/ddbb_produccion.json",
      measurement: "../jsons/precios_energia.json",
      jwt: "../jsons/jwt-config.json",
    };
    this.cachedConfig = null;
    this.lastLoadTime = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

    this.loadConfigurations();
  }

  loadConfigurations() {
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

      // Cargar configuración JWT (opcional)
      let jwtConfig = {
        jwt: { secret: process.env.JWT_SECRET || "default_secret_key" },
      };
      try {
        jwtConfig = this.loadJsonFile(this.configPaths.jwt);
      } catch (e) {
        console.log("JWT config file not found, using default configuration");
      }

      // Combinar todas las configuraciones
      this.config = {
        api: apiConfig.shelly_cloud.api,
        collection: {
          interval: apiConfig.shelly_cloud.settings.collection_interval,
          retryAttempts: 3,
          retryDelay: 5000,
        },
        jwt: {
          secret: jwtConfig.jwt.secret,
          expiresIn: jwtConfig.jwt.expires_in || "1h",
          issuer: jwtConfig.jwt.issuer || "tns-track",
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
      };

      this.validateConfig();

      this.cachedConfig = this.config;
      this.lastLoadTime = Date.now();

      console.log("✅ Configuración cargada correctamente");
      return this.config;
    } catch (error) {
      throw new Error(`Error loading configuration: ${error.message}`);
    }
  }

  loadJsonFile(filename) {
    try {
      const filePath = path.join(__dirname, filename);
      const fileContent = fs.readFileSync(filePath, "utf8");
      return JSON.parse(fileContent);
    } catch (error) {
      throw new Error(`Error loading ${filename}: ${error.message}`);
    }
  }

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

    const { ubibot } = this.config;
    if (!ubibot.accountKey || !ubibot.tokenFile) {
      throw new Error("Missing required Ubibot configuration fields");
    }
    const { jwt } = this.config;
    if (!jwt?.secret) {
      console.warn(
        "WARNING: Using default JWT secret. This is not recommended for production."
      );
    }
    if (!jwt?.expiresIn) {
      console.warn("WARNING: Using default JWT expiration time (1h)");
    }
    if (!jwt?.issuer) {
      console.warn("WARNING: Using default JWT issuer (tns-track)");
    }
  }

  isCacheValid() {
    return (
      this.cachedConfig &&
      this.lastLoadTime &&
      Date.now() - this.lastLoadTime < this.CACHE_DURATION
    );
  }

  getConfig() {
    return this.loadConfigurations();
  }

  reloadConfig() {
    this.cachedConfig = null;
    this.lastLoadTime = null;
    return this.loadConfigurations();
  }

  getValue(path) {
    return path
      .split(".")
      .reduce((obj, key) => obj && obj[key], this.getConfig());
  }

  hasConfig(path) {
    return this.getValue(path) !== undefined;
  }
}

module.exports = new ConfigLoader();

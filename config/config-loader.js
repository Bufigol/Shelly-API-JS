// config/config-loader.js
const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor() {
        this.config = {};
        this.measurementConfig = {};
        this.configPaths = {
            api: 'api-credentials.json',
            database: 'database.json',
            measurement: 'precios_energia.json'
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

            // Combinar todas las configuraciones
            this.config = {
                api: apiConfig.shelly_cloud.api,
                collection: {
                    interval: apiConfig.shelly_cloud.settings.collection_interval,
                    retryAttempts: 3,
                    retryDelay: 5000
                },
                database: {
                    host: dbDetails.host,
                    port: dbDetails.port,
                    database: dbDetails.database,
                    username: dbConfig.username,
                    password: dbConfig.password,
                    pool: dbConfig.pool
                },
                measurement: {
                    precio_kwh: measurementConfig.precios_energia.precio_kwh.valor,
                    intervalos: {
                        medicion: 10,           // segundos
                        max_desviacion: 2,      // segundos
                        actualizacion: {
                            hora: measurementConfig.precios_energia.configuracion_calculo.intervalo_actualizacion_promedios.hora,
                            dia: measurementConfig.precios_energia.configuracion_calculo.intervalo_actualizacion_promedios.dia,
                            mes: measurementConfig.precios_energia.configuracion_calculo.intervalo_actualizacion_promedios.mes
                        }
                    },
                    calidad: {
                        umbral_minimo: 0.8,     // 80% de lecturas válidas requeridas
                        max_intentos: 3,        // Máximo número de reintentos
                        tiempo_espera: 5000     // Tiempo entre reintentos (ms)
                    },
                    zona_horaria: measurementConfig.precios_energia.metadatos.zona_horaria,
                    proveedor: measurementConfig.precios_energia.metadatos.proveedor_energia,
                    tipo_tarifa: measurementConfig.precios_energia.metadatos.tipo_tarifa
                }
            };

            this.validateConfig();
            
            // Actualizar caché
            this.cachedConfig = this.config;
            this.lastLoadTime = Date.now();

            console.log('✅ Configuración cargada correctamente');
            return this.config;

        } catch (error) {
            throw new Error(`Error loading configuration: ${error.message}`);
        }
    }

    loadJsonFile(filename) {
        try {
            const filePath = path.join(__dirname, filename);
            const fileContent = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(fileContent);
        } catch (error) {
            throw new Error(`Error loading ${filename}: ${error.message}`);
        }
    }

    parseJdbcUrl(jdbcUrl) {
        // Limpiar URL JDBC
        const cleanUrl = jdbcUrl.replace('jdbc:', '');
        const matches = cleanUrl.match(/mysql:\/\/([^:]+):(\d+)\/(.+)/);
        
        if (!matches) {
            throw new Error('Invalid JDBC URL format');
        }

        return {
            host: matches[1],
            port: parseInt(matches[2]),
            database: matches[3]
        };
    }

    validateConfig() {
        // Validación de configuración de base de datos
        const { database } = this.config;
        if (!database.host || !database.port || !database.database || !database.username) {
            throw new Error('Missing required database configuration fields');
        }

        // Validación de configuración de API
        const { api } = this.config;
        if (!api.url || !api.device_id || !api.auth_key) {
            throw new Error('Missing required API configuration fields');
        }

        // Validación de configuración de mediciones
        const { measurement } = this.config;
        if (!measurement.precio_kwh || !measurement.intervalos.medicion) {
            throw new Error('Missing required measurement configuration fields');
        }
    }

    isCacheValid() {
        return this.cachedConfig && 
               this.lastLoadTime && 
               (Date.now() - this.lastLoadTime < this.CACHE_DURATION);
    }

    getConfig() {
        return this.loadConfigurations();
    }

    // Método para recargar la configuración bajo demanda
    reloadConfig() {
        this.cachedConfig = null;
        this.lastLoadTime = null;
        return this.loadConfigurations();
    }

    // Método para obtener un valor específico de configuración
    getValue(path) {
        return path.split('.').reduce((obj, key) => obj && obj[key], this.getConfig());
    }

    // Método para verificar si una configuración existe
    hasConfig(path) {
        return this.getValue(path) !== undefined;
    }
}

module.exports = new ConfigLoader();
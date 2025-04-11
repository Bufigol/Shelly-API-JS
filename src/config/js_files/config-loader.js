// config/js_files/config-loader.js
const BaseConfigLoader = require("./base-config-loader");
const path = require("path");

class ConfigLoader extends BaseConfigLoader {
  constructor() {
    super();
    this.config = {};
    this.configPath = "../jsons/unified-config.json";
    this.loadConfiguration();
  }

  /**
   * Carga la configuración de la aplicación desde el archivo JSON unificado
   *
   * Primero, se verifica si la caché actual es válida. Si es así, se devuelve
   * inmediatamente la configuración en caché.
   *
   * Luego, se carga la configuración unificada y se determina el entorno actual
   * (desarrollo o producción) basado en el parámetro de configuración.
   *
   * @returns {Object} - Configuración cargada
   * @throws {Error} - Si hay errores al cargar o parsear el archivo de configuración
   */
  loadConfiguration() {
    try {
      if (this.isCacheValid()) {
        return this.cachedConfig;
      }

      // Cargar el archivo de configuración unificado
      const unifiedConfig = this.loadJsonFile(this.configPath);
      
      // Determinar el entorno actual (0 = desarrollo, 1 = producción)
      const currentEnv = unifiedConfig.environment.current;
      const envLabel = unifiedConfig.environment.labels[currentEnv];
      
      console.log(`Cargando configuración para entorno: ${envLabel}`);
      
      // Construir objeto de configuración
      this.config = {
        // Configuración de base de datos según el entorno
        database: unifiedConfig.database[envLabel],
        
        // Mantener referencia para compatibilidad con código existente
        databases: {
          main: unifiedConfig.database[envLabel]
        },
        
        // Configuración de API
        api: unifiedConfig.api.shelly_cloud,
        
        // Configuración de recolección
        collection: {
          interval: unifiedConfig.api.shelly_cloud.collection_interval,
          retryAttempts: 3,
          retryDelay: 5000,
        },
        
        // Configuración de Ubibot
        ubibot: {
          accountKey: unifiedConfig.ubibot.account_key,
          tokenFile: unifiedConfig.ubibot.token_file,
          excludedChannels: unifiedConfig.ubibot.excluded_channels,
          collectionInterval: unifiedConfig.ubibot.collection_interval,
        },
        
        // Configuración de Email
        email: {
          SENDGRID_API_KEY: unifiedConfig.email.sendgrid_api_key,
          email_contacto: unifiedConfig.email.email_contacto
        },
        
        // Configuración de SMS
        sms: unifiedConfig.sms,
        
        // Configuración de JWT
        jwt: {
          secret: unifiedConfig.jwt.secret,
          issuer: unifiedConfig.jwt.issuer,
          expiresIn: unifiedConfig.jwt.expires_in
        },
        
        // Configuración de mediciones
        measurement: {
          precio_kwh: unifiedConfig.precios_energia.precio_kwh.valor,
          intervalos: {
            medicion: 10,
            max_desviacion: 2,
            actualizacion: {
              hora: unifiedConfig.precios_energia.configuracion_calculo.intervalo_actualizacion_promedios.hora,
              dia: unifiedConfig.precios_energia.configuracion_calculo.intervalo_actualizacion_promedios.dia,
              mes: unifiedConfig.precios_energia.configuracion_calculo.intervalo_actualizacion_promedios.mes,
            },
          },
          calidad: {
            umbral_minimo: 0.8,
            max_intentos: 3,
            tiempo_espera: 5000,
          },
          zona_horaria: unifiedConfig.precios_energia.metadatos.zona_horaria,
          proveedor: unifiedConfig.precios_energia.metadatos.proveedor_energia,
          tipo_tarifa: unifiedConfig.precios_energia.metadatos.tipo_tarifa,
        },
        
        // Sistema de alertas
        alertSystem: unifiedConfig.alertSystem,
        
        // Información de la aplicación
        appName: unifiedConfig.appInfo.appName,
        companyName: unifiedConfig.appInfo.companyName,
        
        // Metadatos
        environment: {
          current: currentEnv,
          name: envLabel
        }
      };

      this.validateConfig();

      // Actualizar caché
      this.cachedConfig = this.config;
      this.lastLoadTime = Date.now();

      console.log(`✅ Configuración cargada correctamente (Entorno: ${envLabel})`);
      return this.config;
    } catch (error) {
      throw new Error(`Error al cargar la configuración: ${error.message}`);
    }
  }

  /**
   * Cambia el entorno actual (desarrollo/producción) y recarga la configuración
   * 
   * @param {number} envIndex - 0 para desarrollo, 1 para producción
   * @returns {Object} - La nueva configuración cargada
   */
  changeEnvironment(envIndex) {
    try {
      // Cargar el archivo de configuración unificado
      const unifiedConfig = this.loadJsonFile(this.configPath);
      
      // Validar el índice de entorno
      if (envIndex !== 0 && envIndex !== 1) {
        throw new Error("El índice de entorno debe ser 0 (desarrollo) o 1 (producción)");
      }
      
      // Actualizar el índice de entorno
      unifiedConfig.environment.current = envIndex;
      
      // Guardar el archivo actualizado
      const filePath = path.join(__dirname, this.configPath);
      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(unifiedConfig, null, 2), 'utf8');
      
      // Limpiar caché y recargar
      this.cachedConfig = null;
      this.lastLoadTime = null;
      
      return this.loadConfiguration();
    } catch (error) {
      throw new Error(`Error al cambiar de entorno: ${error.message}`);
    }
  }

  /**
   * Validates the application's configuration to ensure all required fields are present.
   *
   * This method performs a comprehensive validation of several critical parts
   * of the application configuration, including database settings, API details,
   * measurement configurations, Ubibot settings, and JWT secret configuration.
   *
   * @throws {Error} If any required configuration fields are missing.
   */
  validateConfig() {
    // Validación de base de datos
    const dbConfig = this.config.database;
    if (!dbConfig.host || !dbConfig.port || !dbConfig.database || !dbConfig.username) {
      throw new Error("Faltan campos requeridos en la configuración de base de datos");
    }

    // Validación de configuración de API
    const { api } = this.config;
    if (!api.url || !api.device_id || !api.auth_key) {
      throw new Error("Faltan campos requeridos en la configuración de API");
    }

    // Validación de configuración de mediciones
    const { measurement } = this.config;
    if (!measurement.precio_kwh || !measurement.intervalos.medicion) {
      throw new Error("Faltan campos requeridos en la configuración de mediciones");
    }

    // Validación de configuración de Ubibot
    const { ubibot } = this.config;
    if (!ubibot.accountKey || !ubibot.tokenFile) {
      throw new Error("Faltan campos requeridos en la configuración de Ubibot");
    }

    // Validación de configuración JWT
    if (!this.config.jwt.secret) {
      throw new Error("Falta la configuración del secreto JWT");
    }

    // Validación configuración SMS
    const { sms } = this.config;
    if (sms) {
      // Verificar configuración del módem
      if (!sms.modem || !sms.modem.url) {
        console.warn("⚠️ Configuración de módem SMS incompleta");
      }

      // Verificar configuración de horario laboral
      if (!sms.workingHours ||
        !sms.workingHours.weekdays ||
        !sms.workingHours.saturday) {
        console.warn("⚠️ Configuración de horario laboral SMS incompleta");
      }
    } else {
      console.warn("⚠️ No se ha encontrado configuración SMS");
    }

    // Verificar configuración de email
    const { email } = this.config;
    if (!email || !email.SENDGRID_API_KEY) {
      console.warn("⚠️ No se encontró configuración de SendGrid o está incompleta");
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
  
  /**
   * Obtiene el entorno actual (desarrollo/producción)
   * @returns {Object} Información del entorno actual
   */
  getCurrentEnvironment() {
    return {
      index: this.config.environment.current,
      name: this.config.environment.name
    };
  }
}

// Exporta una única instancia para mantener el patrón Singleton
module.exports = new ConfigLoader();
// src/config/js_files/config-loader.js
const BaseConfigLoader = require("./base-config-loader");
const path = require("path");
const fs = require("fs");

class ConfigLoader extends BaseConfigLoader {
  constructor() {
    super();
    console.log("[ConfigLoader] Constructor: Creando instancia..."); // Log 1
    this.config = {};
    // Definir configPath ANTES de llamar a ensureDirectoryExists o loadConfiguration
    // Ajusta esta ruta relativa si es necesario, basándose en la ubicación de config-loader.js
    // Asumiendo que config-loader.js está en src/config/js_files y el JSON en src/config/jsons
    this.configPath = "../jsons/unified-config.json";
    this.currentConfigPath = null; // Inicializar

    this.ensureDirectoryExists();
    console.log("[ConfigLoader] Constructor: Llamando a loadConfiguration inicial..."); // Log 2
    try {
      this.loadConfiguration(); // Carga inicial
    } catch (error) {
      // Es crucial manejar el error aquí también, porque si falla en el constructor,
      // la instancia exportada podría estar en un estado inválido.
      console.error("💥 [ConfigLoader] ¡ERROR CRÍTICO DURANTE LA CARGA INICIAL EN EL CONSTRUCTOR!", error.message);
      // Podríamos lanzar el error para detener la aplicación inmediatamente,
      // o marcar la instancia como inválida. Lanzar es más seguro para evitar
      // que la aplicación continúe con una configuración faltante.
      throw error; // Detener si la carga inicial falla.
    }
  }

  /**
   * Asegura que el directorio de configuración existe
   * @private
   */
  ensureDirectoryExists() {
    // Construir la ruta absoluta basada en la ubicación de este archivo (__dirname)
    const absoluteConfigDir = path.resolve(__dirname, path.dirname(this.configPath));
    console.log(`[ConfigLoader] ensureDirectoryExists: Verificando directorio: ${absoluteConfigDir}`); // Log

    if (!fs.existsSync(absoluteConfigDir)) {
      try {
        console.log(`[ConfigLoader] ensureDirectoryExists: Creando directorio: ${absoluteConfigDir}`); // Log
        fs.mkdirSync(absoluteConfigDir, { recursive: true });
        console.log(`[ConfigLoader] ensureDirectoryExists: Directorio creado con éxito.`); // Log
      } catch (error) {
        // Este error es serio, ya que podría impedir guardar/leer config.
        console.error(`❌ [ConfigLoader] Error CRÍTICO al crear directorio ${absoluteConfigDir}:`, error.message);
        // Podría ser necesario lanzar un error aquí si el directorio es indispensable.
        // throw new Error(`No se pudo crear el directorio de configuración: ${error.message}`);
      }
    } else {
      console.log(`[ConfigLoader] ensureDirectoryExists: El directorio ya existe.`); // Log
    }
  }


  /**
   * Busca el archivo de configuración en varias ubicaciones posibles
   * @returns {string|null} - Ruta absoluta al archivo de configuración o null si no se encuentra
   * @private
   */
  findConfigFile() {
    console.log("[ConfigLoader] findConfigFile: Buscando archivo de configuración..."); // Log
    // Construye rutas absolutas desde la ubicación actual de este archivo
    const possiblePaths = [
      path.resolve(__dirname, this.configPath), // Ruta relativa definida en constructor
      path.resolve(__dirname, "..", "jsons", "unified-config.json"), // Asumiendo estructura src/config/jsons
      // Puedes añadir más rutas absolutas o relativas si es necesario
      // path.resolve(__dirname, "../../unified-config.json"), // Ejemplo: En la raíz del proyecto
    ];

    for (const filePath of possiblePaths) {
      console.log(`[ConfigLoader] findConfigFile: Verificando ruta: ${filePath}`); // Log
      if (fs.existsSync(filePath)) {
        console.log(`[ConfigLoader] findConfigFile: Archivo encontrado en: ${filePath}`); // Log
        return filePath; // Devuelve la ruta absoluta encontrada
      }
    }

    console.error("[ConfigLoader] findConfigFile: ¡Archivo de configuración unified-config.json no encontrado en las rutas esperadas!"); // Log de error
    return null;
  }


  /**
   * Carga la configuración de la aplicación desde el archivo JSON unificado
   *
   * @returns {Object} - Configuración cargada
   * @throws {Error} - Si hay errores al cargar o parsear el archivo de configuración
   */
  loadConfiguration() {
    // Loguear inicio de carga/recarga
    const action = this.cachedConfig ? "Recargando" : "Cargando";
    console.log(`[ConfigLoader] loadConfiguration: ${action} configuración...`); // Log 3 (Modificado)
    try {
      if (this.isCacheValid()) {
        console.log("[ConfigLoader] loadConfiguration: Usando configuración en caché (válida)."); // Log 4a
        return this.cachedConfig;
      }
      console.log("[ConfigLoader] loadConfiguration: Caché inválida o inexistente, leyendo archivo..."); // Log 4b

      const configFilePath = this.findConfigFile();
      // findConfigFile ahora devuelve ruta absoluta o null
      if (!configFilePath) {
        // Lanzar error si no se encontró el archivo
        throw new Error("No se encontró el archivo de configuración unificada (unified-config.json).");
      }
      console.log(`[ConfigLoader] loadConfiguration: Leyendo archivo desde: ${configFilePath}`); // Log 5

      const configData = fs.readFileSync(configFilePath, "utf8");
      console.log("[ConfigLoader] loadConfiguration: Archivo leído, parseando JSON..."); // Log 6
      const unifiedConfig = JSON.parse(configData);
      console.log("[ConfigLoader] loadConfiguration: JSON parseado correctamente."); // Log 7

      // Determinar el entorno actual (0 = desarrollo, 1 = producción)
      const currentEnvIndex = unifiedConfig.environment?.current ?? 0; // Default a 0 si no existe
      const envLabels = unifiedConfig.environment?.labels ?? ["development", "production"]; // Defaults
      // Validar índice
      const currentEnv = (currentEnvIndex === 0 || currentEnvIndex === 1) ? currentEnvIndex : 0;
      const envLabel = envLabels[currentEnv];

      console.log(`[ConfigLoader] loadConfiguration: Entorno detectado: ${envLabel} (índice: ${currentEnv})`); // Log

      // *** Leer secretos desde variables de entorno ***
      // Es crucial que estas variables de entorno estén definidas donde corra la app
      const dbPasswordDev = process.env.DB_DEV_PASS || unifiedConfig.database?.development?.password;
      const dbPasswordProd = process.env.DB_PROD_PASS || unifiedConfig.database?.production?.password;
      const sendgridApiKey = process.env.SENDGRID_API_KEY || unifiedConfig.email?.sendgrid_api_key;
      const jwtSecret = process.env.JWT_SECRET || unifiedConfig.jwt?.secret;
      const dbHostDev = process.env.DB_DEV_HOST || unifiedConfig.database?.development?.host;
      const dbUserDev = process.env.DB_DEV_USER || unifiedConfig.database?.development?.username;
      const dbHostProd = process.env.DB_PROD_HOST || unifiedConfig.database?.production?.host;
      const dbUserProd = process.env.DB_PROD_USER || unifiedConfig.database?.production?.username;
      // Añadir más variables de entorno según sea necesario (ej. Twilio SID/Token)

      // Construir objeto de configuración usando valores de entorno si existen
      this.config = {
        database: {
          ...(envLabel === 'development' ? unifiedConfig.database?.development : unifiedConfig.database?.production),
          host: envLabel === 'development' ? dbHostDev : dbHostProd,
          username: envLabel === 'development' ? dbUserDev : dbUserProd,
          password: envLabel === 'development' ? dbPasswordDev : dbPasswordProd,
        },
        api: {
          shelly_cloud: unifiedConfig.api?.shelly_cloud,
          mapbox: unifiedConfig.api?.mapbox,
        },
        collection: { // Asegurar que existe la sección antes de acceder
          interval: unifiedConfig.api?.shelly_cloud?.collection_interval ?? 10000, // Default 10s
          retryAttempts: 3,
          retryDelay: 5000,
        },
        ubibot: unifiedConfig.ubibot,
        email: {
          ...(unifiedConfig.email ?? {}), // Copiar base si existe
          SENDGRID_API_KEY: sendgridApiKey, // Sobrescribir con variable de entorno
        },
        sms: unifiedConfig.sms, // Asumiendo que no hay secretos aquí, si los hay, mover a env
        twilio: unifiedConfig.twilio, // Mover a env si contiene secretos
        jwt: {
          ...(unifiedConfig.jwt ?? {}),
          secret: jwtSecret, // Sobrescribir con variable de entorno
        },
        measurement: unifiedConfig.measurement,
        alertSystem: unifiedConfig.alertSystem,
        appInfo: unifiedConfig.appInfo,
        environment: { // Guardar el entorno resuelto
          current: currentEnv,
          name: envLabel
        }
      };

      // Guardar la ruta absoluta del archivo de configuración usado
      this.currentConfigPath = configFilePath;

      // Validar la configuración final construida
      this.validateConfig();
      console.log("[ConfigLoader] loadConfiguration: Configuración validada."); // Log 8

      // Actualizar caché
      this.cachedConfig = this.config;
      this.lastLoadTime = Date.now();

      console.log(`✅ [ConfigLoader] Configuración cargada y cacheadada correctamente (Entorno: ${envLabel})`); // Log 9
      return this.config;

    } catch (error) {
      // Loguear el error antes de relanzarlo
      console.error(`❌ [ConfigLoader] Error fatal al cargar/parsear la configuración: ${error.message}`);
      // Incluir detalles adicionales si es posible
      console.error(`   (Archivo intentado: ${this.currentConfigPath || 'No encontrado'})`);
      if (error instanceof SyntaxError) {
        console.error("   (El archivo unified-config.json podría tener un error de sintaxis JSON)");
      } else if (error.code === 'ENOENT') {
        console.error("   (Verifica que el archivo unified-config.json existe en las rutas buscadas)");
      }
      // Relanzar el error para que el proceso de arranque falle si la config es crítica
      throw new Error(`Error al cargar la configuración: ${error.message}`);
    }
  }

  /**
   * Cambia el entorno actual (desarrollo/producción) y recarga la configuración
   * IMPORTANTE: Modifica directamente el archivo unified-config.json
   *
   * @param {number} envIndex - 0 para desarrollo, 1 para producción
   * @returns {Object} - La nueva configuración cargada
   */
  changeEnvironment(envIndex) {
    console.log(`[ConfigLoader] changeEnvironment: Solicitado cambio a entorno índice ${envIndex}`); // Log
    try {
      // Validar índice de entorno
      if (envIndex !== 0 && envIndex !== 1) {
        throw new Error("El índice de entorno debe ser 0 (desarrollo) o 1 (producción)");
      }

      // Asegurarse de tener la ruta al archivo actual
      const configFilePath = this.currentConfigPath || this.findConfigFile();
      if (!configFilePath) {
        throw new Error("No se pudo encontrar el archivo de configuración para modificar el entorno.");
      }
      console.log(`[ConfigLoader] changeEnvironment: Modificando archivo: ${configFilePath}`); // Log

      // Leer el archivo de configuración actual
      const configData = fs.readFileSync(configFilePath, "utf8");
      const unifiedConfig = JSON.parse(configData);

      // Verificar si el cambio es necesario
      if (unifiedConfig.environment?.current === envIndex) {
        console.log(`[ConfigLoader] changeEnvironment: El entorno ya está establecido en ${envIndex}. No se necesita cambio.`); // Log
        // Devolver la config actual (puede requerir recarga si la caché expiró)
        return this.loadConfiguration();
      }

      // Actualizar el índice de entorno en el objeto
      if (!unifiedConfig.environment) unifiedConfig.environment = {}; // Crear si no existe
      unifiedConfig.environment.current = envIndex;

      // Guardar el archivo actualizado (formato JSON con indentación)
      fs.writeFileSync(configFilePath, JSON.stringify(unifiedConfig, null, 2), "utf8");
      console.log(`[ConfigLoader] changeEnvironment: Archivo unified-config.json actualizado con environment.current = ${envIndex}`); // Log

      // Limpiar caché y forzar recarga para aplicar el cambio inmediatamente
      this.cachedConfig = null;
      this.lastLoadTime = null;
      console.log("[ConfigLoader] changeEnvironment: Caché limpiada, recargando configuración..."); // Log

      return this.loadConfiguration(); // Devolver la nueva configuración cargada

    } catch (error) {
      console.error(`❌ [ConfigLoader] Error al cambiar de entorno a índice ${envIndex}:`, error.message);
      // Relanzar el error podría ser apropiado aquí, ya que el estado podría ser inconsistente
      throw new Error(`Error al cambiar de entorno: ${error.message}`);
    }
  }


  /**
   * Validates the application's configuration to ensure all required fields are present.
   * Modificado para usar this.config directamente.
   * @throws {Error} If any required configuration fields are missing.
   */
  validateConfig() {
    console.log("[ConfigLoader] validateConfig: Validando configuración cargada..."); // Log
    const configToValidate = this.config; // Usar la config ya construida en la instancia

    if (!configToValidate) {
      throw new Error("Intento de validar configuración antes de que se haya cargado.");
    }

    // Validación de base de datos
    const dbConfig = configToValidate.database;
    if (!dbConfig || !dbConfig.host || !dbConfig.port || !dbConfig.database || !dbConfig.username) {
      // La contraseña puede ser opcional o vacía en algunos casos, pero los otros son esenciales
      console.error("Error de Validación: Faltan campos requeridos en la configuración de base de datos:", dbConfig);
      throw new Error("Configuración de base de datos incompleta (host, port, database, username son requeridos)");
    }

    // Validación de configuración de API Shelly Cloud
    const shellyApi = configToValidate.api?.shelly_cloud;
    if (!shellyApi || !shellyApi.url || !shellyApi.device_id || !shellyApi.auth_key) {
      console.error("Error de Validación: Faltan campos requeridos en api.shelly_cloud:", shellyApi);
      throw new Error("Configuración de API Shelly Cloud incompleta (url, device_id, auth_key son requeridos)");
    }

    // Validación de configuración de mediciones (opcional, ajustar según criticidad)
    const measurement = configToValidate.measurement;
    if (!measurement || measurement.precio_kwh === undefined || !measurement.intervalos?.medicion) {
      // Permitir precio 0, pero debe estar definido
      console.warn("Advertencia de Validación: Configuración de mediciones incompleta (precio_kwh, intervalos.medicion).");
      // throw new Error("Configuración de mediciones incompleta"); // Descomentar si es crítico
    }

    // Validación de configuración de Ubibot (opcional, ajustar según criticidad)
    const ubibot = configToValidate.ubibot;
    if (!ubibot || !ubibot.accountKey || !ubibot.tokenFile) {
      console.warn("Advertencia de Validación: Configuración de Ubibot incompleta (accountKey, tokenFile).");
      // throw new Error("Configuración de Ubibot incompleta"); // Descomentar si es crítico
    }

    // Validación de configuración JWT
    if (!configToValidate.jwt || !configToValidate.jwt.secret) {
      // ¡Muy crítico! Sin secreto JWT, la autenticación fallará.
      console.error("Error de Validación CRÍTICO: Falta la configuración del secreto JWT (jwt.secret)");
      throw new Error("Falta la configuración del secreto JWT");
    }

    // Validación configuración SMS (opcional, ajustar según criticidad)
    const sms = configToValidate.sms;
    if (!sms || !sms.modem || !sms.modem.url) {
      console.warn("Advertencia de Validación: Configuración de SMS o URL del módem incompleta.");
      // throw new Error("Configuración de SMS incompleta (modem.url es requerido)"); // Descomentar si es crítico
    }

    // Verificar configuración de email (API Key ya se valida en loadConfiguration)
    const email = configToValidate.email;
    if (!email || !email.SENDGRID_API_KEY) {
      // Ya se valida que empiece con SG. en loadConfiguration, pero verificar existencia aquí también
      console.error("Error de Validación CRÍTICO: Falta la API Key de SendGrid (email.SENDGRID_API_KEY)");
      throw new Error("Falta la API Key de SendGrid en la configuración");
    } else if (!email.SENDGRID_API_KEY.startsWith("SG.")) {
      console.warn("Advertencia de Validación: La API Key de SendGrid no tiene el formato correcto.");
      // No lanzar error aquí, ya que se advirtió antes, pero es un posible problema.
    }
    if (!email.email_contacto?.from_verificado) {
      console.warn("Advertencia de Validación: Email remitente (email.email_contacto.from_verificado) no configurado.");
    }

    console.log("[ConfigLoader] validateConfig: Validación completada con éxito."); // Log
  }


  /**
   * Obtiene la configuración actual (cargándola si es necesario o usando caché)
   * @returns {Object} Configuración actual del sistema
   */
  getConfig() {
    // loadConfiguration maneja la caché internamente
    return this.loadConfiguration();
  }


  /**
   * Recarga todas las configuraciones invalidando la caché
   * @returns {Object} Nueva configuración del sistema
   */
  reloadConfig() {
    console.log("[ConfigLoader] reloadConfig: Solicitud de recarga manual, limpiando caché..."); // Log
    this.cachedConfig = null;
    this.lastLoadTime = null;
    return this.loadConfiguration(); // Forzar relectura
  }


  /**
   * Obtiene un valor específico de la configuración usando notación de punto
   * @param {string} path Ruta al valor (ejemplo: "database.host")
   * @returns {any} Valor encontrado en la ruta especificada o undefined si no existe
   */
  getValue(path) {
    if (!path || typeof path !== 'string') return undefined;

    try {
      // Usar la configuración actual (posiblemente de caché)
      const currentConfig = this.getConfig();
      // Reducir la ruta
      return path.split(".").reduce((obj, key) => {
        // Verificar que obj no sea null o undefined antes de acceder a la key
        return obj && obj[key] !== undefined ? obj[key] : undefined;
      }, currentConfig);
    } catch (error) {
      // Esto no debería ocurrir con el reduce seguro, pero por si acaso
      console.warn(`[ConfigLoader] getValue: Error al acceder a la ruta "${path}":`, error.message);
      return undefined;
    }
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
   * @returns {Object} Información del entorno actual { index: number, name: string }
   */
  getCurrentEnvironment() {
    // Asegurarse de que la config está cargada
    const currentConfig = this.getConfig();
    // Devolver el objeto de entorno guardado en la config
    return currentConfig.environment || { index: 0, name: 'development' }; // Fallback
  }


  /**
   * Actualiza un valor específico en el archivo de configuración unified-config.json
   * ¡PRECAUCIÓN! Modifica el archivo físico.
   * @param {string} path - Ruta al valor a actualizar (ejemplo: "email.email_contacto.from_verificado")
   * @param {any} value - Nuevo valor
   * @returns {boolean} - true si la actualización fue exitosa
   */
  updateConfigValue(path, value) {
    console.log(`[ConfigLoader] updateConfigValue: Solicitado actualizar "${path}" a "${value}"`); // Log
    try {
      // Necesitamos la ruta absoluta al archivo
      const configFilePath = this.currentConfigPath || this.findConfigFile();
      if (!configFilePath) {
        throw new Error("No se pudo encontrar el archivo de configuración para actualizar.");
      }
      console.log(`[ConfigLoader] updateConfigValue: Modificando archivo: ${configFilePath}`); // Log

      // Leer el archivo actual
      const configData = fs.readFileSync(configFilePath, "utf8");
      const unifiedConfig = JSON.parse(configData);

      // Dividir la ruta y navegar/crear nodos intermedios
      const parts = path.split(".");
      let current = unifiedConfig;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        // Si el nodo intermedio no existe o no es un objeto, crearlo
        if (!current[key] || typeof current[key] !== 'object') {
          console.log(`[ConfigLoader] updateConfigValue: Creando nodo intermedio "${key}" en la ruta.`); // Log
          current[key] = {};
        }
        current = current[key];
      }

      // Actualizar el valor final
      const finalKey = parts[parts.length - 1];
      current[finalKey] = value;
      console.log(`[ConfigLoader] updateConfigValue: Valor en "${path}" establecido.`); // Log

      // Guardar el archivo actualizado con formato
      fs.writeFileSync(configFilePath, JSON.stringify(unifiedConfig, null, 2), "utf8");
      console.log(`[ConfigLoader] updateConfigValue: Archivo guardado.`); // Log

      // Limpiar caché y forzar recarga para aplicar el cambio
      this.cachedConfig = null;
      this.lastLoadTime = null;
      console.log("[ConfigLoader] updateConfigValue: Caché limpiada, recargando configuración..."); // Log
      this.loadConfiguration(); // Recargar para actualizar la instancia en memoria

      console.log(`✅ [ConfigLoader] updateConfigValue: Valor "${path}" actualizado correctamente en archivo y memoria.`); // Log
      return true;
    } catch (error) {
      console.error(`❌ [ConfigLoader] Error al actualizar valor "${path}":`, error.message);
      // No relanzar para no detener la aplicación, pero indicar fallo
      return false;
    }
  }
}

// Exporta una única instancia para mantener el patrón Singleton
module.exports = new ConfigLoader();
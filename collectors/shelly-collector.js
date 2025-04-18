// collectors/shelly-collector.js

const fetch = require("node-fetch");
const configLoader = require("../src/config/js_files/config-loader");
const databaseService = require("../src/services/database-service");

class ShellyCollector {
  constructor() {
    console.log("[ShellyCollector] Constructor: Creando instancia...");
    // Inicializar propiedades a null o valores por defecto seguros.
    // La configuración real se cargará en _loadConfig().
    this.config = null;
    this.apiUrl = null;
    this.collectionInterval = 10000; // Default interval
    this.expectedInterval = 10000;
    this.maxIntervalDeviation = 2000;
    this.isRunning = false;
    this.intervalId = null;
    this.lastCollectionTime = null;
    this.lastMeasurement = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000;
    this.metrics = {
      successfulCollections: 0,
      failedCollections: 0,
      totalRetries: 0,
      lastError: null,
      lastSuccessTime: null,
    };
  }

  /**
   * Carga y valida la configuración necesaria para el colector.
   * Se llama antes de iniciar la recolección o al inicio de collect si es necesario.
   * Lanza un error si la configuración crítica falta.
   * @private
   * @throws {Error} Si falta configuración crítica.
   */
  _loadConfig() {
    // Cargar solo si aún no se ha cargado
    if (!this.config) {
      console.log("[ShellyCollector] _loadConfig: Cargando configuración...");
      const loadedConfig = configLoader.getConfig(); // Obtiene la config global ya cargada

      // Extraer y validar las secciones necesarias
      const apiConfig = loadedConfig.api?.shelly_cloud;
      const collectionConfig = loadedConfig.collection;

      // Validación estricta de la configuración requerida
      if (!apiConfig || !apiConfig.url || !apiConfig.device_id || !apiConfig.auth_key) {
        const errorMsg = "Configuración API Shelly Cloud (api.shelly_cloud) incompleta o faltante en unified-config.json.";
        console.error(`❌ [ShellyCollector] _loadConfig: ${errorMsg}`);
        throw new Error(errorMsg); // Detener si falta config crítica
      }
      if (!collectionConfig || collectionConfig.interval === undefined) {
        console.warn("⚠️ [ShellyCollector] _loadConfig: collection.interval no definido, usando default 10000ms.");
        this.collectionInterval = 10000;
      } else {
        this.collectionInterval = parseInt(collectionConfig.interval, 10); // Asegurar que es número
        if (isNaN(this.collectionInterval) || this.collectionInterval <= 0) {
          console.warn(`⚠️ [ShellyCollector] _loadConfig: collection.interval inválido (${collectionConfig.interval}), usando default 10000ms.`);
          this.collectionInterval = 10000;
        }
      }
      // Podríamos añadir validación para expectedInterval, maxIntervalDeviation, etc. si vienen de config

      // Guardar la configuración relevante
      this.config = {
        api: apiConfig,
        collection: { // Asegurar defaults si no vienen de config
          interval: this.collectionInterval,
          expectedInterval: this.expectedInterval,
          maxIntervalDeviation: this.maxIntervalDeviation,
          maxRetries: this.maxRetries,
          retryDelay: this.retryDelay
        }
      };

      // Construir la URL aquí, *después* de validar que apiConfig existe y tiene url
      this.apiUrl = `${this.config.api.url}?id=${this.config.api.device_id}&auth_key=${this.config.api.auth_key}`;

      // Validar que la URL construida sea absoluta
      if (!this.apiUrl.toLowerCase().startsWith('http')) {
        const errorMsg = `La URL de Shelly construida no es absoluta: ${this.apiUrl}`;
        console.error(`❌ [ShellyCollector] _loadConfig: ${errorMsg}`);
        this.apiUrl = null; // Invalidar URL
        throw new Error(errorMsg); // Detener
      }

      console.log(`[ShellyCollector] _loadConfig: Configuración cargada. API URL base: ${this.config.api.url}. Intervalo: ${this.collectionInterval}ms`);
    } else {
      console.log("[ShellyCollector] _loadConfig: Configuración ya estaba cargada."); // Opcional: log si ya estaba cargada
    }
  }


  /**
   * Valida campos numéricos en un objeto.
   * @param {Object} data - El objeto a validar.
   * @param {string} [prefix=""] - Prefijo opcional para las claves resultantes.
   * @returns {Object} - Objeto con campos validados como números (o 0 si no son válidos).
   */
  validateNumericFields(data, prefix = "") {
    const result = {};
    // Verificar si data es un objeto válido
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "number" && !isNaN(value)) { // Asegurar que no es NaN
          result[`${prefix}${key}`] = value;
        } else if (value !== null && value !== undefined) {
          const parsed = parseFloat(value);
          result[`${prefix}${key}`] = isNaN(parsed) ? 0 : parsed; // Default a 0 si no es número válido
        } else {
          result[`${prefix}${key}`] = 0; // Default a 0 para null o undefined
        }
      }
    } else {
      console.warn(`[ShellyCollector] validateNumericFields: Se recibió data inválida (no es objeto):`, data);
    }
    return result;
  }

  /**
   * Inicia el proceso de recolección de datos.
   */
  async start() {
    if (this.isRunning) {
      console.log("[ShellyCollector] El colector ya está corriendo.");
      return;
    }
    console.log("🚀 Starting Shelly data collector...");
    try {
      // Cargar y validar configuración ANTES de empezar cualquier ciclo
      this._loadConfig();

      this.isRunning = true;
      await this.collect(); // Primera recolección inmediata

      // Iniciar el intervalo solo si la configuración e inicio fueron exitosos
      this.intervalId = setInterval(
        () => this.collect(),
        this.collectionInterval
      );

    } catch (error) {
      // Captura errores de _loadConfig o del primer collect
      console.error("❌ [ShellyCollector] Error crítico durante el inicio:", error.message);
      this.isRunning = false; // Asegurar que no quede en estado 'running'
      // Considerar si se debe intentar reiniciar o simplemente detenerse.
      // Por ahora, se detiene.
    }
  }

  /**
   * Detiene el proceso de recolección.
   */
  stop() {
    if (!this.isRunning) {
      console.log("[ShellyCollector] El colector no estaba corriendo.");
      return;
    }
    console.log("🛑 Stopping Shelly data collector...");
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[ShellyCollector] Intervalo detenido.");
    }
    this.isRunning = false;
    this.printCollectionStats();
  }

  /**
   * Evalúa la calidad de la lectura basado en el intervalo de tiempo.
   * @param {number} currentTimestamp - Timestamp actual en ms.
   * @returns {'GOOD' | 'SUSPECT' | 'BAD'} - Calidad de la lectura.
   */
  evaluateReadingQuality(currentTimestamp) {
    if (this.lastCollectionTime === null) {
      return "GOOD"; // Primera lectura siempre es buena en términos de intervalo
    }

    const interval = currentTimestamp - this.lastCollectionTime;
    const expected = this.config?.collection?.expectedInterval ?? this.expectedInterval; // Usar valor de config si existe
    const maxDeviation = this.config?.collection?.maxIntervalDeviation ?? this.maxIntervalDeviation;

    const deviation = Math.abs(interval - expected);

    if (deviation <= maxDeviation) {
      return "GOOD";
    } else if (deviation <= maxDeviation * 2) {
      return "SUSPECT"; // Intervalo más largo o corto de lo normal
    } else {
      return "BAD"; // Intervalo muy desviado
    }
  }

  /**
   * Realiza un ciclo de recolección de datos.
   */
  async collect() {
    // Verificar estado de ejecución
    if (!this.isRunning) {
      console.warn("[ShellyCollector] collect() llamado pero el colector no está corriendo.");
      return;
    }

    // Asegurar que la configuración está cargada (salvaguarda)
    if (!this.config) {
      try {
        this._loadConfig();
      } catch (configError) {
        console.error("❌ [ShellyCollector] Error fatal al cargar config en collect:", configError.message);
        // Detener el colector si la configuración falla consistentemente
        this.stop();
        return;
      }
    }

    const currentTimestamp = Date.now();
    

    try {
      // 1. Obtener Datos
      const data = await this.fetchDeviceData();

      // 2. Validar Respuesta API
      if (!this.validateApiResponse(data)) {
        throw new Error("Respuesta inválida de la API Shelly");
      }

      // 3. Enriquecer Datos
      const enrichedData = this.enrichData(data, currentTimestamp);

      // 4. Guardar Datos
      await this.saveData(enrichedData);

      // 5. Éxito: Actualizar Estado y Métricas
      
      this.updateMetrics(true, currentTimestamp);
      this.lastCollectionTime = currentTimestamp;
      this.lastMeasurement = enrichedData;
      this.retryCount = 0; // Resetear contador de reintentos en éxito

    } catch (error) {
      // 6. Error: Manejar Error y Reintentos
      // handleCollectionError se encargará de loguear y decidir si reintentar
      this.handleCollectionError(error);
    }
  }

  /**
   * Obtiene los datos del dispositivo desde la API de Shelly.
   * @returns {Promise<Object>} - Datos del dispositivo.
   * @throws {Error} Si la URL no está inicializada, la llamada falla o la respuesta no es OK.
   */
  async fetchDeviceData() {
    if (!this.apiUrl) {
      console.error("❌ [ShellyCollector] fetchDeviceData: apiUrl no está inicializado.");
      throw new Error("Collector no inicializado correctamente (apiUrl falta).");
    }
    // La validación de URL absoluta ya se hizo en _loadConfig

    
    let response;
    try {
      response = await fetch(this.apiUrl, {
        // Considerar añadir timeout si node-fetch lo soporta o usar AbortController
        // signal: AbortSignal.timeout(15000) // Ejemplo con AbortController (Node 16+)
        // O usar axios que tiene timeout incorporado
        timeout: this.config?.collection?.timeout ?? 15000 // Timeout ejemplo (no estándar en node-fetch)
      });
    } catch (fetchError) {
      // Capturar errores de red/DNS/timeout
      console.error(`❌ [ShellyCollector] fetchDeviceData: Error de red/fetch: ${fetchError.message}`);
      throw new Error(`Error de red al contactar Shelly API: ${fetchError.message}`);
    }


    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No se pudo leer el cuerpo del error');
      console.error(`❌ [ShellyCollector] fetchDeviceData: Error API ${response.status} ${response.statusText}. Body: ${errorText.substring(0, 100)}`);
      throw new Error(`Error API Shelly: ${response.status} ${response.statusText}`);
    }

    try {
      
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.error(`❌ [ShellyCollector] fetchDeviceData: Error parseando JSON de respuesta: ${jsonError.message}`);
      throw new Error(`Respuesta inválida de Shelly API (no es JSON): ${jsonError.message}`);
    }
  }

  /**
   * Valida la estructura básica de la respuesta de la API.
   * @param {Object} data - Datos de la respuesta.
   * @returns {boolean} - True si la estructura es válida.
   */
  validateApiResponse(data) {
    if (!data || data.isok !== true || !data.data || typeof data.data.device_status !== 'object') {
      console.error(
        "❌ [ShellyCollector] validateApiResponse: Estructura de respuesta API inválida:",
        JSON.stringify(data, null, 2).substring(0, 500) // Loguear parte de la respuesta
      );
      return false;
    }
    return true;
  }

  /**
   * Enriquece los datos crudos con información adicional (timestamps, calidad).
   * @param {Object} data - Datos crudos de la API.
   * @param {number} timestamp - Timestamp de la recolección.
   * @returns {Object} - Datos enriquecidos.
   */
  enrichData(data, timestamp) {
    const deviceStatus = data.data.device_status || {}; // Asegurar que existe
    const emData = deviceStatus["em:0"] || {};
    const tempData = deviceStatus["temperature:0"] || {};
    const emdData = deviceStatus["emdata:0"] || {}; // Probablemente 'emdat:0'? Verificar API Shelly

    const validatedEmData = {
      ...this.validateNumericFields(emData),
      // La validación de energía se hará directamente aquí para más claridad
      a_total_act_energy: this.getEnergyValue(emData, "a_total_act_energy"), // Revisar nombres exactos en API
      b_total_act_energy: this.getEnergyValue(emData, "b_total_act_energy"),
      c_total_act_energy: this.getEnergyValue(emData, "c_total_act_energy"),
      // Añadir más campos de energía si son necesarios
      total_act_energy: this.getEnergyValue(emData, "total_act"), // O total_act_energy? Verificar API
    };

    return {
      device_status: {
        ...deviceStatus, // Mantener otros campos originales
        id: deviceStatus.id, // Asegurar que el ID está presente
        reading_quality: this.evaluateReadingQuality(timestamp),
        collection_timestamp: timestamp,
        interval_ms: this.lastCollectionTime ? timestamp - this.lastCollectionTime : (this.config?.collection?.expectedInterval ?? this.expectedInterval),
        // Añadir unixtime de forma segura
        sys: deviceStatus.sys ? { ...deviceStatus.sys, unixtime: Math.floor(timestamp / 1000) } : { unixtime: Math.floor(timestamp / 1000) },
        // Usar los datos validados
        "em:0": validatedEmData,
        "temperature:0": this.validateNumericFields(tempData),
        // Verificar el nombre correcto 'emdata:0' o 'emdat:0'
        "emdata:0": this.validateNumericFields(emdData),
      },
    };
  }

  /**
   * Obtiene y valida un valor numérico de energía.
   * @param {Object} data - Objeto contenedor.
   * @param {string} field - Nombre del campo.
   * @returns {number} - Valor numérico o 0.
   */
  getEnergyValue(data, field) {
    // Verificar que data es un objeto antes de acceder a field
    const value = (data && typeof data === 'object') ? data[field] : undefined;
    if (value === null || value === undefined) return 0; // Considerar null/undefined como 0
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Guarda los datos enriquecidos en la base de datos.
   * @param {Object} data - Datos enriquecidos.
   * @returns {Promise<Object>} - Resultado de la inserción.
   */
  async saveData(data) {
    
    try {
      // Pasar directamente el objeto enriquecido, databaseService se encarga de extraer
      const result = await databaseService.insertDeviceStatus(data);
      if (result?.success) {
        
      } else {
        // Loguear el mensaje de error de insertDeviceStatus si existe
        console.error(`[ShellyCollector] Fallo al guardar datos: ${result?.message || 'Error desconocido en DB Service'}`);
        // Lanzar un error para que sea capturado por el 'catch' de collect si el guardado es crítico
        throw new Error(result?.message || 'Fallo al guardar datos en la base de datos');
      }
      return result;
    } catch (error) {
      // Captura errores lanzados por databaseService o la conexión
      console.error(`❌ [ShellyCollector] Error CRÍTICO al guardar datos: ${error.message}`);
      // Relanzar para que sea manejado por handleCollectionError
      throw error;
    }
  }

  /**
   * Actualiza las métricas de recolección.
   * @param {boolean} success - Indica si la recolección fue exitosa.
   * @param {number} timestamp - Timestamp de la operación.
   * @param {string|null} [errorMessage=null] - Mensaje de error si success es false.
   */
  updateMetrics(success, timestamp, errorMessage = null) {
    if (success) {
      this.metrics.successfulCollections++;
      this.metrics.lastSuccessTime = timestamp;
      // Limpiar último error en caso de éxito
      // this.metrics.lastError = null; // Opcional: limpiar último error en éxito
    } else {
      this.metrics.failedCollections++;
      // Guardar el mensaje de error específico
      this.metrics.lastError = errorMessage || "Error desconocido durante la recolección";
    }
  }

  /**
   * Maneja errores ocurridos durante el ciclo de recolección y gestiona reintentos.
   * @param {Error} error - El error ocurrido.
   */
  async handleCollectionError(error) {
    // Actualizar métricas con el mensaje de error específico
    this.updateMetrics(false, Date.now(), error.message);
    // Loguear el error
    console.error(`❌ [ShellyCollector] Error en ciclo de recolección: ${error.message}`);
    // Loguear stack trace si está disponible y estamos en desarrollo (opcional)
    // if (process.env.NODE_ENV === 'development' && error.stack) {
    //    console.error(error.stack);
    // }

    // Incrementar contador de reintento y métrica general
    this.retryCount++;
    this.metrics.totalRetries++;

    // Verificar si quedan reintentos
    const maxRetries = this.config?.collection?.maxRetries ?? this.maxRetries; // Usar config si existe
    const retryDelay = this.config?.collection?.retryDelay ?? this.retryDelay; // Usar config si existe

    if (this.retryCount <= maxRetries) {
      const delaySeconds = (retryDelay / 1000);
      console.log(`🔄 [ShellyCollector] Reintento ${this.retryCount}/${maxRetries} en ${delaySeconds}s...`);
      // Esperar antes de reintentar
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      // Llamar a collect() de nuevo para reintentar.
      // No se necesita 'await' aquí porque el intervalo principal seguirá corriendo.
      // Si el error persiste, el próximo intento será manejado por esta misma función.
      // Llamar a collect directamente podría causar un bucle si el error es instantáneo.
      // Es mejor dejar que el intervalo principal lo llame de nuevo,
      // o si queremos reintento inmediato, asegurarse de que no cause bucle infinito.
      // Por simplicidad y seguridad, dejaremos que el intervalo principal reintente.
      // Ajuste: Si queremos reintento activo, llamamos a collect.
      // await this.collect(); // Descomentar para reintento activo inmediato tras delay

    } else {
      console.error(`❌ [ShellyCollector] Máximo de reintentos (${maxRetries}) alcanzado para este error. Esperando al próximo ciclo del intervalo.`);
      // Resetear contador para el próximo ciclo principal del interval
      this.retryCount = 0;
      // Considerar enviar una notificación aquí si los fallos persistentes son críticos
    }
  }

  /**
   * Imprime estadísticas de recolección en la consola.
   */
  printCollectionStats() {
    console.log("\n📊 Shelly Collection Statistics:");
    console.log(`- Successful collections: ${this.metrics.successfulCollections}`);
    console.log(`- Failed collections: ${this.metrics.failedCollections}`);
    console.log(`- Total retries: ${this.metrics.totalRetries}`);
    const totalAttempts = this.metrics.successfulCollections + this.metrics.failedCollections;
    if (totalAttempts > 0) {
      const successRate = (this.metrics.successfulCollections / totalAttempts) * 100;
      console.log(`- Success rate: ${successRate.toFixed(2)}%`);
    } else {
      console.log("- Success rate: N/A (no attempts yet)");
    }
    console.log(`- Last successful collection: ${this.metrics.lastSuccessTime ? new Date(this.metrics.lastSuccessTime).toISOString() : "Never"}`);
    if (this.metrics.lastError) {
      console.log(`- Last error: ${this.metrics.lastError}`);
    }
  }

  /**
   * Obtiene estadísticas del colector.
   * @returns {Object} - Estadísticas actuales.
   */
  getCollectorStats() {
    return {
      isRunning: this.isRunning,
      lastCollectionTime: this.lastCollectionTime,
      ...this.metrics,
      expectedInterval: this.config?.collection?.expectedInterval ?? this.expectedInterval,
      maxIntervalDeviation: this.config?.collection?.maxIntervalDeviation ?? this.maxIntervalDeviation,
      lastMeasurementQuality: this.lastMeasurement?.device_status?.reading_quality, // Acceso seguro
      apiUrlBase: this.config?.api?.url, // Info útil para diagnóstico
      collectionInterval: this.collectionInterval,
    };
  }
}

module.exports = ShellyCollector;
// collectors/ubibot-collector.js

const configLoader = require("../src/config/js_files/config-loader"); // Corregido: usar configLoader
const ubibotController = require("../src/controllers/ubibotController");
const ubibotService = require("../src/services/ubibotService");
// databaseService, emailService, smsService no son usados directamente aquí
const notificationController = require("../src/controllers/notificationController");

// --- Constantes del Colector ---
const DEFAULT_COLLECTION_INTERVAL_MS = 240000; // 4 minutos como default si no está en config
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 5000;
const DISCONNECTION_THRESHOLD_MINUTES = 95; // Límite para loguear desconexión por tiempo

class UbibotCollector {
  constructor() {
    console.log("[UbibotCollector] Constructor: Creando instancia...");
    // Inicializar propiedades a null o valores por defecto seguros.
    this.config = null; // Se cargará en _loadConfig
    this.collectionInterval = DEFAULT_COLLECTION_INTERVAL_MS;
    this.isRunning = false;
    this.intervalId = null;
    this.retryCount = 0;
    this.maxRetries = DEFAULT_MAX_RETRIES;
    this.retryDelay = DEFAULT_RETRY_DELAY_MS;
    this.metrics = {
      successfulCollections: 0,
      failedCollections: 0,
      totalRetries: 0,
      lastError: null,
      lastSuccessTime: null,
      channelsProcessed: 0,
      channelsFailed: 0,
    };
  }

  /**
   * Carga y valida la configuración específica para el colector Ubibot.
   * Se llama antes de iniciar la recolección o al inicio de collect si es necesario.
   * Lanza un error si la configuración crítica falta.
   * @private
   * @throws {Error} Si falta configuración crítica.
   */
  _loadConfig() {
    if (!this.config) {
      console.log("[UbibotCollector] _loadConfig: Cargando configuración...");
      const appConfig = configLoader.getConfig(); // Obtiene la config global
      const ubibotConfig = appConfig.ubibot;

      // Validar configuración de Ubibot
      if (!ubibotConfig) {
        const errorMsg = "Sección 'ubibot' faltante en la configuración.";
        console.error(`❌ [UbibotCollector] _loadConfig: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Asignar valores de configuración a propiedades de la instancia
      this.collectionInterval = ubibotConfig.collectionInterval ?? DEFAULT_COLLECTION_INTERVAL_MS;
      // Podríamos cargar maxRetries y retryDelay desde config si existieran allí
      // this.maxRetries = ubibotConfig.maxRetries ?? DEFAULT_MAX_RETRIES;
      // this.retryDelay = ubibotConfig.retryDelay ?? DEFAULT_RETRY_DELAY_MS;

      // Validar intervalo
      if (isNaN(parseInt(this.collectionInterval)) || this.collectionInterval <= 0) {
        console.warn(`⚠️ [UbibotCollector] _loadConfig: collectionInterval inválido (${ubibotConfig.collectionInterval}), usando default ${DEFAULT_COLLECTION_INTERVAL_MS}ms.`);
        this.collectionInterval = DEFAULT_COLLECTION_INTERVAL_MS;
      }

      // Guardar la sección de config relevante si se necesita más adelante
      this.config = ubibotConfig;

      console.log(`[UbibotCollector] _loadConfig: Configuración cargada. Intervalo: ${this.collectionInterval}ms`);
    }
  }

  /**
   * Inicia el proceso de recolección de datos Ubibot.
   */
  async start() {
    if (this.isRunning) {
      console.log("[UbibotCollector] El colector ya está corriendo.");
      return;
    }
    console.log("🚀 Starting Ubibot data collector...");
    try {
      // Cargar y validar configuración ANTES de empezar cualquier ciclo
      this._loadConfig();

      this.isRunning = true;
      console.log(`[UbibotCollector] Iniciando primer ciclo de recolección... Intervalo: ${this.collectionInterval}ms`);
      await this.collect(); // Primera recolección inmediata

      // Iniciar el intervalo
      this.intervalId = setInterval(
        () => this.collect(),
        this.collectionInterval
      );
      console.log("[UbibotCollector] Intervalo de recolección iniciado.");

    } catch (error) {
      // Captura errores de _loadConfig o del primer collect
      console.error("❌ [UbibotCollector] Error crítico durante el inicio:", error.message);
      this.isRunning = false;
    }
  }

  /**
   * Detiene el proceso de recolección.
   */
  stop() {
    if (!this.isRunning) {
      console.log("[UbibotCollector] El colector no estaba corriendo.");
      return;
    }
    console.log("🛑 Stopping Ubibot data collector...");
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[UbibotCollector] Intervalo detenido.");
    }
    this.isRunning = false;
    this.printCollectionStats();
  }

  /**
   * Realiza un ciclo completo de recolección de datos para todos los canales Ubibot.
   */
  async collect() {
    // Verificar estado de ejecución
    if (!this.isRunning) {
      console.warn("[UbibotCollector] collect() llamado pero el colector no está corriendo.");
      return;
    }
    // Asegurar que la configuración está cargada (salvaguarda)
    if (!this.config) {
      try { this._loadConfig(); } catch (configError) {
        console.error("❌ [UbibotCollector] Error fatal al cargar config en collect:", configError.message);
        this.stop(); // Detener si la config falla
        return;
      }
    }

    console.log(`\n📥 [UbibotCollector] Iniciando ciclo de recolección Ubibot... (${new Date().toISOString()})`);
    let cycleErrors = false; // Para rastrear si hubo errores en algún canal
    this.metrics.channelsProcessed = 0;
    this.metrics.channelsFailed = 0;

    try {
      // 1. Obtener lista de canales
      const channels = await ubibotController.getChannels();

      if (!channels || channels.length === 0) {
        console.log("[UbibotCollector] No se encontraron canales habilitados para procesar.");
        // Considerar esto un éxito del ciclo, pero sin datos
        this.updateMetrics(true, Date.now());
        this.retryCount = 0; // Resetear reintentos del ciclo general
        console.log("✅ [UbibotCollector] Ciclo completado (sin canales activos encontrados).\n");
        return;
      }
      console.log(`[UbibotCollector] Procesando ${channels.length} canales...`);

      // 2. Procesar cada canal
      for (const channel of channels) {
        let channelSuccess = true;
        try {
          console.log(`  -> Procesando Canal ID: ${channel.channel_id} (Nombre: ${channel.name || 'N/A'})`);
          // Obtener datos detallados del canal
          const channelData = await ubibotController.getChannelData(channel.channel_id);

          if (channelData && channelData.last_values) {
            // Parsear last_values (asegurándose de que es string antes)
            let lastValuesParsed = null;
            if (typeof channelData.last_values === 'string') {
              try { lastValuesParsed = JSON.parse(channelData.last_values); } catch (parseError) {
                console.error(`     ❌ Error parseando last_values para canal ${channel.channel_id}:`, parseError.message);
                throw new Error(`JSON inválido en last_values`); // Lanzar para marcar fallo de canal
              }
            } else { lastValuesParsed = channelData.last_values; } // Asumir objeto si no es string

            if (lastValuesParsed && typeof lastValuesParsed === 'object') {
              // Llamar a ubibotService para actualizar estado/insertar lecturas
              // ubibotService ahora maneja la llamada a notificationController
              await ubibotService.processChannelData(channelData);
              await ubibotService.processSensorReadings(channelData.channel_id, lastValuesParsed);
              console.log(`     ✅ Datos procesados para canal ${channel.channel_id}.`);
            } else {
              console.warn(`     ⚠️ last_values inválidos o no parseables para canal ${channel.channel_id}`);
              // Decidir si esto cuenta como fallo de canal
              // channelSuccess = false; // Opcional: marcar como fallo si last_values es crítico
            }
          } else {
            console.warn(`     ⚠️ No se recibieron datos válidos (channelData o last_values) para el canal ${channel.channel_id}`);
            channelSuccess = false; // Marcar como fallo si no hay datos
          }
        } catch (error) {
          // Capturar error procesando UN canal, loguear y marcar fallo para este canal
          console.error(`     ❌ Error procesando canal ${channel.channel_id || 'desconocido'}:`, error.message);
          channelSuccess = false;
        } finally {
          // Actualizar contadores de canal
          if (channelSuccess) {
            this.metrics.channelsProcessed++;
          } else {
            this.metrics.channelsFailed++;
            cycleErrors = true; // Marcar que hubo al menos un error en el ciclo
          }
        }
      } // Fin del bucle for channel

      // 3. Verificar desconexión por tiempo (SOLO PARA LOGGING)
      await this.logDisconnectedByTime(channels);

      // 4. Finalizar Ciclo
      this.updateMetrics(!cycleErrors, Date.now(), cycleErrors ? "Errores procesando algunos canales" : null);
      this.retryCount = 0; // Resetear reintentos si el ciclo principal (getChannels) funcionó
      console.log(`✅ [UbibotCollector] Ciclo de recolección Ubibot completado ${cycleErrors ? `con ${this.metrics.channelsFailed} errores en canales` : 'exitosamente'}. Procesados: ${this.metrics.channelsProcessed}.\n`);

    } catch (error) {
      // Captura errores generales del ciclo (ej. fallo al obtener lista de canales)
      console.error(`❌ [UbibotCollector] Error GENERAL en ciclo de recolección: ${error.message}`);
      // Llamar a handleCollectionError para manejar reintentos del ciclo completo
      this.handleCollectionError(error);
    }
  }

  /**
   * Verifica y loguea los canales que no han enviado datos en mucho tiempo.
   * NO llama a notificationController.
   * @param {Array<Object>} channels - Lista de canales obtenidos.
   * @private
   */
  async logDisconnectedByTime(channels) {
    if (!channels || channels.length === 0) return;

    console.log(`[UbibotCollector] Verificando desconexión por tiempo (> ${DISCONNECTION_THRESHOLD_MINUTES} min)...`);
    let disconnectedCount = 0;

    for (const channel of channels) {
      try {
        const lastReading = await ubibotService.getLastSensorReading(channel.channel_id);
        if (lastReading?.external_temperature_timestamp) {
          const now = new Date();
          const lastTimestamp = new Date(lastReading.external_temperature_timestamp);
          const diffMinutes = (now.getTime() - lastTimestamp.getTime()) / (1000 * 60);

          if (diffMinutes > DISCONNECTION_THRESHOLD_MINUTES) {
            console.log(
              `  -> LOG INFO: Canal ${channel.name || channel.channel_id} sin lecturas recientes por ${diffMinutes.toFixed(0)} min (Límite: ${DISCONNECTION_THRESHOLD_MINUTES}). Última lectura: ${lastTimestamp.toISOString()}`
            );
            disconnectedCount++;
            // NO LLAMAR A notificationController AQUÍ
          }
        }
      } catch (error) {
        // No marcar el ciclo completo como error por fallo en esta verificación opcional
        console.error(`  -> Error verificando desconexión por tiempo para ${channel.channel_id}:`, error.message);
      }
    }
    if (disconnectedCount > 0) {
      console.log(`[UbibotCollector] ${disconnectedCount} sensores detectados sin lecturas recientes (>${DISCONNECTION_THRESHOLD_MINUTES} min).`);
    } else {
      console.log(`[UbibotCollector] Ningún sensor superó umbral de desconexión por tiempo.`);
    }
  }


  /**
   * Actualiza las métricas de recolección.
   * @param {boolean} success - Indica si el ciclo general fue exitoso.
   * @param {number} timestamp - Timestamp de la operación.
   * @param {string|null} [errorMessage=null] - Mensaje de error si success es false.
   */
  updateMetrics(success, timestamp, errorMessage = null) {
    if (success) {
      this.metrics.successfulCollections++;
      this.metrics.lastSuccessTime = timestamp;
      // this.metrics.lastError = null; // Opcional: limpiar en éxito
    } else {
      this.metrics.failedCollections++;
      this.metrics.lastError = errorMessage || "Error desconocido en ciclo de recolección";
    }
  }

  /**
   * Maneja errores generales del ciclo de recolección y gestiona reintentos.
   * @param {Error} error - El error ocurrido.
   */
  async handleCollectionError(error) {
    // Actualizar métricas con el mensaje de error específico
    this.updateMetrics(false, Date.now(), `Error general del ciclo: ${error.message}`);
    // Loguear el error
    console.error(`❌ [UbibotCollector] Error en ciclo de recolección: ${error.message}`);
    // if (process.env.NODE_ENV === 'development' && error.stack) console.error(error.stack);

    // Incrementar contador de reintento y métrica general
    this.retryCount++;
    this.metrics.totalRetries++;

    // Verificar si quedan reintentos
    if (this.retryCount <= this.maxRetries) {
      const delaySeconds = (this.retryDelay / 1000);
      console.log(`🔄 [UbibotCollector] Reintento general ${this.retryCount}/${this.maxRetries} en ${delaySeconds}s...`);
      await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      // No llamar a collect() aquí directamente para evitar bucles,
      // dejar que el intervalo principal lo intente de nuevo.
    } else {
      console.error(`❌ [UbibotCollector] Máximo de reintentos (${this.maxRetries}) alcanzado para error general. Esperando al próximo ciclo del intervalo.`);
      this.retryCount = 0; // Resetear para el próximo ciclo
    }
  }

  /**
   * Imprime estadísticas de recolección en la consola.
   */
  printCollectionStats() {
    console.log("\n📊 Ubibot Collection Statistics:");
    console.log(`- Successful Cycles: ${this.metrics.successfulCollections}`);
    console.log(`- Failed Cycles: ${this.metrics.failedCollections}`);
    console.log(`- Total Retries (Cycles): ${this.metrics.totalRetries}`);
    const totalCycles = this.metrics.successfulCollections + this.metrics.failedCollections;
    if (totalCycles > 0) {
      const successRate = (this.metrics.successfulCollections / totalCycles) * 100;
      console.log(`- Cycle Success Rate: ${successRate.toFixed(2)}%`);
    } else {
      console.log("- Cycle Success Rate: N/A (no cycles completed yet)");
    }
    console.log(`- Channels Processed (Total): ${this.metrics.channelsProcessed}`); // Métricas de canal
    console.log(`- Channels Failed (Total): ${this.metrics.channelsFailed}`);      // Métricas de canal
    console.log(`- Last Successful Cycle: ${this.metrics.lastSuccessTime ? new Date(this.metrics.lastSuccessTime).toISOString() : "Never"}`);
    if (this.metrics.lastError) {
      console.log(`- Last Error: ${this.metrics.lastError}`);
    }
  }

  /**
   * Obtiene estadísticas del colector.
   * @returns {Object} - Estadísticas actuales.
   */
  getCollectorStats() {
    return {
      isRunning: this.isRunning,
      collectionInterval: this.collectionInterval,
      ...this.metrics // Incluir todas las métricas
    };
  }
}

module.exports = UbibotCollector;
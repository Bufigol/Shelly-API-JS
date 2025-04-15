// collectors/ubibot-collector.js

const config = require("../src/config/js_files/config-loader");
const ubibotController = require("../src/controllers/ubibotController");
const ubibotService = require("../src/services/ubibotService");
const databaseService = require("../src/services/database-service");
const emailService = require("../src/services/email/emailService");
const smsService = require("../src/services/sms/smsService");
const notificationController = require("../src/controllers/notificationController");

class UbibotCollector {
  /**
   * Initializes a new instance of the UbibotCollector class.
   * @constructor
   */
  constructor() {
    const { ubibot: ubibotConfig } = config.getConfig();
    this.collectionInterval = ubibotConfig.collectionInterval || 240000; // Default 10 minutes
    this.isRunning = false;
    this.intervalId = null;
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
   * Starts the Ubibot data collector.
   */
  async start() {
    if (this.isRunning) {
      console.log("Ubibot collector already running.");
      return;
    }

    console.log("🚀 Starting Ubibot data collector...");
    this.isRunning = true;
    await this.collect();
    this.intervalId = setInterval(
      () => this.collect(),
      this.collectionInterval
    );
  }

  /**
   * Stops the Ubibot data collector.
   */
  stop() {
    if (!this.isRunning) return;

    console.log("🛑 Stopping Ubibot data collector...");
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.intervalId = null;
    this.printCollectionStats();
  }

  /**
   * Collects data from Ubibot channels and processes it.
   */
  async collect() {
    try {
      console.log("\n📥 Starting Ubibot data collection cycle...");
      const channels = await ubibotController.getChannels();

      if (!channels || channels.length === 0) {
        console.log(`No se encontraron canales habilitados para procesar`);
        this.updateMetrics(
          false,
          Date.now(),
          `No se encontraron canales habilitados para procesar`
        );
        return;
      }

      // Procesamiento regular de canales
      for (const channel of channels) {
        try {
          const channelData = await ubibotController.getChannelData(
            channel.channel_id
          );
          if (channelData) {
            await ubibotService.processChannelData(channelData);
            await ubibotService.processSensorReadings(
              channelData.channel_id,
              JSON.parse(channelData.last_values)
            );
          }
        } catch (error) {
          console.error(
            `Error processing channel ${channel.channel_id}:`,
            error.message
          );
          this.handleCollectionError(error);
        }
      }

      // Detección de sensores desconectados
      const disconnectedChannels = [];
      const INTERVALO_SIN_CONEXION_SENSOR = 95; // minutos

      for (const channel of channels) {
        try {
          const lastReading = await ubibotService.getLastSensorReading(
            channel.channel_id
          );
          if (lastReading && lastReading.external_temperature_timestamp) {
            const now = new Date();
            const lastTimestamp = new Date(
              lastReading.external_temperature_timestamp
            );

            // Calcular la diferencia en minutos
            const diffMinutes = (now - lastTimestamp) / (1000 * 60);

            if (diffMinutes > INTERVALO_SIN_CONEXION_SENSOR) {
              console.log(
                `Canal ${channel.name} desconectado por ${diffMinutes.toFixed(
                  2
                )} minutos (límite: ${INTERVALO_SIN_CONEXION_SENSOR})`
              );

              disconnectedChannels.push({
                channel_id: channel.channel_id,
                name: channel.name || `Canal ${channel.channel_id}`,
                lastConnectionTime: lastReading.external_temperature_timestamp,
                disconnectionInterval: INTERVALO_SIN_CONEXION_SENSOR,
              });
            }
          }
        } catch (error) {
          console.error(
            `Error verificando sensor ${channel.channel_id}:`,
            error.message
          );
        }
      }

      // Enviar alerta si hay sensores desconectados
      if (disconnectedChannels.length > 0) {
        try {
          // En lugar de enviar directamente, registramos los eventos en el sistema de notificaciones
          for (const channel of disconnectedChannels) {
            await notificationController.processConnectionStatusChange(
              channel.channel_id || "unknown",
              channel.name,
              false,  // isOnline = false (está desconectado)
              true,   // wasOffline = true (ya estaba desconectado)
              channel.lastConnectionTime,
              null,   // No hay último tiempo de alerta
              true    // isOperational = true
            );

            console.log(
              `Evento de desconexión para canal ${channel.name} registrado para notificación horaria`
            );
          }

          console.log(
            `${disconnectedChannels.length} sensores desconectados registrados para alerta horaria`
          );
        } catch (error) {
          console.error(
            "Error registrando alertas de sensores desconectados:",
            error
          );
        }
      }

      this.updateMetrics(true, Date.now());
      console.log("✅ Ubibot collection cycle completed successfully\n");
    } catch (error) {
      this.handleCollectionError(error);
    }
  }

  /**
   * Updates metrics for the UbibotCollector.
   */
  updateMetrics(success, timestamp, errorMessage = null) {
    if (success) {
      this.metrics.successfulCollections++;
      this.metrics.lastSuccessTime = timestamp;
    } else {
      this.metrics.failedCollections++;
      this.metrics.lastError = errorMessage;
    }
  }

  /**
   * Handles errors that occur during the collection cycle.
   */
  async handleCollectionError(error) {
    this.metrics.lastError = error.message;
    this.updateMetrics(false, Date.now(), error.message);

    console.error("❌ Ubibot Collection error:", error.message);

    this.retryCount++;
    this.metrics.totalRetries++;

    if (this.retryCount <= this.maxRetries) {
      console.log(
        `🔄 Retry ${this.retryCount}/${this.maxRetries} in ${this.retryDelay / 1000
        }s...`
      );
      await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      await this.collect();
    } else {
      console.error(
        `❌ Maximum retries reached (${this.maxRetries}). Waiting for next cycle.`
      );
      this.retryCount = 0;
    }
  }

  /**
   * Prints the collection statistics to the console.
   */
  printCollectionStats() {
    console.log("\n📊 Ubibot Collection Statistics:");
    console.log(
      `Successful collections: ${this.metrics.successfulCollections}`
    );
    console.log(`Failed collections: ${this.metrics.failedCollections}`);
    console.log(`Total retries: ${this.metrics.totalRetries}`);
    console.log(
      `Success rate: ${(
        (this.metrics.successfulCollections /
          (this.metrics.successfulCollections +
            this.metrics.failedCollections)) *
        100
      ).toFixed(2)}%`
    );
    console.log(
      `Last successful collection: ${this.metrics.lastSuccessTime
        ? new Date(this.metrics.lastSuccessTime).toISOString()
        : "Never"
      }`
    );
    if (this.metrics.lastError) {
      console.log(`Last error: ${this.metrics.lastError}`);
    }
  }

  /**
   * Returns the collector statistics as an object.
   */
  getCollectorStats() {
    return {
      isRunning: this.isRunning,
      ...this.metrics,
      collectionInterval: this.collectionInterval,
    };
  }
}

module.exports = UbibotCollector;
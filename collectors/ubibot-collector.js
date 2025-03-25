// collectors/ubibot-collector.js

const config = require("../src/config/js_files/config-loader");
const ubibotController = require("../src/controllers/ubibotController");
const ubibotService = require("../src/services/ubibotService");
const databaseService = require("../src/services/database-service");

class UbibotCollector {
  /**
   * Initializes a new instance of the UbibotCollector class.
   * @constructor
   *
   * The constructor initializes the UbibotCollector with the following properties:
   *
   * - `collectionInterval`: The interval in milliseconds between two consecutive collections. If not specified, defaults to 10 minutes.
   * - `isRunning`: A boolean indicating whether the collector is currently running. Initially set to false.
   * - `intervalId`: The ID of the interval used to run the collector. Initially set to null.
   * - `retryCount`: The number of times the collector has retried to collect data. Initially set to 0.
   * - `maxRetries`: The maximum number of times the collector will retry to collect data. Defaults to 3.
   * - `retryDelay`: The delay in milliseconds between two consecutive retries. Defaults to 5 seconds.
   * - `metrics`: An object to hold metrics about the collector's performance. The object has the following properties:
   *   - `successfulCollections`: The number of successful collections.
   *   - `failedCollections`: The number of failed collections.
   *   - `totalRetries`: The total number of retries.
   *   - `lastError`: The last error that occurred during data collection.
   *   - `lastSuccessTime`: The timestamp of the last successful collection.
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
   *
   * If the collector is already running, this method does nothing.
   *
   * Otherwise, it sets the collector's `isRunning` property to true and starts the collection process.
   * The collection process will be repeated at regular intervals using an interval ID stored in the `intervalId` property.
   * The interval is set to the value of the `collectionInterval` property.
   *
   * @returns {void}
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
   *
   * If the collector is not running, this method does nothing.
   *
   * Otherwise, it clears the interval used for data collection, sets the
   * `isRunning` property to false, nullifies the `intervalId`, and prints
   * the collection statistics.
   *
   * @returns {void}
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
   *
   * Retrieves a list of enabled channels from the Ubibot controller and
   * iterates over them. For each channel, it retrieves the channel data
   * and processes it using the `ubibotService`.
   *
   * If the channel data is missing or empty, it logs a message and skips
   * processing the channel.
   *
   * If an error occurs while processing a channel, it logs the error
   * and calls the `handleCollectionError` method to update the metrics.
   *
   * After processing all channels, it updates the metrics and logs a
   * success message.
   *
   * @async
   * @returns {void}
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
      const disconnectedChannels = [];
      for (const channel of channels) {
        const lastReading = await ubibotService.getLastSensorReading(
          channel.channel_id
        );
        if (
          lastReading &&
          ubibotService.isDifferenceGreaterThan(
            new Date(),
            lastReading.external_temperature_timestamp,
            ubibotService.INTERVALO_SIN_CONEXION_SENSOR * 60 // convertir a segundos
          )
        ) {
          disconnectedChannels.push({
            name: channel.name,
            lastConnectionTime: lastReading.external_temperature_timestamp,
            disconnectionInterval: ubibotService.INTERVALO_SIN_CONEXION_SENSOR,
          });
        }
      }

      // Enviar alerta si hay sensores desconectados
      if (disconnectedChannels.length > 0) {
        const emailService = require("../services/emailService");
        await emailService.sendDisconnectedSensorsEmail(disconnectedChannels);
      }
      this.updateMetrics(true, Date.now());
      console.log("✅ Ubibot collection cycle completed successfully\n");
    } catch (error) {
      this.handleCollectionError(error);
    }
  }

  /**
   * Updates metrics for the UbibotCollector.
   *
   * If the collection was successful, increments the count of successful collections
   * and updates the last successful collection timestamp.
   * If the collection failed, increments the count of failed collections and updates
   * the last error message.
   *
   * @param {boolean} success - Indicates if the collection was successful.
   * @param {number} timestamp - The timestamp of the collection attempt.
   * @param {string|null} [errorMessage=null] - The error message if the collection failed.
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
   *
   * Updates the metrics by incrementing the count of failed collections and
   * setting the last error message.
   *
   * Logs an error message with the error details and retries the collection
   * cycle if the maximum number of retries has not been exceeded.
   *
   * @param {Error} error - The error that occurred during the collection cycle.
   */
  async handleCollectionError(error) {
    this.metrics.lastError = error.message;
    this.updateMetrics(false, Date.now(), error.message);

    console.error("❌ Ubibot Collection error:", error.message);

    this.retryCount++;
    this.metrics.totalRetries++;

    if (this.retryCount <= this.maxRetries) {
      console.log(
        `🔄 Retry ${this.retryCount}/${this.maxRetries} in ${
          this.retryDelay / 1000
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
   *
   * The statistics include the number of successful collections, the number of failed collections, the total number of retries,
   * the success rate, the last successful collection timestamp, and the last error message, if any.
   *
   * @returns {void}
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
      `Last successful collection: ${
        this.metrics.lastSuccessTime
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
   *
   * The returned object contains the following properties:
   *
   * - `isRunning`: A boolean indicating whether the collector is currently running.
   * - `successfulCollections`: The number of successful collections.
   * - `failedCollections`: The number of failed collections.
   * - `totalRetries`: The total number of retries.
   * - `lastSuccessTime`: The timestamp of the last successful collection, or `null` if there have been no successful collections.
   * - `lastError`: The error message of the last failed collection, or `null` if there have been no failed collections.
   * - `collectionInterval`: The interval at which the collector attempts to collect data, in milliseconds.
   *
   * @returns {Object} The collector statistics.
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

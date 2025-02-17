// collectors/onPremise-collector.js
const onPremiseController = require("../src/controllers/onPremiseController");
class onPremiseCollector {
  /**
   * Initializes a new instance of the onPremiseCollector class.
   *
   * The constructor initializes the onPremiseCollector with the following properties:
   *
   * - `collectionInterval`: The interval in milliseconds between two consecutive collections. If not specified, defaults to 10 seconds.
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
    this.collectionInterval = 10000; // Default 10 seconds;
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
   * Starts the Ubibot onPremise data collector.
   *
   * If the collector is already running, this method does nothing.
   *
   * Otherwise, it sets the collector's `isRunning` property to true and starts the collection process.
   * The collection process will be repeated at regular intervals using an interval ID stored in the `intervalId` property.
   * The interval is set to the value of the `collectionInterval` property.
   *
   * @async
   * @returns {void}
   */
  async start() {
    if (this.isRunning) {
      console.log("Ubibot onPremise collector already running.");
      return;
    }

    console.log("🚀 Starting Ubibot onPremise data collector...");
    this.isRunning = true;
    await this.collect();
    this.intervalId = setInterval(
      () => this.collect(),
      this.collectionInterval
    );
  }

  /**
   * Stops the Ubibot onPremise data collector.
   *
   * If the collector is not running, this method does nothing.
   *
   * Otherwise, it sets the collector's `isRunning` property to false, clears the interval ID stored in the `intervalId` property, and prints the collection statistics.
   *
   * @returns {void}
   */
  stop() {
    if (!this.isRunning) return;

    console.log("🛑 Stopping Ubibot onPremise data collector...");
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.intervalId = null;
    this.printCollectionStats();
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
    console.log("\n📊 Ubibot onPremise Collection Statistics:");
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
   * - `lastError`: The last error that occurred during data collection.
   * - `lastSuccessTime`: The timestamp of the last successful collection.
   * - `collectionInterval`: The interval in milliseconds between two consecutive collections.
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

      this.updateMetrics(true, Date.now());
      console.log("✅ Ubibot collection cycle completed successfully\n");
    } catch (error) {
      this.handleCollectionError(error);
    }
  }
}

module.exports = onPremiseCollector;

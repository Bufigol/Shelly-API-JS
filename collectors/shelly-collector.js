const fetch = require("node-fetch");
const configLoader = require("../src/config/js_files/config-loader");
const databaseService = require("../src/services/database-service");

class ShellyCollector {
  constructor() {
    const { api, collection } = configLoader.getConfig();
    this.apiUrl = `${api.url}?id=${api.device_id}&auth_key=${api.auth_key}`;
    this.collectionInterval = collection.interval;
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

  validateNumericFields(data, prefix = "") {
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "number") {
        result[`${prefix}${key}`] = value;
      } else if (value !== null && value !== undefined) {
        const parsed = parseFloat(value);
        result[`${prefix}${key}`] = isNaN(parsed) ? 0 : parsed;
      } else {
        result[`${prefix}${key}`] = 0;
      }
    }
    return result;
  }

  async start() {
    if (this.isRunning) {
      console.log("Collector already running");
      return;
    }

    console.log("🚀 Starting Shelly data collector...");
    this.isRunning = true;
    await this.collect();
    this.intervalId = setInterval(
      () => this.collect(),
      this.collectionInterval
    );
  }

  stop() {
    if (!this.isRunning) return;

    console.log("🛑 Stopping Shelly data collector...");
    clearInterval(this.intervalId);
    this.isRunning = false;
    this.intervalId = null;
    this.printCollectionStats();
  }

  evaluateReadingQuality(currentTimestamp) {
    if (!this.lastCollectionTime) {
      return "GOOD";
    }

    const interval = currentTimestamp - this.lastCollectionTime;
    const deviation = Math.abs(interval - this.expectedInterval);
    const quality =
      deviation <= this.maxIntervalDeviation
        ? "GOOD"
        : deviation <= this.maxIntervalDeviation * 2
        ? "SUSPECT"
        : "BAD";
    return quality;
  }

  async collect() {
    try {
      console.log("\n📥 Starting data collection cycle...");
      const currentTimestamp = Date.now();

      const data = await this.fetchDeviceData();

      if (!this.validateApiResponse(data)) {
        throw new Error("Invalid API response structure");
      }

      const enrichedData = this.enrichData(data, currentTimestamp);

      await this.saveData(enrichedData);

      this.updateMetrics(true, currentTimestamp);
      this.lastCollectionTime = currentTimestamp;
      this.lastMeasurement = enrichedData;
      this.retryCount = 0;

      console.log("✅ Collection cycle completed successfully\n");
    } catch (error) {
      this.handleCollectionError(error);
    }
  }

  async fetchDeviceData() {
    const response = await fetch(this.apiUrl);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  validateApiResponse(data) {
    if (!data || !data.isok || !data.data || !data.data.device_status) {
      console.error(
        "Invalid API response structure:",
        JSON.stringify(data, null, 2)
      );
      return false;
    }
    return true;
  }

  enrichData(data, timestamp) {
    const deviceStatus = data.data.device_status;
    const emData = deviceStatus["em:0"] || {};
    const tempData = deviceStatus["temperature:0"] || {};
    const emdData = deviceStatus["emdata:0"] || {};

    // Validar y convertir campos numéricos incluyendo energía
    const validatedEmData = {
      ...this.validateNumericFields(emData),
      // Agregar campos de energía para cada fase
      a_act_energy: this.getEnergyValue(emData, "a_act_energy"),
      b_act_energy: this.getEnergyValue(emData, "b_act_energy"),
      c_act_energy: this.getEnergyValue(emData, "c_act_energy"),
      a_react_energy: this.getEnergyValue(emData, "a_react_energy"),
      b_react_energy: this.getEnergyValue(emData, "b_react_energy"),
      c_react_energy: this.getEnergyValue(emData, "c_react_energy"),
      total_act_energy: this.getEnergyValue(emData, "total_act_energy"),
      total_react_energy: this.getEnergyValue(emData, "total_react_energy"),
    };

    return {
      device_status: {
        ...deviceStatus,
        reading_quality: this.evaluateReadingQuality(timestamp),
        collection_timestamp: timestamp,
        interval_ms: this.lastCollectionTime
          ? timestamp - this.lastCollectionTime
          : this.expectedInterval,
        sys: deviceStatus.sys
          ? {
              ...deviceStatus.sys,
              unixtime: Math.floor(timestamp / 1000),
            }
          : undefined,
        "em:0": validatedEmData,
        "temperature:0": this.validateNumericFields(tempData),
        "emdata:0": this.validateNumericFields(emdData),
      },
    };
  }

  getEnergyValue(data, field) {
    const value = parseFloat(data[field]);
    return isNaN(value) ? 0 : value;
  }

  async saveData(data) {
    try {
      const result = await databaseService.insertDeviceStatus(data);
      return result;
    } catch (error) {
      console.error("Error saving data:", error);
      throw error;
    }
  }

  updateMetrics(success, timestamp) {
    if (success) {
      this.metrics.successfulCollections++;
      this.metrics.lastSuccessTime = timestamp;
    } else {
      this.metrics.failedCollections++;
    }
  }

  async handleCollectionError(error) {
    this.metrics.lastError = error.message;
    this.updateMetrics(false, Date.now());

    console.error("❌ Collection error:", error.message);

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

  printCollectionStats() {
    console.log("\n📊 Collection Statistics:");
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

  getCollectorStats() {
    return {
      isRunning: this.isRunning,
      lastCollectionTime: this.lastCollectionTime,
      ...this.metrics,
      expectedInterval: this.expectedInterval,
      maxIntervalDeviation: this.maxIntervalDeviation,
      lastMeasurementQuality:
        this.lastMeasurement?.device_status.reading_quality,
    };
  }
}

module.exports = ShellyCollector;

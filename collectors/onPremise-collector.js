// collectors/onPremise-collector.js
const mysql = require("mysql2/promise");
const axios = require("axios");
const config = require("../config/js_files/config-loader");

class OnPremiseCollector {
  /**
   * Initializes the OnPremise collector with configuration for both
   * real-time database synchronization and API data collection.
   */
  constructor() {
    // Collection intervals
    this.apiCollectionInterval = 10000; // 10 seconds for API
    this.dbSyncBatchSize = 1000; // Process 1000 records per batch

    // Status flags
    this.isRunning = false;
    this.apiIntervalId = null;
    this.dbSyncIntervalId = null;

    // Retry configuration
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 5000;

    // Metric tracking
    this.metrics = {
      apiCollection: {
        successfulCollections: 0,
        failedCollections: 0,
        totalRetries: 0,
        lastError: null,
        lastSuccessTime: null,
      },
      dbSync: {
        recordsProcessed: 0,
        batchesProcessed: 0,
        lastSyncTime: null,
        lastError: null,
        lastProcessedId: 0,
      },
    };

    // Database pools
    this.mainDbPool = null;
    this.optOppDbPool = null;
  }

  /**
   * Initializes database connections and starts the collector processes.
   */
  async initialize() {
    try {
      // Initialize database connections
      const dbConfig = config.getConfig().database;

      this.mainDbPool = mysql.createPool({
        host: dbConfig.host,
        user: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Initialize opt_opp database connection
      // Note: Replace with actual opt_opp database configuration
      this.optOppDbPool = mysql.createPool({
        host: process.env.OPT_OPP_HOST || "localhost",
        user: process.env.OPT_OPP_USER || "user",
        password: process.env.OPT_OPP_PASSWORD || "password",
        database: "opt_opp",
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      await this.testConnections();
      console.log("✅ Database connections initialized successfully");

      return true;
    } catch (error) {
      console.error("Error initializing collector:", error);
      throw error;
    }
  }

  /**
   * Tests both database connections.
   */
  async testConnections() {
    try {
      await this.mainDbPool.query("SELECT 1");
      await this.optOppDbPool.query("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database connection test failed:", error);
      throw error;
    }
  }

  /**
   * Starts both the API collection and database synchronization processes.
   */
  async start() {
    if (this.isRunning) {
      console.log("OnPremise collector is already running");
      return;
    }

    try {
      await this.initialize();

      console.log("🚀 Starting OnPremise collector...");
      this.isRunning = true;

      // Start API collection
      await this.collectApiData();
      this.apiIntervalId = setInterval(
        () => this.collectApiData(),
        this.apiCollectionInterval
      );

      // Start database synchronization
      this.startDatabaseSync();

      console.log("✅ OnPremise collector started successfully");
    } catch (error) {
      console.error("Error starting collector:", error);
      this.stop();
      throw error;
    }
  }

  /**
   * Stops all collection processes and closes database connections.
   */
  async stop() {
    if (!this.isRunning) return;

    console.log("🛑 Stopping OnPremise collector...");

    // Clear intervals
    if (this.apiIntervalId) {
      clearInterval(this.apiIntervalId);
      this.apiIntervalId = null;
    }

    if (this.dbSyncIntervalId) {
      clearInterval(this.dbSyncIntervalId);
      this.dbSyncIntervalId = null;
    }

    // Close database connections
    if (this.mainDbPool) {
      await this.mainDbPool.end();
      this.mainDbPool = null;
    }

    if (this.optOppDbPool) {
      await this.optOppDbPool.end();
      this.optOppDbPool = null;
    }

    this.isRunning = false;
    this.printCollectorStats();
  }

  /**
   * Prints collector statistics to the console.
   */
  printCollectorStats() {
    console.log("\n📊 OnPremise Collector Statistics:");

    // API Collection Stats
    console.log("\nAPI Collection:");
    console.log(
      `Successful collections: ${this.metrics.apiCollection.successfulCollections}`
    );
    console.log(
      `Failed collections: ${this.metrics.apiCollection.failedCollections}`
    );
    console.log(`Total retries: ${this.metrics.apiCollection.totalRetries}`);

    // Database Sync Stats
    console.log("\nDatabase Synchronization:");
    console.log(`Records processed: ${this.metrics.dbSync.recordsProcessed}`);
    console.log(`Batches processed: ${this.metrics.dbSync.batchesProcessed}`);
    console.log(`Last sync time: ${this.metrics.dbSync.lastSyncTime}`);

    // Error Information
    if (this.metrics.apiCollection.lastError) {
      console.log(`\nLast API error: ${this.metrics.apiCollection.lastError}`);
    }
    if (this.metrics.dbSync.lastError) {
      console.log(`Last DB sync error: ${this.metrics.dbSync.lastError}`);
    }
  }

  /**
   * Returns the current collector statistics.
   */
  getCollectorStats() {
    return {
      isRunning: this.isRunning,
      metrics: this.metrics,
      apiCollectionInterval: this.apiCollectionInterval,
      dbSyncBatchSize: this.dbSyncBatchSize,
    };
  }
}

module.exports = OnPremiseCollector;

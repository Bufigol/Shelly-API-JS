// collectors/onPremise-collector.js
const mysql = require("mysql2/promise");
const axios = require("axios");
const moment = require("moment-timezone");
const config = require("../src/config/js_files/config-loader");

class OnPremiseCollector {
  constructor() {
    this.dbPool = null;
    this.initialized = false;
    this.isRunning = false;
    this.collectionInterval = 10000; // 10 segundos
    this.collectorInterval = null;

    // Configuración de reintentos
    this.maxRetries = 3;
    this.retryTimeWindow = 10000; // 10 segundos para todos los reintentos
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const { databases } = config.getConfig();
      this.dbPool = mysql.createPool({
        host: databases.main.host,
        port: databases.main.port,
        user: databases.main.username,
        password: databases.main.password,
        database: databases.main.database,
        waitForConnections: true,
        connectionLimit: databases.main.pool.max_size,
        queueLimit: 0,
      });

      await this.testConnection();
      this.initialized = true;
      console.log("✅ OnPremise collector initialized successfully");
    } catch (error) {
      console.error("Error initializing collector:", error);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.dbPool.query("SELECT 1");
    } catch (error) {
      throw new Error("Database connection test failed: " + error.message);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log("OnPremise collector is already running");
      return;
    }

    try {
      await this.initialize();
      console.log("🚀 Starting OnPremise collector...");
      this.isRunning = true;
      await this.collect();
      this.collectorInterval = setInterval(
        () => this.collect(),
        this.collectionInterval
      );
    } catch (error) {
      console.error("Error starting collector:", error);
      this.stop();
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    console.log("🛑 Stopping OnPremise collector...");
    if (this.collectorInterval) {
      clearInterval(this.collectorInterval);
      this.collectorInterval = null;
    }

    if (this.dbPool) {
      await this.dbPool.end();
      this.dbPool = null;
    }

    this.isRunning = false;
    this.initialized = false;
  }

  async collect() {
    try {
      const channels = await this.getActiveChannels();

      if (!channels || channels.length === 0) {
        console.log("No active channels found");
        return;
      }

      for (const channel of channels) {
        try {
          await this.processChannel(channel);
        } catch (error) {
          console.error(
            `Error processing channel ${channel.chanel_id}:`,
            error.message
          );
          await this.logError(channel.chanel_id, error.message);
        }
      }
    } catch (error) {
      console.error("Error in collection cycle:", error);
    }
  }

  async getActiveChannels() {
    try {
      const [channels] = await this.dbPool.query(
        "SELECT chanel_id, apikey FROM api_equipo"
      );
      return channels;
    } catch (error) {
      console.error("Error fetching active channels:", error);
      throw error;
    }
  }

  async processChannel(channel) {
    const startTime = Date.now();
    let attempts = 0;

    while (
      attempts < this.maxRetries &&
      Date.now() - startTime < this.retryTimeWindow
    ) {
      try {
        const channelData = await this.fetchChannelData(
          channel.chanel_id,
          channel.apikey
        );

        if (await this.shouldProcessData(channel.chanel_id, channelData)) {
          await this.insertChannelData(channel.chanel_id, channelData);
          console.log(`Successfully processed channel ${channel.chanel_id}`);
          return;
        } else {
          console.log(`Skipping channel ${channel.chanel_id} - No new data`);
          return;
        }
      } catch (error) {
        attempts++;
        console.error(
          `Attempt ${attempts} failed for channel ${channel.chanel_id}:`,
          error.message
        );

        const remainingTime = this.retryTimeWindow - (Date.now() - startTime);
        if (attempts < this.maxRetries && remainingTime > 1000) {
          const waitTime = Math.min(
            remainingTime / (this.maxRetries - attempts),
            3000
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  }

  async shouldProcessData(channelId, channelData) {
    try {
      const [lastRecord] = await this.dbPool.query(
        "SELECT created_at FROM api_channel_feeds WHERE channel_id = ? ORDER BY created_at DESC LIMIT 1",
        [channelId]
      );

      if (lastRecord.length === 0) return true;

      const newTimestamp = this.getTimestamp(channelData);
      const lastTimestamp = moment(lastRecord[0].created_at).tz(
        "America/Santiago"
      );
      const currentTimestamp = moment(newTimestamp).tz("America/Santiago");

      if (currentTimestamp.isSame(lastTimestamp)) {
        const lastEntryDate = moment(channelData.channel.last_entry_date).tz(
          "America/Santiago"
        );
        return lastEntryDate.isAfter(lastTimestamp);
      }

      return currentTimestamp.isAfter(lastTimestamp);
    } catch (error) {
      console.error(
        `Error checking timestamps for channel ${channelId}:`,
        error
      );
      return false;
    }
  }

  getTimestamp(channelData) {
    try {
      const lastValues = JSON.parse(channelData.channel.last_values || "{}");
      if (lastValues.field7 && lastValues.field7.created_at) {
        return lastValues.field7.created_at;
      }
      return channelData.channel.last_entry_date;
    } catch (error) {
      console.error("Error parsing timestamp:", error);
      return channelData.channel.last_entry_date;
    }
  }

  async fetchChannelData(channelId, apiKey) {
    try {
      const response = await axios.get(
        `http://tns.thenextsecurity.cl:8443/channels/${channelId}`,
        {
          params: { api_key: apiKey },
          timeout: 5000,
        }
      );

      if (!response.data || response.data.result !== "success") {
        throw new Error("Invalid API response structure");
      }

      return response.data;
    } catch (error) {
      throw new Error(`API error: ${error.message}`);
    }
  }

  async insertChannelData(channelId, channelData) {
    const connection = await this.dbPool.getConnection();
    try {
      await connection.beginTransaction();

      const channel = channelData.channel;
      const lastValues = JSON.parse(channel.last_values || "{}");
      const timestamp = moment(this.getTimestamp(channelData))
        .tz("America/Santiago")
        .format("YYYY-MM-DD HH:mm:ss");

      // Verificar si ya existe un registro idéntico
      const [existingRecords] = await connection.query(
        `SELECT idchannel_feeds FROM api_channel_feeds 
             WHERE channel_id = ? 
             AND created_at = ?
             AND field7 = ?
             AND field4 = ?
             AND field5 = ?
             AND \`usage\` = ?
             LIMIT 1`,
        [
          channelId,
          timestamp,
          lastValues.field7 ? lastValues.field7.value : null,
          lastValues.field4 ? lastValues.field4.value : null,
          lastValues.field5 ? lastValues.field5.value : null,
          channel.usage,
        ]
      );

      if (existingRecords.length > 0) {
        await connection.rollback();
        console.log(
          `Duplicate record found for channel ${channelId} at ${timestamp}`
        );
        return false;
      }

      const feedData = {
        channel_id: channelId,
        created_at: timestamp,
        latitude: channel.latitude,
        longitude: channel.longitude,
        elevation: channel.elevation,
        status: channel.status,
        usage: channel.usage,
        log: lastValues.log ? lastValues.log.value : null,
      };

      // Agregar campos field1 a field20
      for (let i = 1; i <= 20; i++) {
        const fieldName = `field${i}`;
        feedData[fieldName] = lastValues[fieldName]
          ? lastValues[fieldName].value
          : null;
      }

      await connection.query("INSERT INTO api_channel_feeds SET ?", [feedData]);

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error inserting data: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  async logError(channelId, message, data = {}) {
    try {
      await this.dbPool.query("INSERT INTO process_log (message) VALUES (?)", [
        `Channel ${channelId}: ${message} - ${JSON.stringify(data)}`,
      ]);
    } catch (error) {
      console.error("Error logging to process_log:", error);
    }
  }
}

module.exports = OnPremiseCollector;

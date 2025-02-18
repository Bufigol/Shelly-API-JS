// src/services/onPremiseService.js
const mysql = require("mysql2/promise");
const axios = require("axios");
const config = require("../config/js_files/config-loader");
const { DatabaseError, ValidationError } = require("../utils/errors");

class OnPremiseService {
  constructor() {
    this.mainDbPool = null;
    this.ubibotDbPool = null;
    this.initialized = false;
    this.lastProcessedId = 0;
    this.batchSize = 1000;
  }

  /**
   * Inicializa las conexiones a las bases de datos
   */
  async initialize() {
    if (this.initialized) return;

    try {
      const { databases } = config.getConfig();

      // Inicializar pool para la base de datos principal
      this.mainDbPool = mysql.createPool({
        host: databases.main.host,
        port: databases.main.port,
        user: databases.main.username,
        password: databases.main.password,
        database: databases.main.database,
        waitForConnections: true,
        connectionLimit: databases.main.pool.max_size,
        queueLimit: 0,
      });

      // Inicializar pool para la base de datos ubibot
      this.ubibotDbPool = mysql.createPool({
        host: databases.ubibot.host,
        port: databases.ubibot.port,
        user: databases.ubibot.username,
        password: databases.ubibot.password,
        database: databases.ubibot.database,
        waitForConnections: true,
        connectionLimit: databases.ubibot.pool.max_size,
        queueLimit: 0,
      });

      await this.testConnections();
      this.initialized = true;
      console.log("✅ OnPremise service initialized successfully");
    } catch (error) {
      console.error("Error initializing OnPremise service:", error);
      throw new DatabaseError("Failed to initialize OnPremise service", error);
    }
  }

  /**
   * Prueba las conexiones a las bases de datos
   */
  async testConnections() {
    try {
      await this.mainDbPool.query("SELECT 1");
      await this.ubibotDbPool.query("SELECT 1");
    } catch (error) {
      throw new DatabaseError("Database connection test failed", error);
    }
  }

  /**
   * Obtiene los canales activos desde la base de datos principal
   */
  async getActiveChannels() {
    try {
      const [channels] = await this.mainDbPool.query(
        "SELECT chanel_id, apikey FROM api_equipo"
      );
      return channels;
    } catch (error) {
      throw new DatabaseError("Error fetching channels", error);
    }
  }

  /**
   * Obtiene datos de la API para un canal específico
   */
  /**
   * Compara dos objetos de status para detectar cambios significativos
   * @param {Object} oldStatus Status actual en la base de datos
   * @param {Object} newStatus Status nuevo de la API
   * @returns {boolean} true si hay cambios significativos
   */
  hasSignificantStatusChanges(oldStatus, newStatus) {
    try {
      const oldStatusObj =
        typeof oldStatus === "string" ? JSON.parse(oldStatus) : oldStatus;
      const newStatusObj =
        typeof newStatus === "string" ? JSON.parse(newStatus) : newStatus;

      // Comparar campos relevantes
      const relevantFields = [
        "ssid",
        "mac",
        "usb",
        "ota_status",
        "ota_errcode",
      ];

      for (const field of relevantFields) {
        // Para el campo status, necesitamos parsear los valores
        if (field === "status") {
          const oldStatusParams = this.parseStatusString(oldStatusObj.status);
          const newStatusParams = this.parseStatusString(newStatusObj.status);

          if (
            JSON.stringify(oldStatusParams) !== JSON.stringify(newStatusParams)
          ) {
            return true;
          }
          continue;
        }

        // Para otros campos, comparación directa
        if (oldStatusObj[field] !== newStatusObj[field]) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error comparing status objects:", error);
      return true; // En caso de error, asumimos que hay cambios
    }
  }

  /**
   * Parsea el string de status en un objeto
   * @param {string} statusString String de status (e.g., "mac=08:f9:e0:d4:a4:04,usb=1,...")
   * @returns {Object} Objeto con los parámetros parseados
   */
  parseStatusString(statusString) {
    if (!statusString) return {};

    const params = {};
    statusString.split(",").forEach((param) => {
      const [key, value] = param.split("=");
      if (key && value) {
        params[key.trim()] = value.trim();
      }
    });
    return params;
  }

  /**
   * Actualiza el status en la base de datos
   * @param {number} channelId ID del canal
   * @param {Object} status Nuevo status
   */
  async updateChannelStatus(channelId, status) {
    try {
      await this.mainDbPool.query(
        "UPDATE api_equipo SET status = ?, fecha_actualizacion = CURRENT_TIMESTAMP WHERE chanel_id = ?",
        [JSON.stringify(status), channelId]
      );
    } catch (error) {
      throw new DatabaseError("Error updating channel status", error);
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

      if (response.data && response.data.result === "success") {
        // Obtener el status actual de la base de datos
        const [currentStatus] = await this.mainDbPool.query(
          "SELECT status FROM api_equipo WHERE chanel_id = ?",
          [channelId]
        );

        // Verificar si hay cambios en el status
        if (currentStatus.length > 0 && response.data.channel.status) {
          const hasChanges = this.hasSignificantStatusChanges(
            currentStatus[0].status,
            response.data.channel.status
          );

          if (hasChanges) {
            await this.updateChannelStatus(
              channelId,
              response.data.channel.status
            );
            console.log(`Status updated for channel ${channelId}`);
          }
        }

        return response.data.channel;
      }
      throw new ValidationError("Invalid API response structure");
    } catch (error) {
      if (error.response) {
        throw new ValidationError(
          `API error: ${error.response.status} ${error.response.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Sincroniza datos entre las bases de datos
   */
  async syncDatabases() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Obtener últimos registros de opt_opp.channel_feeds
      const [newRecords] = await this.ubibotDbPool.query(
        `SELECT * FROM channel_feeds 
                WHERE entry_id > ? 
                ORDER BY entry_id 
                LIMIT ?`,
        [this.lastProcessedId, this.batchSize]
      );

      if (newRecords.length === 0) {
        return { processed: 0, lastId: this.lastProcessedId };
      }

      // Preparar registros para inserción
      const insertQueries = newRecords.map((record) => {
        return this.mainDbPool.query(
          `INSERT INTO api_channel_feeds (
                        channel_id, field1, field2, field3, field4, field5,
                        field6, field7, field8, field9, field10, field11,
                        field12, field13, field14, field15, field16, field17,
                        field18, field19, field20, latitude, longitude,
                        elevation, created_at, status, usage, nt, log
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
                             ?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?), ?, ?, ?, ?)`,
          [
            record.channel_id,
            record.field1,
            record.field2,
            record.field3,
            record.field4,
            record.field5,
            record.field6,
            record.field7,
            record.field8,
            record.field9,
            record.field10,
            record.field11,
            record.field12,
            record.field13,
            record.field14,
            record.field15,
            record.field16,
            record.field17,
            record.field18,
            record.field19,
            record.field20,
            record.lat,
            record.long,
            record.elevation,
            record.created_at,
            record.status,
            record.usage,
            record.nt,
            record.log,
          ]
        );
      });

      // Ejecutar inserciones
      await Promise.all(insertQueries);

      // Actualizar último ID procesado
      this.lastProcessedId = newRecords[newRecords.length - 1].entry_id;

      // Registrar progreso
      await this.logProgress(this.lastProcessedId, newRecords.length);

      return {
        processed: newRecords.length,
        lastId: this.lastProcessedId,
      };
    } catch (error) {
      throw new DatabaseError("Error syncing databases", error);
    }
  }

  /**
   * Registra el progreso de la sincronización
   */
  async logProgress(lastId, recordsProcessed) {
    try {
      await this.mainDbPool.query(
        "INSERT INTO process_log (message) VALUES (?)",
        [`Synchronized ${recordsProcessed} records. Last ID: ${lastId}`]
      );
    } catch (error) {
      console.error("Error logging progress:", error);
    }
  }

  /**
   * Cierra las conexiones a las bases de datos
   */
  async close() {
    if (this.mainDbPool) {
      await this.mainDbPool.end();
      this.mainDbPool = null;
    }
    if (this.ubibotDbPool) {
      await this.ubibotDbPool.end();
      this.ubibotDbPool = null;
    }
    this.initialized = false;
  }
}

module.exports = new OnPremiseService();

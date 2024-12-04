// collectors/shelly-collector.js
const fetch = require('node-fetch');
const config = require('../config/config-loader');
const databaseService = require('../src/services/database-service');

class ShellyCollector {
    constructor() {
        const { api, collection } = config.getConfig();
        
        // Configuración de API
        this.apiUrl = `${api.url}?id=${api.device_id}&auth_key=${api.auth_key}`;
        
        // Configuración de intervalos
        this.collectionInterval = collection.interval;
        this.expectedInterval = 10000; // 10 segundos en milisegundos
        this.maxIntervalDeviation = 2000; // 2 segundos de desviación máxima permitida
        
        // Estado del colector
        this.isRunning = false;
        this.intervalId = null;
        this.lastCollectionTime = null;
        this.lastMeasurement = null;
        
        // Configuración de reintentos
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 5000;

        // Métricas de calidad
        this.successfulCollections = 0;
        this.failedCollections = 0;
        this.totalRetries = 0;
    }

    /**
     * Inicia el proceso de recolección de datos
     */
    start() {
        if (this.isRunning) {
            console.log('El recolector ya está en funcionamiento');
            return;
        }

        console.log('🚀 Iniciando el recolector de datos Shelly...');
        this.isRunning = true;
        
        // Primera recolección inmediata
        this.collect();
        
        // Configuración del intervalo para recolecciones posteriores
        this.intervalId = setInterval(() => {
            this.collect();
        }, this.collectionInterval);
    }

    /**
     * Detiene el proceso de recolección de datos
     */
    stop() {
        if (!this.isRunning) {
            console.log('El recolector no está en funcionamiento');
            return;
        }

        console.log('🛑 Deteniendo el recolector de datos Shelly...');
        clearInterval(this.intervalId);
        this.isRunning = false;
        this.intervalId = null;
        this.printCollectionStats();
    }

    /**
     * Evalúa la calidad de la lectura basada en el intervalo de tiempo
     * @param {number} currentTimestamp - Timestamp actual en milisegundos
     * @returns {string} - Calidad de la lectura ('GOOD', 'SUSPECT', 'BAD')
     */
    evaluateReadingQuality(currentTimestamp) {
        if (!this.lastCollectionTime) {
            this.lastCollectionTime = currentTimestamp;
            return 'GOOD';
        }

        const actualInterval = currentTimestamp - this.lastCollectionTime;
        const deviation = Math.abs(actualInterval - this.expectedInterval);

        if (deviation <= this.maxIntervalDeviation) {
            return 'GOOD';
        } else if (deviation <= this.maxIntervalDeviation * 2) {
            return 'SUSPECT';
        } else {
            return 'BAD';
        }
    }

    /**
     * Realiza el proceso de recolección de datos
     */
    async collect() {
        try {
            console.log('📥 Recolectando datos del dispositivo Shelly...');
            const currentTimestamp = Date.now();
            const data = await this.fetchDeviceData();
            
            if (data && data.isok && data.data) {
                // Validar y enriquecer los datos
                const enrichedData = this.enrichData(data, currentTimestamp);
                
                // Guardar datos
                await this.saveData(enrichedData);
                
                // Actualizar métricas
                this.successfulCollections++;
                this.lastCollectionTime = currentTimestamp;
                this.lastMeasurement = enrichedData;
                this.retryCount = 0;
                
                console.log('✅ Datos guardados correctamente');
            } else {
                throw new Error('Respuesta de API inválida');
            }
        } catch (error) {
            this.failedCollections++;
            console.error('❌ Error durante la recolección:', error.message);
            await this.handleError(error);
        }
    }

    /**
     * Obtiene los datos de la API de Shelly
     * @returns {Promise<Object>} Datos del dispositivo
     */
    async fetchDeviceData() {
        const response = await fetch(this.apiUrl);
        if (!response.ok) {
            throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    }

    /**
     * Enriquece los datos con metadatos y calidad
     * @param {Object} data - Datos originales
     * @param {number} timestamp - Timestamp de la recolección
     * @returns {Object} Datos enriquecidos
     */
    enrichData(data, timestamp) {
        const readingQuality = this.evaluateReadingQuality(timestamp);
        const interval = this.lastCollectionTime ? timestamp - this.lastCollectionTime : this.expectedInterval;

        return {
            device_status: {
                ...data.data,
                reading_quality: readingQuality,
                collection_timestamp: timestamp,
                interval_ms: interval,
                sys: {
                    ...data.data.sys,
                    unixtime: Math.floor(timestamp / 1000)
                }
            }
        };
    }

    /**
     * Guarda los datos en la base de datos
     * @param {Object} data Datos a guardar
     */
    async saveData(data) {
        try {
            await databaseService.insertDeviceStatus(data);
        } catch (error) {
            throw new Error(`Error al guardar en la base de datos: ${error.message}`);
        }
    }

    /**
     * Maneja los errores durante la recolección
     * @param {Error} error Error ocurrido
     */
    async handleError(error) {
        this.retryCount++;
        this.totalRetries++;
        
        if (this.retryCount <= this.maxRetries) {
            console.log(`🔄 Reintento ${this.retryCount}/${this.maxRetries} en ${this.retryDelay/1000} segundos...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            await this.collect();
        } else {
            console.error(`❌ Se alcanzó el máximo número de reintentos. Esperando el siguiente ciclo.`);
            this.retryCount = 0;
        }
    }

    /**
     * Imprime estadísticas de recolección
     */
    printCollectionStats() {
        console.log('\n📊 Estadísticas de Recolección:');
        console.log(`Recolecciones exitosas: ${this.successfulCollections}`);
        console.log(`Recolecciones fallidas: ${this.failedCollections}`);
        console.log(`Total de reintentos: ${this.totalRetries}`);
        console.log(`Tasa de éxito: ${((this.successfulCollections / (this.successfulCollections + this.failedCollections)) * 100).toFixed(2)}%`);
    }

    /**
     * Obtiene estadísticas actuales del collector
     */
    getCollectorStats() {
        return {
            isRunning: this.isRunning,
            lastCollectionTime: this.lastCollectionTime,
            successfulCollections: this.successfulCollections,
            failedCollections: this.failedCollections,
            totalRetries: this.totalRetries,
            retryCount: this.retryCount,
            expectedInterval: this.expectedInterval,
            maxIntervalDeviation: this.maxIntervalDeviation,
            lastMeasurementQuality: this.lastMeasurement?.device_status.reading_quality
        };
    }
}

module.exports = ShellyCollector;
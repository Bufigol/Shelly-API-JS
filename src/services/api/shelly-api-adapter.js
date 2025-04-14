// src/services/api/shelly-api-adapter.js
const config = require('../../config/js_files/config-loader');
const axios = require('axios');

/**
 * Adaptador para API de Shelly Cloud
 * Proporciona una interfaz para interactuar con la API de Shelly Cloud
 * usando la configuración unificada
 */
class ShellyApiAdapter {
    constructor() {
        this.config = null;
        this.initialize();
    }

    /**
     * Inicializa el adaptador cargando la configuración
     */
    initialize() {
        const appConfig = config.getConfig();
        this.config = {
            baseUrl: appConfig.api.url,
            deviceId: appConfig.api.device_id,
            authKey: appConfig.api.auth_key,
            timeout: 10000 // Tiempo de espera predeterminado
        };

        console.log('ShellyApiAdapter inicializado');
    }

    /**
     * Recarga la configuración de la API
     */
    reloadConfig() {
        const appConfig = config.reloadConfig();
        this.config = {
            baseUrl: appConfig.api.url,
            deviceId: appConfig.api.device_id,
            authKey: appConfig.api.auth_key,
            timeout: 10000
        };

        console.log('ShellyApiAdapter: Configuración recargada');
    }

    /**
     * Obtiene la URL completa para una petición a la API
     * @param {string} endpoint - Endpoint específico de la API
     * @returns {string} - URL completa
     */
    getApiUrl(endpoint = '') {
        const separator = endpoint.startsWith('/') ? '' : '/';
        return `${this.config.baseUrl}${separator}${endpoint}`;
    }

    /**
     * Obtiene el estado del dispositivo Shelly
     * @returns {Promise<Object>} - Datos del dispositivo
     */
    async getDeviceStatus() {
        try {
            const url = this.getApiUrl();
            const params = {
                id: this.config.deviceId,
                auth_key: this.config.authKey
            };

            console.log(`Obteniendo estado del dispositivo: ${this.config.deviceId}`);
            const response = await axios.get(url, {
                params,
                timeout: this.config.timeout
            });

            if (response.data && response.data.isok === true) {
                return response.data.data;
            } else {
                throw new Error(`Error en respuesta de API: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.error('Error al obtener estado del dispositivo:', error.message);
            throw error;
        }
    }

    /**
     * Ejecuta una acción en el dispositivo Shelly
     * @param {string} action - Acción a ejecutar
     * @param {Object} params - Parámetros adicionales
     * @returns {Promise<Object>} - Resultado de la acción
     */
    async executeAction(action, params = {}) {
        try {
            const url = this.getApiUrl(`/device/${action}`);
            const requestParams = {
                id: this.config.deviceId,
                auth_key: this.config.authKey,
                ...params
            };

            console.log(`Ejecutando acción '${action}' en dispositivo: ${this.config.deviceId}`);
            const response = await axios.post(url, requestParams, {
                timeout: this.config.timeout
            });

            if (response.data && response.data.isok === true) {
                return response.data.data;
            } else {
                throw new Error(`Error en respuesta de API: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.error(`Error al ejecutar acción '${action}':`, error.message);
            throw error;
        }
    }
}

// Singleton
module.exports = new ShellyApiAdapter();
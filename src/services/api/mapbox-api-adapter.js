// src/services/api/mapbox-api-adapter.js
const config = require('../../config/js_files/config-loader');

/**
 * Adaptador para API de MapBox
 * Proporciona una interfaz para interactuar con la API de MapBox
 * usando la configuración unificada
 */
class MapboxApiAdapter {
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
            accessToken: appConfig.api.mapbox?.access_token || null
        };

        if (!this.config.accessToken) {
            console.warn('MapboxApiAdapter: Token de acceso no configurado');
        } else {
            console.log('MapboxApiAdapter inicializado');
        }
    }

    /**
     * Recarga la configuración de la API
     */
    reloadConfig() {
        const appConfig = config.reloadConfig();
        this.config = {
            accessToken: appConfig.api.mapbox?.access_token || null
        };

        console.log('MapboxApiAdapter: Configuración recargada');
    }

    /**
     * Obtiene el token de acceso para la API de MapBox
     * @returns {string|null} - Token de acceso o null si no está configurado
     */
    getAccessToken() {
        return this.config.accessToken;
    }

    /**
     * Genera la URL para un mapa estático de MapBox
     * @param {number} longitude - Longitud del centro del mapa
     * @param {number} latitude - Latitud del centro del mapa
     * @param {number} zoom - Nivel de zoom (0-22)
     * @param {number} width - Ancho de la imagen en píxeles
     * @param {number} height - Alto de la imagen en píxeles
     * @param {string} style - Estilo del mapa (streets-v11, satellite-v9, etc.)
     * @returns {string} - URL del mapa estático
     */
    getStaticMapUrl(longitude, latitude, zoom = 14, width = 600, height = 400, style = 'streets-v11') {
        if (!this.config.accessToken) {
            throw new Error('Token de acceso de MapBox no configurado');
        }

        // Validación de parámetros
        if (isNaN(longitude) || isNaN(latitude) || isNaN(zoom)) {
            throw new Error('Coordenadas o zoom inválidos');
        }

        return `https://api.mapbox.com/styles/v1/mapbox/${style}/static/` +
            `pin-s+ff0000(${longitude},${latitude})/` +
            `${longitude},${latitude},${zoom},0/${width}x${height}` +
            `?access_token=${this.config.accessToken}`;
    }

    /**
     * Configura MapBox para su uso en el cliente
     * @returns {Object} - Configuración para el cliente
     */
    getClientConfig() {
        if (!this.config.accessToken) {
            throw new Error('Token de acceso de MapBox no configurado');
        }

        return {
            accessToken: this.config.accessToken,
            mapStyle: 'mapbox://styles/mapbox/streets-v11',
            defaultZoom: 14
        };
    }
}

// Singleton
module.exports = new MapboxApiAdapter();
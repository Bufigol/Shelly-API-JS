const config = require('./config/config-loader');

/**
 * Clase que maneja la interfaz de usuario del dashboard Shelly
 * Proporciona funcionalidades para mostrar y actualizar el estado del dispositivo en tiempo real
 */
class ShellyDashboard {
    constructor() {
        // Inicializamos las propiedades de la clase
        this.updateInterval = 5000; // 5 segundos entre actualizaciones
        this.intervalId = null;
        this.deviceStatusElement = document.getElementById('device-status');
    }

    /**
     * Inicializa el dashboard y comienza las actualizaciones periódicas
     */
    initialize() {
        console.log('Inicializando Shelly Dashboard...');
        this.fetchAndUpdateStatus();
        this.startPeriodicUpdates();
    }

    /**
     * Inicia el ciclo de actualizaciones periódicas
     */
    startPeriodicUpdates() {
        this.intervalId = setInterval(() => {
            this.fetchAndUpdateStatus();
        }, this.updateInterval);
    }

    /**
     * Detiene las actualizaciones periódicas
     */
    stopPeriodicUpdates() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Obtiene el estado actual del dispositivo desde la API
     */
    async fetchDeviceStatus() {
        try {
            const { url, device_id, auth_key } = config.getConfig().api;
            const apiUrl = `${url}?id=${device_id}&auth_key=${auth_key}`;
            
            const response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error al obtener el estado del dispositivo:', error);
            throw error;
        }
    }

    /**
     * Obtiene y actualiza el estado en la interfaz
     */
    async fetchAndUpdateStatus() {
        try {
            const data = await this.fetchDeviceStatus();
            this.updateUI(data);
        } catch (error) {
            this.showError('No se pudo obtener el estado del dispositivo');
        }
    }

    /**
     * Actualiza la interfaz de usuario con los datos recibidos
     * @param {Object} data - Datos recibidos de la API
     */
    updateUI(data) {
        if (!data.isok || !data.data) {
            this.showError('Datos no válidos recibidos del dispositivo');
            return;
        }

        const deviceStatus = data.data.device_status;
        const energyMeter = deviceStatus['em:0'] || {};
        const temperature = deviceStatus['temperature:0'] || {};

        const statusHtml = `
            <h2>Estado del Dispositivo</h2>
            <div class="status-grid">
                <div class="status-section">
                    <h3>Estado General</h3>
                    <p>Online: <span class="${data.data.online ? 'status-ok' : 'status-error'}">
                        ${data.data.online ? 'Sí' : 'No'}
                    </span></p>
                    <p>Temperatura: ${temperature.tC?.toFixed(1) || 'N/A'}°C</p>
                </div>

                <div class="status-section">
                    <h3>Conexión</h3>
                    <p>WiFi SSID: ${deviceStatus.wifi?.ssid || 'N/A'}</p>
                    <p>IP: ${deviceStatus.wifi?.sta_ip || 'N/A'}</p>
                    <p>Señal WiFi: ${deviceStatus.wifi?.rssi || 'N/A'} dBm</p>
                </div>

                <div class="status-section">
                    <h3>Mediciones Eléctricas</h3>
                    <p>Voltaje Fase A: ${energyMeter.a_voltage?.toFixed(1) || 0} V</p>
                    <p>Voltaje Fase B: ${energyMeter.b_voltage?.toFixed(1) || 0} V</p>
                    <p>Voltaje Fase C: ${energyMeter.c_voltage?.toFixed(1) || 0} V</p>
                    <p>Corriente Total: ${energyMeter.total_current?.toFixed(2) || 0} A</p>
                    <p>Potencia Total: ${energyMeter.total_act_power?.toFixed(2) || 0} W</p>
                </div>
            </div>
            <div class="update-info">
                <p>Última actualización: ${new Date().toLocaleString()}</p>
            </div>
        `;

        this.deviceStatusElement.innerHTML = statusHtml;
    }

    /**
     * Muestra un mensaje de error en la interfaz
     * @param {string} message - Mensaje de error a mostrar
     */
    showError(message) {
        this.deviceStatusElement.innerHTML = `
            <div class="error-message">
                <p>❌ Error: ${message}</p>
                <p>Intentando reconectar...</p>
            </div>
        `;
    }
}

// Creamos e inicializamos el dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new ShellyDashboard();
    dashboard.initialize();

    // Manejamos el evento de cierre de la ventana
    window.addEventListener('beforeunload', () => {
        dashboard.stopPeriodicUpdates();
    });
});
const express = require('express');
const cors = require('cors');
const path = require('path');
// Estas rutas son relativas a la raíz del proyecto
const ShellyCollector = require('./collectors/shelly-collector');
const databaseService = require('./src/services/database-service');
const energyAveragesService = require('./src/services/energy-averages-service');
const totalEnergyService = require('./src/services/total-energy-service');

/**
 * Clase principal del servidor que maneja la configuración, rutas y servicios.
 * Implementa un diseño modular para facilitar el mantenimiento y las pruebas.
 */
class Server {
    constructor() {
        // Inicializamos las propiedades básicas del servidor
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Creamos una instancia del recolector de datos
        this.collector = new ShellyCollector();
        
        // Configuramos los componentes del servidor
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Configura los middleware necesarios para el servidor.
     * Incluye CORS, parsing de JSON y servicio de archivos estáticos.
     */
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    /**
     * Configura todas las rutas de la API.
     * Implementa endpoints para consultar y registrar datos del dispositivo.
     */
    setupRoutes() {
        // Ruta principal que muestra información de la API
        this.app.get('/', (req, res) => {
            res.json({ 
                message: 'Shelly API Server Running',
                version: '1.0.0',
                endpoints: {
                    latest: '/api/device-status/latest',
                    history: '/api/device-status/history',
                    postStatus: '/api/device-status'
                }
            });
        });

        // Endpoint para obtener el último estado del dispositivo
        this.app.get('/api/device-status/latest', this.handleAsyncRoute(async (req, res) => {
            const status = await databaseService.getLatestStatus();
            if (!status) {
                return res.status(404).json({ 
                    error: 'No device status found',
                    message: 'No hay datos disponibles del dispositivo'
                });
            }
            res.json(status);
        }));

        // Endpoint para obtener el historial de datos
        this.app.get('/api/device-status/history', this.handleAsyncRoute(async (req, res) => {
            const { hours = 24 } = req.query;
            const history = await databaseService.getHistory(parseInt(hours));
            res.json(history);
        }));

        // Endpoint para registrar un nuevo estado del dispositivo
        this.app.post('/api/device-status', this.handleAsyncRoute(async (req, res) => {
            const result = await databaseService.insertDeviceStatus(req.body);
            res.status(201).json({
                message: 'Estado del dispositivo registrado correctamente',
                ...result
            });
        }));
    }

    /**
     * Configura los manejadores de errores globales.
     * Incluye manejo de errores para rutas no encontradas y errores generales.
     */
    setupErrorHandling() {
        // Manejador de errores general
        this.app.use((err, req, res, next) => {
            console.error('Error no manejado:', err);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Se produjo un error inesperado'
            });
        });

        // Manejador de rutas no encontradas
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Ruta no encontrada',
                message: `La ruta ${req.originalUrl} no existe en este servidor`
            });
        });
    }

    /**
     * Envuelve los controladores de ruta para manejar errores asíncronos.
     * @param {Function} fn Función controladora a envolver
     * @returns {Function} Controlador envuelto con manejo de errores
     */
    handleAsyncRoute(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    /**
     * Inicia el servidor y los servicios asociados.
     * Verifica la conexión a la base de datos antes de iniciar.
     */
    async start() {
        try {
            // Verificamos la conexión a la base de datos
            const dbConnected = await databaseService.testConnection();
            if (!dbConnected) {
                throw new Error('No se pudo establecer conexión con la base de datos');
            }
    
            // Iniciamos el servidor HTTP
            this.server = this.app.listen(this.port, () => {
                console.log(`🚀 Servidor corriendo en http://localhost:${this.port}`);
            });
    
            // Iniciamos el recolector de datos
            this.collector.start();
            console.log('✅ Recolector de datos iniciado exitosamente');
    
            // Iniciamos el servicio de promedios de energía
            energyAveragesService.startService();
            totalEnergyService.startService();
            console.log('✅ Servicio de promedios de energía iniciado exitosamente');
    
            // Configuramos el cierre graceful
            this.setupGracefulShutdown();
    
        } catch (error) {
            console.error('Error fatal al iniciar el servidor:', error);
            process.exit(1);
        }
    }

    /**
     * Configura el manejo de cierre graceful del servidor.
     * Asegura que todos los recursos se liberen correctamente al cerrar.
     */
    setupGracefulShutdown() {
        const shutdown = async () => {
            console.log('\n🛑 Iniciando cierre graceful del servidor...');
            
            // Detenemos el servidor HTTP
            if (this.server) {
                await new Promise(resolve => this.server.close(resolve));
                console.log('✅ Servidor HTTP detenido');
            }

            // Detenemos el recolector de datos
            this.collector.stop();
            console.log('✅ Recolector de datos detenido');

            // Cerramos las conexiones a la base de datos
            await databaseService.close();
            console.log('✅ Conexiones de base de datos cerradas');

            console.log('👋 Servidor cerrado correctamente');
            process.exit(0);
        };

        // Manejamos las señales de terminación
        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        // Manejamos errores no capturados
        process.on('uncaughtException', async (error) => {
            console.error('❌ Error no capturado:', error);
            await shutdown();
        });

        process.on('unhandledRejection', async (error) => {
            console.error('❌ Promesa rechazada no manejada:', error);
            await shutdown();
        });
    }
}

// Creamos una instancia del servidor
const server = new Server();

// Exportamos lo necesario para testing y uso externo
module.exports = {
    server,
    app: server.app // Exponemos la app de Express para testing
};

// Iniciamos el servidor solo si este archivo es el punto de entrada
if (require.main === module) {
    server.start();
}
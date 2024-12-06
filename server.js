const express = require('express');
const cors = require('cors');
const path = require('path');
const ShellyCollector = require('./collectors/shelly-collector');
const databaseService = require('./src/services/database-service');
const energyAveragesService = require('./src/services/energy-averages-service');
const totalEnergyService = require('./src/services/total-energy-service');

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.collector = new ShellyCollector();
        this.services = {
            database: databaseService,
            energyAverages: energyAveragesService,
            totalEnergy: totalEnergyService
        };
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // Logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });

        // Validación de fechas middleware
        this.app.use('/api/energy', (req, res, next) => {
            if (req.query.start) {
                const start = new Date(req.query.start);
                if (isNaN(start.getTime())) {
                    return res.status(400).json({ error: 'Fecha de inicio inválida' });
                }
                req.query.start = start;
            }
            if (req.query.end) {
                const end = new Date(req.query.end);
                if (isNaN(end.getTime())) {
                    return res.status(400).json({ error: 'Fecha de fin inválida' });
                }
                req.query.end = end;
            }
            next();
        });
    }

    setupRoutes() {
        // Status endpoint
        this.app.get('/', (req, res) => {
            res.json({ 
                message: 'Shelly API Server Running',
                version: '1.0.0',
                status: this.getServiceStatus()
            });
        });

        // Device status endpoints
        this.app.get('/api/device-status/latest', this.handleAsyncRoute(async (req, res) => {
            const status = await this.services.database.getLatestStatus();
            if (!status) {
                return res.status(404).json({ error: 'No device status found' });
            }
            res.json(status);
        }));

        this.app.get('/api/device-status/history', this.handleAsyncRoute(async (req, res) => {
            const { hours = 24 } = req.query;
            const history = await this.services.database.getHistory(parseInt(hours));
            res.json(history);
        }));

        this.app.post('/api/device-status', this.handleAsyncRoute(async (req, res) => {
            const result = await this.services.database.insertDeviceStatus(req.body);
            res.status(201).json(result);
        }));

        // Energy averages endpoints
        this.app.get('/api/energy/averages/hourly', this.handleAsyncRoute(async (req, res) => {
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'Se requieren parámetros start y end' });
            }
            const data = await this.services.energyAverages.getHourlyAverages(start, end);
            res.json(data);
        }));

        this.app.get('/api/energy/averages/daily', this.handleAsyncRoute(async (req, res) => {
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'Se requieren parámetros start y end' });
            }
            const data = await this.services.energyAverages.getDailyAverages(start, end);
            res.json(data);
        }));

        this.app.get('/api/energy/averages/monthly', this.handleAsyncRoute(async (req, res) => {
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'Se requieren parámetros start y end' });
            }
            const data = await this.services.energyAverages.getMonthlyAverages(start, end);
            res.json(data);
        }));

        // Energy totals endpoints
        this.app.get('/api/energy/totals/hourly', this.handleAsyncRoute(async (req, res) => {
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'Se requieren parámetros start y end' });
            }
            const data = await this.services.totalEnergy.getHourlyTotals(start, end);
            res.json(data);
        }));

        this.app.get('/api/energy/totals/daily', this.handleAsyncRoute(async (req, res) => {
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'Se requieren parámetros start y end' });
            }
            const data = await this.services.totalEnergy.getDailyTotals(start, end);
            res.json(data);
        }));

        this.app.get('/api/energy/totals/monthly', this.handleAsyncRoute(async (req, res) => {
            const { start, end } = req.query;
            if (!start || !end) {
                return res.status(400).json({ error: 'Se requieren parámetros start y end' });
            }
            const data = await this.services.totalEnergy.getMonthlyTotals(start, end);
            res.json(data);
        }));

        // Latest data and status endpoints
        this.app.get('/api/energy/latest', this.handleAsyncRoute(async (req, res) => {
            const totals = await this.services.totalEnergy.getLatestAggregations();
            res.json(totals);
        }));

        this.app.get('/api/energy/execution-status', this.handleAsyncRoute(async (req, res) => {
            const status = await this.services.energyAverages.getLatestExecutionStatus();
            res.json(status);
        }));

        // Service status endpoints
        this.app.get('/api/service/status', (req, res) => {
            res.json(this.getServiceStatus());
        });
    }

    getServiceStatus() {
        return {
            collector: {
                running: this.collector.isRunning,
                stats: this.collector.getCollectorStats()
            },
            database: {
                connected: this.services.database.pool !== null
            },
            energyAverages: {
                initialized: this.services.energyAverages.initialized
            },
            totalEnergy: {
                initialized: this.services.totalEnergy.initialized
            },
            server: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version
            }
        };
    }

    setupErrorHandling() {
        // Error handler para errores asíncronos
        this.app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({
                error: 'Error interno del servidor',
                message: process.env.NODE_ENV === 'development' ? err.message : 'Se produjo un error inesperado',
                timestamp: new Date().toISOString()
            });
        });

        // Handler para rutas no encontradas
        this.app.use((req, res) => {
            res.status(404).json({ 
                error: 'Ruta no encontrada',
                path: req.originalUrl,
                timestamp: new Date().toISOString()
            });
        });
    }

    handleAsyncRoute(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    async start() {
        try {
            await this.initializeServices();
            
            this.server = this.app.listen(this.port, () => {
                console.log(`🚀 Servidor corriendo en http://localhost:${this.port}`);
            });

            this.setupGracefulShutdown();
        } catch (error) {
            console.error('Error fatal al iniciar el servidor:', error);
            process.exit(1);
        }
    }

    async initializeServices() {
        console.log('Initializing services...');

        const dbConnected = await this.services.database.testConnection();
        if (!dbConnected) {
            throw new Error('Database connection failed');
        }
        console.log('✅ Database connected');

        await this.services.energyAverages.initialize();
        console.log('✅ Energy averages service initialized');

        await this.services.totalEnergy.initialize();
        console.log('✅ Total energy service initialized');

        await this.collector.start();
        console.log('✅ Data collector started');
    }

    setupGracefulShutdown() {
        const shutdown = async () => {
            console.log('\n🛑 Starting graceful shutdown...');
            
            if (this.server) {
                await new Promise(resolve => this.server.close(resolve));
                console.log('✅ HTTP server stopped');
            }

            this.collector.stop();
            console.log('✅ Data collector stopped');

            await this.services.energyAverages.stop();
            console.log('✅ Energy averages service stopped');

            await this.services.totalEnergy.stop();
            console.log('✅ Total energy service stopped');

            await this.services.database.close();
            console.log('✅ Database connections closed');

            console.log('👋 Server shutdown complete');
            process.exit(0);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

        process.on('uncaughtException', async (error) => {
            console.error('❌ Uncaught exception:', error);
            await shutdown();
        });

        process.on('unhandledRejection', async (error) => {
            console.error('❌ Unhandled rejection:', error);
            await shutdown();
        });
    }
}

const server = new Server();

module.exports = {
    server,
    app: server.app
};

if (require.main === module) {
    server.start();
}
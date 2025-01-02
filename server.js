const express = require('express');
const cors = require('cors');
const path = require('path');
const ShellyCollector = require('./collectors/shelly-collector');
const databaseService = require('./src/services/database-service');
const energyAveragesService = require('./src/services/energy-averages-service');
const totalEnergyService = require('./src/services/total-energy-service');
const deviceRoutes = require('./src/routes/deviceRoutes');
const configRoutes = require('./src/routes/configRoutes');

class Server {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3030;
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
        // Serve files from the `dist` directory
        this.app.use('/dist', express.static(path.join(__dirname, 'dist')));
        // Serve files from the `src` directory for direct access
        this.app.use(express.static(path.join(__dirname, 'src')));


        // Configuración de CSP
        this.setupContentSecurityPolicy();

        // Logging middleware
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
            next();
        });
    }

    setupContentSecurityPolicy() {
        this.app.use((req, res, next) => {
            res.setHeader("Content-Security-Policy", "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval';");
            next();
        });
    }

    setupRoutes() {
        // Status endpoint
       this.app.get('/', (req, res) => {
           res.sendFile(path.join(__dirname, 'src', 'index.html'));
       });
       
      
       // Importar rutas
       const deviceRoutes = require('./src/routes/deviceRoutes');
       const configRoutes = require('./src/routes/configRoutes');
       const totalesRoutes = require('./src/routes/totalesRoutes');
       const analysisRoutes = require('./src/routes/analysisRoutes');
       const usuariosRoutes = require('./src/routes/usuariosRoutes');
       const personalRoutes = require('./src/routes/personalRoutes');
       const smsRoutes = require('./src/routes/smsRoutes');
       const sectoresRoutes = require('./src/routes/sectoresRoutes.js');
       const powerAnalysisRoutes = require('./src/routes/powerAnalysisRoutes');

       this.app.use('/api/devices', deviceRoutes);
       this.app.use('/api/config', configRoutes);
       this.app.use('/api/totals', totalesRoutes);
       this.app.use('/api/analysis', analysisRoutes);
       this.app.use('/api/usuarios', usuariosRoutes);
       this.app.use('/api/personal', personalRoutes);
       this.app.use('/api/sms', smsRoutes);
       this.app.use('/api/sectores', sectoresRoutes);
       this.app.use('/api/powerAnalysis', powerAnalysisRoutes);
   }
    setupErrorHandling() {
        // Error handler for async errors
        this.app.use((err, req, res, next) => {
            console.error('Error:', err);
            res.status(500).json({
                error: 'Internal server error',
                message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
            });
        });
    }

    handleAsyncRoute(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    getServiceStatus() {
        return {
            collector: {
                running: this.collector.isRunning,
                stats: this.collector.getCollectorStats()
            },
            database: {
                connected: this.services.database.connected
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

    async initializeServices() {
        console.log('Initializing services...');

        try {
            await this.services.database.initialize();
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
        } catch (error) {
            console.error('Error initializing services:', error);
            throw error;
        }
    }

    async start() {
        try {
            await this.initializeServices();
            
            this.server = this.app.listen(this.port, () => {
                console.log(`🚀 Server running on http://localhost:${this.port}`);
            });

            // Setup graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());
        } catch (error) {
            console.error('Error fatal al iniciar el servidor:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('\n🛑 Starting graceful shutdown...');
        
        if (this.server) {
            await new Promise(resolve => this.server.close(resolve));
            console.log('✅ HTTP server stopped');
        }

        this.collector.stop();
        console.log('✅ Data collector stopped');

        await this.services.database.close();
        console.log('✅ Database connections closed');

        console.log('👋 Server shutdown complete');
        process.exit(0);
    }
}

const server = new Server();
server.start();

module.exports = {
    server,
    app: server.app
};
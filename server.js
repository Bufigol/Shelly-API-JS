const express = require("express");
const cors = require("cors");
const path = require("path");
const ShellyCollector = require("./collectors/shelly-collector");
const UbibotCollector = require("./collectors/ubibot-collector");
const databaseService = require("./src/services/database-service");
const energyAveragesService = require("./src/services/energy-averages-service");
const totalEnergyService = require("./src/services/total-energy-service");
const deviceRoutes = require("./src/routes/deviceRoutes");
const configRoutes = require("./src/routes/configRoutes");

class Server {
  /**
   * Initializes a new instance of the Server class.
   * Sets up the Express application, configures the port,
   * initializes data collectors, and defines services to be used.
   * Also sets up middleware, routes, and error handling for the server.
   */

  constructor() {
    this.app = express();
    this.port = process.env.PORT || 1337;
    this.shellyCollector = new ShellyCollector();
    this.ubibotCollector = new UbibotCollector();
    this.services = {
      database: databaseService,
      energyAverages: energyAveragesService,
      totalEnergy: totalEnergyService,
    };
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Configures middleware for the application.
   *
   * Uses the `cors` middleware to allow cross-origin requests
   * from the specified origin. Uses the `express.json()` middleware
   * to parse JSON bodies. Serves files from the `dist` and `src`
   * directories. Configures Content Security Policy (CSP)
   * to prevent XSS attacks. Finally, logs all incoming requests.
   */
  setupMiddleware() {
    const corsOptions = {
      origin: ["http://localhost:3000", "http://192.168.1.130:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    };
    this.app.use(cors(corsOptions));
    this.app.use(express.json());

    // Configurar el middleware para las rutas de la API
    this.app.use("/storage/api", (req, res, next) => {
      res.header("Content-Type", "application/json");
      next();
    });

    // Servir archivos estáticos bajo la ruta /storage
    this.app.use("/storage", express.static(path.join(__dirname, "public")));

    // Configuración de CSP
    this.setupContentSecurityPolicy();

    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Configures the Content Security Policy (CSP) for the application.
   *
   * This sets the CSP headers to restrict resource loading:
   * - Allows default resources to be loaded only from the same origin.
   * - Permits fonts to be loaded from the same origin and data URIs.
   * - Allows scripts to be loaded from the same origin and permits inline scripts and eval.
   *
   * @private
   */

  setupContentSecurityPolicy() {
    this.app.use((req, res, next) => {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; font-src 'self' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval';"
      );
      next();
    });
  }

  /**
   * Configura las rutas del servidor
   *
   * El servidor tiene un endpoint status en /
   * y utiliza los siguientes módulos de rutas bajo /storage/api:
   *
   * - deviceRoutes
   * - configRoutes
   * - totalesRoutes
   * - analysisRoutes
   * - usuariosRoutes
   * - personalRoutes
   * - smsRoutes
   * - sectoresRoutes
   * - powerAnalysisRoutes
   * - gpsRoutes
   * - beaconsRoutes
   * - ubibotRoutes
   * - gpsDataRoutes
   *
   * @memberof Server
   */
  setupRoutes() {
    // Importar rutas
    const deviceRoutes = require("./src/routes/deviceRoutes");
    const configRoutes = require("./src/routes/configRoutes");
    const totalesRoutes = require("./src/routes/totalesRoutes");
    const analysisRoutes = require("./src/routes/analysisRoutes");
    const usuariosRoutes = require("./src/routes/usuariosRoutes");
    const personalRoutes = require("./src/routes/personalRoutes");
    const smsRoutes = require("./src/routes/smsRoutes");
    const sectoresRoutes = require("./src/routes/sectoresRoutes.js");
    const powerAnalysisRoutes = require("./src/routes/powerAnalysisRoutes");
    const gpsRoutes = require("./src/routes/gpsRoutes");
    const beaconsRoutes = require("./src/routes/beaconsRoutes");
    const ubibotRoutes = require("./src/routes/ubibotRoutes");
    const gpsDataRoutes = require("./src/routes/gpsDataRoutes");
    const blindSpotRoutes = require("./src/routes/blindSpotRoutes");

    // Crear un router para agrupar todas las rutas de la API
    const apiRouter = express.Router();

    // Configurar las rutas de la API
    apiRouter.use("/devices", deviceRoutes);
    apiRouter.use("/config", configRoutes);
    apiRouter.use("/totals", totalesRoutes);
    apiRouter.use("/analysis", analysisRoutes);
    apiRouter.use("/usuarios", usuariosRoutes);
    apiRouter.use("/personal", personalRoutes);
    apiRouter.use("/sms", smsRoutes);
    apiRouter.use("/sectores", sectoresRoutes);
    apiRouter.use("/powerAnalysis", powerAnalysisRoutes);
    apiRouter.use("/gps", gpsRoutes);
    apiRouter.use("/beacons", beaconsRoutes);
    apiRouter.use("/ubibot", ubibotRoutes);
    apiRouter.use("/blindspot", blindSpotRoutes);
    apiRouter.use("/gps-data", gpsDataRoutes);

    // Montar el router de la API en /storage/api
    this.app.use("/storage/api", apiRouter);

    // Ruta específica para la página principal
    this.app.get("/storage", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // Catch-all route para React Router
    this.app.get("/storage/*", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });
  }

  setupErrorHandling() {
    // Error handler for async errors
    this.app.use((err, req, res, next) => {
      console.error("Error:", err);
      res.status(500).json({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? err.message
            : "An unexpected error occurred",
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
        shelly: {
          running: this.shellyCollector.isRunning,
          stats: this.shellyCollector.getCollectorStats(),
        },
        ubibot: {
          running: this.ubibotCollector.isRunning,
          stats: this.ubibotCollector.getCollectorStats(),
        },
      },
      database: {
        connected: this.services.database.connected,
      },
      energyAverages: {
        initialized: this.services.energyAverages.initialized,
      },
      totalEnergy: {
        initialized: this.services.totalEnergy.initialized,
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    };
  }

  async initializeServices() {
    console.log("Initializing services...");

    try {
      await this.services.database.initialize();
      const dbConnected = await this.services.database.testConnection();
      if (!dbConnected) {
        throw new Error("Database connection failed");
      }
      console.log("✅ Database connected");

      await this.services.energyAverages.initialize();
      console.log("✅ Energy averages service initialized");

      await this.services.totalEnergy.initialize();
      console.log("✅ Total energy service initialized");

      await this.shellyCollector.start();
      console.log("✅ Shelly Data collector started");

      //await this.ubibotCollector.start();
      //console.log("✅ Ubibot data collector started");
    } catch (error) {
      console.error("Error initializing services:", error);
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
      process.on("SIGTERM", () => this.shutdown());
      process.on("SIGINT", () => this.shutdown());
    } catch (error) {
      console.error("Error fatal al iniciar el servidor:", error);
      process.exit(1);
    }
  }

  async shutdown() {
    console.log("\n🛑 Starting graceful shutdown...");
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
      console.log("✅ HTTP server stopped");
    }
    this.shellyCollector.stop();
    console.log("✅ Shelly Data collector stopped");

    this.ubibotCollector.stop();
    console.log("✅ Ubibot data collector stopped");

    await this.services.database.close();
    console.log("✅ Database connections closed");

    console.log("👋 Server shutdown complete");
    process.exit(0);
  }
}

const server = new Server();
server.start().catch((err) => console.error("Error al iniciar el servidor:", err));

module.exports = {
  server,
  app: server.app,
};
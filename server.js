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
      origin: ["http://localhost:3000", "http://localhost:8080"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    };
    this.app.use(cors(corsOptions));
    this.app.use(express.json());

    this.app.use("/api", (req, res, next) => {
      res.header("Content-Type", "application/json");
      next();
    });

    // Servir archivos estáticos
    this.app.use(express.static(path.join(__dirname, "public")));
    this.app.use;

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
   * y utiliza los siguientes módulos de rutas:
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

    // Primero configurar todas las rutas de la API
    this.app.use("/api", configRoutes); // Cambiado para manejar todas las rutas de config bajo /api
    this.app.use("/api/devices", deviceRoutes);
    this.app.use("/api/totals", totalesRoutes);
    this.app.use("/api/analysis", analysisRoutes);
    this.app.use("/api/usuarios", usuariosRoutes);
    this.app.use("/api/personal", personalRoutes);
    this.app.use("/api/sms", smsRoutes);
    this.app.use("/api/sectores", sectoresRoutes);
    this.app.use("/api/powerAnalysis", powerAnalysisRoutes);
    this.app.use("/api/gps", gpsRoutes);
    this.app.use("/api/beacons", beaconsRoutes);
    this.app.use("/api/ubibot", ubibotRoutes);
    this.app.use("/api/blindspot", blindSpotRoutes);
    this.app.use("/gps-data", gpsDataRoutes);

    // Servir archivos estáticos después de las rutas de la API
    this.app.use(express.static(path.join(__dirname, "public")));

    // Ruta específica para la página principal
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    // Catch-all route para React Router debe ser lo último
    this.app.get("*", (req, res, next) => {
      // Si la petición es para la API, pasar al siguiente middleware
      if (req.url.startsWith("/api/")) {
        return next();
      }
      // Si no es una petición de API, enviar el index.html
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });
  }

  /**
   * Sets up error handling for the server. This method is used to
   * install a middleware function that will catch any async errors
   * and send a 500 response with a JSON body containing an error
   * message and the original error message (if in development mode).
   * @see https://expressjs.com/en/guide/error-handling.html
   * @private
   */
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

  /**
   * Wraps a route handler function to catch any async errors and call
   * `next(err)` with the error.
   *
   * @param {Function} fn - The route handler function to wrap.
   * @return {Function} A new route handler function that wraps the original
   *   one and catches any errors.
   */
  handleAsyncRoute(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Returns an object with information about the current status of the server's services.
   *
   * @return {Object} Object with the following properties:
   * - collector: Object with information about the Shelly and Ubibot collectors.
   *   - shelly: Object with properties running (a boolean indicating if the collector is running) and stats (an object with collector statistics).
   *   - ubibot: Object with properties running (a boolean indicating if the collector is running) and stats (an object with collector statistics).
   * - database: Object with a single property connected (a boolean indicating if the database connection is established).
   * - energyAverages: Object with a single property initialized (a boolean indicating if the energy averages service has been initialized).
   * - totalEnergy: Object with a single property initialized (a boolean indicating if the total energy service has been initialized).
   * - server: Object with properties about the server's runtime environment.
   *   - uptime: Number of seconds the server has been running.
   *   - memory: Object with properties rss, heapTotal, and heapUsed, with the memory usage of the server in bytes.
   *   - nodeVersion: String with the version of Node.js running the server.
   */
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

  /**
   * Initializes all services and collectors necessary for the server.
   *
   * This method performs the following actions:
   * 1. Initializes the database service and tests the connection.
   * 2. Initializes the energy averages service.
   * 3. Initializes the total energy service.
   * 4. Starts the Shelly data collector.
   * 5. Starts the Ubibot data collector.
   *
   * If any of these steps fail, an error is logged and re-thrown to be
   * handled by the caller.
   *
   * @throws {Error} If any service or collector fails to initialize.
   */

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

  /**
   * Inicializa los servicios y levanta el servidor. Si ocurre un error,
   * se registra en la consola y se sale del proceso con estado 1.
   * @throws {Error} Si ocurre un error al inicializar los servicios o levantar
   * el servidor.
   */
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

  /**
   * Gracefully shuts down the server, stopping all services and closing all
   * database connections.
   *
   * This function is called automatically when the process receives a SIGTERM or
   * SIGINT signal.
   *
   * @return {Promise<void>}
   */
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
server
  .start()
  .catch((err) => console.error("Error al iniciar el servidor:", err));

module.exports = {
  server,
  app: server.app,
};

// src/middlewares/apiAuthMiddleware.js
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

class ApiAuthMiddleware {
  constructor() {
    this.jwtConfig = null;

    // Intentar inicializar inmediatamente
    try {
      this.initializeJwtConfig();
    } catch (error) {
      console.error("Error during JWT configuration initialization:", error);

      // Añadir un método de respaldo para inicialización
      process.nextTick(() => {
        this.initializeJwtConfig();
      });
    }
  }

  /**
   * Inicialización de configuración JWT con múltiples estrategias
   */
  initializeJwtConfig() {
    const possiblePaths = [
      path.resolve(__dirname, "../config/jsons/jwt.json"),
      path.resolve(__dirname, "../../config/jsons/jwt.json"),
      path.resolve(__dirname, "../jwt.json"),
      path.resolve(process.cwd(), "jwt.json"),
      path.resolve(__dirname, "jwt.json"),
    ];

    let loadedConfig = null;

    for (const configPath of possiblePaths) {
      try {
        console.log(`Attempting to load JWT config from: ${configPath}`);

        if (fs.existsSync(configPath)) {
          const rawConfig = fs.readFileSync(configPath, "utf8");
          loadedConfig = JSON.parse(rawConfig);

          console.log("JWT Config Loaded Successfully:", {
            secretLength: loadedConfig.secret ? loadedConfig.secret.length : 0,
            issuer: loadedConfig.issuer,
            path: configPath,
          });
          break;
        }
      } catch (error) {
        console.warn(
          `Could not load config from ${configPath}:`,
          error.message
        );
      }
    }

    if (!loadedConfig) {
      const error = new Error("No valid JWT configuration found");
      console.error(error);
      throw error;
    }

    // Validar configuración
    if (!loadedConfig.secret || !loadedConfig.issuer) {
      const error = new Error(
        "Invalid JWT configuration: secret or issuer missing"
      );
      console.error(error);
      throw error;
    }

    this.jwtConfig = loadedConfig;
  }

  /**
   * Método de refresco de configuración
   */
  refreshJwtConfig() {
    try {
      this.initializeJwtConfig();
    } catch (error) {
      console.error("Error refreshing JWT configuration:", error);
    }
  }

  /**
   * Genera un token JWT
   * @param {Object} payload - Datos a incluir en el token
   * @returns {string} Token JWT generado
   */
  generateToken(payload) {
    this.ensureJwtConfigLoaded();

    try {
      return jwt.sign(payload, this.jwtConfig.secret, {
        issuer: this.jwtConfig.issuer,
        algorithm: "HS256",
        expiresIn: this.jwtConfig.expiresIn || "1h",
      });
    } catch (error) {
      console.error("Token Generation Error:", error);
      throw error;
    }
  }

  /**
   * Asegura que la configuración JWT esté cargada
   * @throws {Error} Si la configuración no está disponible
   */
  ensureJwtConfigLoaded() {
    if (!this.jwtConfig) {
      console.error("JWT Configuration not loaded");
      this.refreshJwtConfig();

      if (!this.jwtConfig) {
        throw new Error("Unable to load JWT configuration");
      }
    }
  }

  /**
   * Middleware de autenticación con debugging extensivo
   */
  authenticate(req, res, next) {
    // Guarda una referencia a 'this'
    const self = this;

    try {
      self.ensureJwtConfigLoaded();

      console.log("\n--- Authentication Middleware ---");
      console.log("Request Headers:", JSON.stringify(req.headers, null, 2));

      const authHeader = req.headers.authorization;

      // Validación de encabezado de autorización
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.warn("Invalid or missing Authorization header");
        return res.status(401).json({
          error: "Authentication Failed",
          message: "No authentication token provided or invalid format",
          details: {
            receivedHeader: authHeader,
            expectedFormat: "Bearer [token]",
          },
        });
      }

      const token = authHeader.split(" ")[1];
      console.log("Extracted Token:", token);

      // Verificación de token con opciones explícitas
      const decoded = jwt.verify(token, self.jwtConfig.secret, {
        issuer: self.jwtConfig.issuer,
        algorithms: ["HS256"],
      });

      // Logging de token decodificado
      console.log("Decoded Token:", JSON.stringify(decoded, null, 2));

      req.user = decoded;
      next();
    } catch (error) {
      // Manejo detallado de errores de token
      console.error("Token Verification Error:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      // Diferentes tipos de errores
      switch (error.name) {
        case "TokenExpiredError":
          return res.status(401).json({
            error: "Token Expired",
            message: "Authentication token has expired",
            details: {
              expiredAt: error.expiredAt,
            },
          });

        case "JsonWebTokenError":
          return res.status(401).json({
            error: "Invalid Token",
            message: "Token verification failed",
            details: {
              reason: error.message,
              possibleCauses: [
                "Incorrect signature",
                "Malformed token",
                "Token tampered",
              ],
            },
          });

        case "NotBeforeError":
          return res.status(401).json({
            error: "Token Not Active",
            message: "Token is not yet active",
            details: {
              notBefore: error.date,
            },
          });

        default:
          console.error("Unhandled Authentication Error:", error);
          return res.status(500).json({
            error: "Authentication Error",
            message: "An unexpected authentication error occurred",
            details: error.message,
          });
      }
    }
  }

  /**
   * Middleware para verificar permisos de usuario
   * @param {string[]} requiredPermissions - Permisos requeridos
   */
  checkPermissions(requiredPermissions) {
    const self = this;
    return (req, res, next) => {
      try {
        if (!req.user) {
          console.warn("No user authenticated in permission check");
          return res.status(401).json({
            error: "Authentication Required",
            message: "No user authenticated",
            details: "User object missing from request",
          });
        }

        const userPermissions = req.user.permissions || [];
        console.log("User Permissions:", userPermissions);
        console.log("Required Permissions:", requiredPermissions);

        const hasAllPermissions = requiredPermissions.every((perm) =>
          userPermissions.includes(perm)
        );

        if (!hasAllPermissions) {
          console.warn("Insufficient permissions");
          return res.status(403).json({
            error: "Insufficient Permissions",
            message: "You do not have the required permissions",
            details: {
              requiredPermissions,
              userPermissions,
            },
          });
        }

        next();
      } catch (error) {
        console.error("Permission Check Error:", error);
        next(error);
      }
    };
  }
}

// Exportar una instancia única pero con método para refrescar
const authMiddleware = new ApiAuthMiddleware();
module.exports = authMiddleware;

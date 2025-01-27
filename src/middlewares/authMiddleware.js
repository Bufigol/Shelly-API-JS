const {
  configLoader,
  initializeConfig,
} = require("../config/js_files/config-loader");
const jwt = require("jsonwebtoken");

class AuthMiddleware {
  constructor() {
    this.jwtSecret = configLoader.getConfig().jwt.secret;
    this.jwtIssuer = configLoader.getConfig().jwt.issuer;
  }

  // Middleware de autenticación básica
  authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          error: "Authentication Error",
          message: "No authentication token provided",
        });
      }

      if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "Authentication Error",
          message: "Invalid token format",
        });
      }

      const token = authHeader.split(" ")[1];

      // Verify the token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your_jwt_secret"
      );

      // Add user info to request
      req.user = decoded;

      next();
    } catch (error) {
      return res.status(401).json({
        error: "Authentication Error",
        message: "Invalid token",
      });
    }
  }

  // Middleware para verificar permisos específicos
  checkPermissions(requiredPermissions) {
    return (req, res, next) => {
      // Aquí podrías implementar lógica más compleja de permisos
      // Por ahora solo verificamos la autenticación básica
      this.authenticate(req, res, next);
    };
  }

  // Middleware para limitar tasa de solicitudes
  rateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutos por defecto
      max = 100, // 100 solicitudes por ventana por defecto
    } = options;

    const requests = new Map();

    return (req, res, next) => {
      const clientIp = req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Limpiar solicitudes antiguas
      requests.forEach((timestamp, ip) => {
        if (timestamp < windowStart) {
          requests.delete(ip);
        }
      });

      // Verificar límite de tasa
      const clientRequests = Array.from(requests.entries()).filter(
        ([ip, timestamp]) => ip === clientIp && timestamp > windowStart
      ).length;

      if (clientRequests >= max) {
        return res.status(429).json({
          error: "Rate Limit Exceeded",
          message: "Demasiadas solicitudes, intente más tarde",
          timestamp: new Date().toISOString(),
        });
      }

      // Registrar nueva solicitud
      requests.set(clientIp, now);
      next();
    };
  }
}

let authMiddleware;

(async () => {
  await initializeConfig();
  authMiddleware = new AuthMiddleware();
  module.exports = authMiddleware;
})();

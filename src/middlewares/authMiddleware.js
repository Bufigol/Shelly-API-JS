// src/middlewares/authMiddleware.js
const jwt = require("jsonwebtoken");
const configLoader = require("../config/js_files/config-loader"); 

class AuthMiddleware {
  constructor() {
    this.jwtSecret = configLoader.getConfig().jwt.secret;
    this.jwtIssuer = configLoader.getConfig().jwt.issuer;
  }

  authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
      });
      req.user = decoded;
      next();
    } catch (error) {
      console.error("Error al verificar token:", error);
      return res.status(403).json({ message: "Invalid token" });
    }
  }

  authorize(requiredPermissions) {
    return (req, res, next) => {
      const userPermissions = req.user?.permissions || "";
      const hasRequiredPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission)
      );
      if (!hasRequiredPermissions) {
        return res
          .status(403)
          .json({ message: "Unauthorized: Insufficient permissions" });
      }
      next();
    };
  }
}

module.exports = new AuthMiddleware();

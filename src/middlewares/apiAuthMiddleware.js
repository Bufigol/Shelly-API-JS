// src/middlewares/apiAuthMiddleware.js
const jwt = require("jsonwebtoken");
const configLoader = require("../config/js_files/config-loader");

class ApiAuthMiddleware {
  constructor() {
    this.jwtSecret =
      process.env.JWT_SECRET || configLoader.getConfig().jwt.secret;
    this.jwtIssuer =
      process.env.JWT_ISSUER || configLoader.getConfig().jwt.issuer;
  }

  generateToken(payload) {
    return jwt.sign(payload, this.jwtSecret, {
      issuer: this.jwtIssuer,
      expiresIn: "1h",
    });
  }

  authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({
          message: "No authentication token provided or invalid format",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: this.jwtIssuer,
      });
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid token" });
    }
  }

  checkPermissions(requiredPermissions) {
    return (req, res, next) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: "No user authenticated" });
        }

        const userPermissions = req.user.permissions || [];

        const hasAllPermissions = requiredPermissions.every((perm) =>
          userPermissions.includes(perm)
        );

        if (!hasAllPermissions) {
          return res.status(403).json({ message: "Insufficient permissions" });
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}

module.exports = new ApiAuthMiddleware();

// authMiddleware.js
const configLoader = require('../config/js_files/config-loader');
const jwt = require('jsonwebtoken');
const { AuthenticationError, BusinessError } = require('../utils/errors');

class AuthMiddleware {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || configLoader.getConfig().jwt.secret;
        this.jwtIssuer = process.env.JWT_ISSUER || configLoader.getConfig().jwt.issuer;
    }

    generateToken(payload) {
        return jwt.sign(payload, this.jwtSecret, {
            issuer: this.jwtIssuer,
            expiresIn: '1h'
        });
    }

    authenticate(req, res, next) {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AuthenticationError('No authentication token provided or invalid format'));
        }

        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, this.jwtSecret, { issuer: this.jwtIssuer });
            req.user = decoded;
            next();
        } catch (error) {
            return next(new AuthenticationError('Invalid token'));
        }
    }


    async checkPermissions(requiredPermissions) {
        return async (req, res, next) => {
            try {
                if (!req.user) {
                    return next(new AuthenticationError('No user authenticated'));
                }

                const userPermissions = req.user.permissions || [];

                const hasAllPermissions = requiredPermissions.every(perm => userPermissions.includes(perm));

                if (!hasAllPermissions) {
                    return next(new BusinessError('Insufficient permissions', 'PERMISSION_DENIED'));
                }

                next();
            } catch (error) {
                next(error);
            }
        };
    }

    rateLimit(options = {}) {
        const {
            windowMs = 15 * 60 * 1000,
            max = 100,
        } = options;

        const requests = new Map();

        return (req, res, next) => {
            const clientIp = req.ip;
            const now = Date.now();
            const windowStart = now - windowMs;

            requests.forEach((timestamp, ip) => {
                if (timestamp < windowStart) {
                    requests.delete(ip);
                }
            });

            const clientRequests = Array.from(requests.entries()).filter(
                ([ip, timestamp]) => ip === clientIp && timestamp > windowStart
            ).length;

            if (clientRequests >= max) {
                return next(new BusinessError('Rate Limit Exceeded', 'RATE_LIMIT'));
            }

            requests.set(clientIp, now);
            next();
        };
    }
}

module.exports = new AuthMiddleware();
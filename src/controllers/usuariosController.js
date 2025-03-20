// src/controllers/usuariosController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const sgMailConfig = require("../config/jsons/sgMailConfig.json");
const databaseService = require("../../src/services/database-service");
const crypto = require("crypto");
const { AuthenticationError } = require('../utils/errors');
const jwtConfig = require('../config/js_files/jwt-config');

// Configurar la API Key de SendGrid
sgMail.setApiKey(sgMailConfig.api_key);

class usuariosController {
    async handleLogin(req, res, next) {
        const { username, password } = req.body;
        try {
            const [user] = await databaseService.pool.query(
                "SELECT * FROM users WHERE username = ?",
                [username]
            );

            if (user.length === 0) {
                return next(new AuthenticationError('Invalid credentials'));
            }

            const validPassword = await bcrypt.compare(password, user[0].password);
            if (!validPassword) {
                return next(new AuthenticationError('Invalid credentials'));
            }
            const jwtSecret = process.env.JWT_SECRET || jwtConfig.getJwtConfig().secret;
            const jwtIssuer = process.env.JWT_ISSUER || jwtConfig.getJwtConfig().issuer;
            const jwtExpiresIn = process.env.JWT_EXPIRES_IN || jwtConfig.getJwtConfig().expiresIn;

            const token = jwt.sign(
                {
                    userId: user[0].id,
                    permissions: user[0].permissions,
                    username: user[0].username,
                },
                jwtSecret,
                {
                    issuer: jwtIssuer,
                    expiresIn:  jwtExpiresIn
                }
            );

            res.json({
                token,
                user: {
                    id: user[0].id,
                    username: user[0].username,
                    email: user[0].email,
                    permissions: user[0].permissions,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    async getUsers(req, res) {
        try {
            const [users] = await databaseService.pool.query(
                "SELECT id, username, email, permissions FROM users"
            );
            res.json(users);
        } catch (error) {
            console.error("Error fetching users:", error);
            res.status(500).send("Server Error");
        }
    }

    async registerUser(req, res) {
        const { userId, username, password, email, permissions } = req.body;
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

        try {
            if (userId) {
                // Update existing user
                await databaseService.pool.query(
                    "UPDATE users SET username = ?, email = ?, permissions = ? WHERE id = ?",
                    [username, email, permissions, userId]
                );
                res.sendStatus(200);
            } else {
                // Create new user
                const [existingUser] = await databaseService.pool.query(
                    "SELECT * FROM users WHERE username = ?",
                    [username]
                );
                if (existingUser.length > 0) {
                    return res.status(400).send("Username already exists");
                }

                await databaseService.pool.query(
                    "INSERT INTO users (username, password, email, permissions) VALUES (?, ?, ?, ?)",
                    [username, hashedPassword, email, permissions]
                );
                res.sendStatus(201);
            }
        } catch (error) {
            console.error("Error registering or updating user:", error);
            res.status(500).send("Server Error");
        }
    }

    async requestPasswordReset(req, res) {
        const { email } = req.body;

        try {
            const resetToken = crypto.randomBytes(20).toString("hex");
            const resetTokenExpiry = Date.now() + 3600000; // 1 hora de validez

            const resetData = await databaseService.requestPasswordReset(
                email,
                resetToken,
                resetTokenExpiry
            );

            const resetUrl = `/reset-password/${resetToken}`;
            const msg = {
                to: resetData.email,
                from: sgMailConfig.email_contacto.from_verificado,
                subject: "Restablecimiento de Contraseña",
                text: `Para restablecer tu contraseña, haz clic en el siguiente enlace: ${resetUrl}`,
            };

            await sgMail
                .send(msg)
                .then((response) => {
                    console.log("Email sent", response); // Añade este log
                })
                .catch((error) => {
                    console.error("Error al enviar el email", error);
                });
            res.send("Se ha enviado un enlace de restablecimiento a su email");
        } catch (error) {
            console.error(
                "Error al solicitar restablecimiento de contraseña:",
                error
            );
            res.status(500).send("Error del servidor");
        }
    }

    async resetPassword(req, res) {
        const { token, newPassword } = req.body;
        try {
            const resetData = await databaseService.resetPassword(
                null,
                newPassword,
                token,
                null
            );
            const msg = {
                to: resetData.email,
                from: sgMailConfig.email_contacto.from_verificado,
                subject: "Contraseña restablecida con éxito",
                text: "Su contraseña ha sido restablecida exitosamente.",
            };

            await sgMail.send(msg);
            res.send("Contraseña restablecida con éxito");
        } catch (error) {
            console.error("Error al restablecer la contraseña:", error);
            res.status(500).send("Error del servidor");
        }
    }
}

module.exports = new usuariosController();
// src/services/out/authService.js
const databaseService = require("../database-service");
const apiAuthMiddleware = require("../../middlewares/apiAuthMiddleware");
const configLoader = require("../../config/js_files/config-loader");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");

// Cargar configuración de SendGrid si existe
try {
  const sgConfig = require("../../config/jsons/sgMailConfig.json");
  sgMail.setApiKey(sgConfig.SENDGRID_API_KEY);
} catch (error) {
  console.error("Error cargando configuración de SendGrid:", error);
}

/**
 * Servicio de autenticación que maneja todas las operaciones relacionadas con usuarios
 * y autenticación de la aplicación
 */
class AuthService {
  /**
   * Autentica a un usuario y genera un token JWT
   * @param {string} email - El email del usuario
   * @param {string} password - La contraseña del usuario
   * @returns {Object} Objeto con propiedad success y token si la autenticación es exitosa
   */
  async login(email, password) {
    // 1. Buscar el usuario en la base de datos
    const [users] = await databaseService.pool.query(
      "SELECT * FROM api_usuario WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return { success: false };
    }

    const user = users[0];

    // 2. Verificar la contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return { success: false };
    }

    // 3. Obtener los permisos del usuario
    const [userPermissions] = await databaseService.pool.query(
      `SELECT p.nombre_pemiso
       FROM api_usuarios_permisos up
       JOIN api_permisos p ON up.id_permiso = p.id_Permisos
       WHERE up.id_usuario = ?`,
      [user.id_Usuario]
    );

    const permissions = userPermissions.map((p) => p.nombre_pemiso);

    // 4. Crear el payload para el token JWT
    const payload = {
      id_Usuario: user.id_Usuario,
      email: user.email,
      permissions: permissions,
    };

    // 5. Generar el token JWT
    const token = apiAuthMiddleware.generateToken(payload);

    return {
      success: true,
      token,
      userId: user.id_Usuario,
      email: user.email,
      permissions,
    };
  }

  /**
   * Crea un nuevo usuario en el sistema
   * @param {string} email - El email del nuevo usuario
   * @param {string} password - La contraseña del nuevo usuario
   * @returns {Object} Objeto con el ID del usuario creado
   */
  async crearUsuario(email, password) {
    // 1. Verificar si el usuario ya existe
    const [existingUsers] = await databaseService.pool.query(
      "SELECT id_Usuario FROM api_usuario WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      throw new Error("El correo ya está registrado");
    }

    // 2. Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insertar el nuevo usuario en la base de datos
    const [result] = await databaseService.pool.query(
      "INSERT INTO api_usuario (email, password) VALUES (?, ?)",
      [email, hashedPassword]
    );

    const userId = result.insertId;

    // 4. Asignar el permiso "visualizador" por defecto
    const [visualizadorPermission] = await databaseService.pool.query(
      "SELECT id_Permisos FROM api_permisos WHERE nombre_pemiso = ?",
      ["visualizador"]
    );

    if (visualizadorPermission.length > 0) {
      await databaseService.pool.query(
        "INSERT INTO api_usuarios_permisos (id_usuario, id_permiso) VALUES (?, ?)",
        [userId, visualizadorPermission[0].id_Permisos]
      );
    }

    return { userId };
  }

  /**
   * Solicita un reseteo de contraseña enviando un email con un token
   * @param {string} email - El email del usuario
   * @param {string} baseUrl - URL base para el enlace de reseteo
   */
  async solicitarResetPassword(email, baseUrl) {
    // 1. Verificar que el usuario existe
    const [users] = await databaseService.pool.query(
      "SELECT id_Usuario FROM api_usuario WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      // No revelamos si el email existe o no por seguridad
      // Simplemente terminamos la función sin hacer nada
      return;
    }

    const userId = users[0].id_Usuario;

    // 2. Generar token único
    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 3. Almacenar token en la base de datos (crear tabla si no existe)
    await databaseService.pool.query(`
      CREATE TABLE IF NOT EXISTS api_password_reset (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_usuario INT NOT NULL,
        token VARCHAR(100) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (id_usuario) REFERENCES api_usuario(id_Usuario)
      )
    `);

    // 4. Eliminar tokens anteriores para este usuario
    await databaseService.pool.query(
      "DELETE FROM api_password_reset WHERE id_usuario = ?",
      [userId]
    );

    // 5. Insertar nuevo token (válido por 1 hora)
    await databaseService.pool.query(
      `INSERT INTO api_password_reset (id_usuario, token, expires_at) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [userId, tokenHash]
    );

    // 6. Enviar email con el link de reseteo
    const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

    try {
      // Obtener configuración de email
      let fromEmail = "noreply@yourapp.com"; // Valor por defecto
      try {
        const sgConfig = configLoader.getValue("email") || {};
        const apiKey = sgConfig.SENDGRID_API_KEY;
        if (apiKey) {
          sgMail.setApiKey(apiKey);
          console.log("Configuración de SendGrid cargada correctamente");
        } else {
          console.warn(
            "No se encontró API Key de SendGrid en la configuración"
          );
        }
      } catch (error) {
        console.error("Error cargando configuración de SendGrid:", error);
      }

      await sgMail.send({
        to: email,
        from: fromEmail,
        subject: "Reseteo de contraseña",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reseteo de contraseña</h2>
            <p>Has solicitado resetear tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
            <a href="${resetUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Resetear Contraseña</a>
            <p>Este enlace es válido por 1 hora.</p>
            <p>Si no solicitaste resetear tu contraseña, ignora este correo.</p>
          </div>
        `,
      });
    } catch (error) {
      console.error("Error al enviar email:", error);
      // No devolvemos error para no revelar si el email existe
    }
  }

  /**
   * Confirma un reseteo de contraseña utilizando el token recibido
   * @param {string} token - El token de reseteo
   * @param {string} password - La nueva contraseña
   * @returns {Object} Objeto con propiedad success y mensaje
   */
  async confirmarResetPassword(token, password) {
    // 1. Calcular hash del token
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // 2. Buscar el token en la base de datos
    const [tokens] = await databaseService.pool.query(
      `SELECT id_usuario, expires_at FROM api_password_reset 
       WHERE token = ? AND expires_at > NOW()`,
      [tokenHash]
    );

    if (tokens.length === 0) {
      return {
        success: false,
        message: "Token inválido o expirado",
      };
    }

    const userId = tokens[0].id_usuario;

    // 3. Hashear la nueva contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Actualizar la contraseña del usuario
    await databaseService.pool.query(
      "UPDATE api_usuario SET password = ? WHERE id_Usuario = ?",
      [hashedPassword, userId]
    );

    // 5. Eliminar el token usado
    await databaseService.pool.query(
      "DELETE FROM api_password_reset WHERE id_usuario = ?",
      [userId]
    );

    return {
      success: true,
    };
  }
}

module.exports = new AuthService();

// src/services/out/authService.js
const databaseService = require("../database-service");
const apiAuthMiddleware = require("../../middlewares/apiAuthMiddleware");
const configLoader = require("../../config/js_files/config-loader");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const loggingService = require("./loggingService");

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
   * @param {boolean} asignarEditor - Si se debe asignar también el permiso de editor
   * @param {number} idUsuarioCreador - ID del usuario que está creando el nuevo usuario
   * @returns {Object} Objeto con el ID del usuario creado y sus permisos
   */
  async crearUsuario(
    email,
    password,
    asignarEditor = false,
    idUsuarioCreador = null
  ) {
    const connection = await databaseService.pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Verificar si el usuario ya existe
      const [existingUsers] = await connection.query(
        "SELECT id_Usuario FROM api_usuario WHERE email = ?",
        [email]
      );

      if (existingUsers.length > 0) {
        await connection.rollback();
        throw new ValidationError("El correo ya está registrado");
      }

      // 2. Hashear la contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // 3. Insertar el nuevo usuario en la base de datos
      const [result] = await connection.query(
        "INSERT INTO api_usuario (email, password) VALUES (?, ?)",
        [email, hashedPassword]
      );

      const userId = result.insertId;

      // 4. Asignar el permiso "visualizador" por defecto
      const [visualizadorPermission] = await connection.query(
        "SELECT id_Permisos FROM api_permisos WHERE nombre_pemiso = ?",
        ["visualizador"]
      );

      const permisos = ["visualizador"];

      if (visualizadorPermission.length > 0) {
        await connection.query(
          "INSERT INTO api_usuarios_permisos (id_usuario, id_permiso) VALUES (?, ?)",
          [userId, visualizadorPermission[0].id_Permisos]
        );
      }

      // 5. Asignar permiso de editor si se solicitó
      if (asignarEditor) {
        const [editorPermission] = await connection.query(
          "SELECT id_Permisos FROM api_permisos WHERE nombre_pemiso = ?",
          ["editor"]
        );

        if (editorPermission.length > 0) {
          await connection.query(
            "INSERT INTO api_usuarios_permisos (id_usuario, id_permiso) VALUES (?, ?)",
            [userId, editorPermission[0].id_Permisos]
          );
          permisos.push("editor");
        }
      }

      // 6. Registrar la acción en el log si hay un usuario creador
      if (idUsuarioCreador) {
        await loggingService.registrarModificacionUsuario(
          idUsuarioCreador,
          "USUARIO",
          userId,
          "creacion",
          null,
          JSON.stringify({ email, permisos })
        );
      }

      await connection.commit();
      return { userId, permisos };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Solicita un reseteo de contraseña enviando un email con un token
   * @param {string} email - El email del usuario
   * @returns {Promise<void>}
   */
  async solicitarResetPassword(email) {
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

    // 3. Eliminar tokens anteriores para este usuario
    await databaseService.pool.query(
      "DELETE FROM api_password_reset WHERE id_usuario = ?",
      [userId]
    );

    // 4. Insertar nuevo token (válido por 1 hora)
    await databaseService.pool.query(
      `INSERT INTO api_password_reset (id_usuario, token, expires_at) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))`,
      [userId, tokenHash]
    );

    // 5. Enviar email con el token
    try {
      // Obtener configuración de email desde config-loader
      const emailConfig = configLoader.getValue("email");

      // Verificar si tenemos una configuración válida
      if (emailConfig && emailConfig.SENDGRID_API_KEY) {
        // Configurar SendGrid
        sgMail.setApiKey(emailConfig.SENDGRID_API_KEY);

        // Determinar el remitente
        const fromEmail =
          emailConfig.email_contacto?.from_verificado || "noreply@yourapp.com";

        // Enviar el email
        await sgMail.send({
          to: email,
          from: fromEmail,
          subject: "Token para reseteo de contraseña",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Token para Reseteo de Contraseña</h2>
              <p>Has solicitado resetear tu contraseña. Utiliza el siguiente token para completar el proceso:</p>
              <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; text-align: center; margin: 20px 0; word-break: break-all;">
                ${resetToken}
              </div>
              <p>Para completar el proceso, proporciona este token junto con tu nueva contraseña en el sistema.</p>
              <p>Este token es válido por 1 hora.</p>
              <p>Si no solicitaste resetear tu contraseña, ignora este correo o notifica a soporte.</p>
            </div>
          `,
        });
        console.log(`✅ Token de reseteo enviado a ${email}`);
      } else {
        console.error(
          "❌ No se pudo enviar email: SendGrid no configurado correctamente"
        );
        await loggingService.registrarError(
          "AuthService.solicitarResetPassword",
          `Error enviando token de reseteo a ${email}: SendGrid no configurado`,
          new Error("Email service not configured")
        );
      }
    } catch (error) {
      console.error("❌ Error al enviar email:", error);
      // Registrar el error pero no revelar información al usuario
      await loggingService.registrarError(
        "AuthService.solicitarResetPassword",
        `Error enviando token de reseteo a ${email}`,
        error
      );
    }
  }

  /**
   * Confirma un reseteo de contraseña utilizando el token recibido
   * @param {string} token - El token de reseteo
   * @param {string} password - La nueva contraseña
   * @returns {Object} Objeto con propiedad success y mensaje
   */
  async confirmarResetPassword(token, password) {
    try {
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
          code: "INVALID_TOKEN",
        };
      }

      const userId = tokens[0].id_usuario;

      // 3. Verificar que el usuario todavía existe
      const [users] = await databaseService.pool.query(
        "SELECT id_Usuario FROM api_usuario WHERE id_Usuario = ?",
        [userId]
      );

      if (users.length === 0) {
        return {
          success: false,
          message: "Usuario no encontrado",
          code: "USER_NOT_FOUND",
        };
      }

      // 4. Hashear la nueva contraseña
      const hashedPassword = await bcrypt.hash(password, 10);

      // 5. Actualizar la contraseña del usuario
      await databaseService.pool.query(
        "UPDATE api_usuario SET password = ? WHERE id_Usuario = ?",
        [hashedPassword, userId]
      );

      // 6. Eliminar el token usado
      await databaseService.pool.query(
        "DELETE FROM api_password_reset WHERE id_usuario = ?",
        [userId]
      );

      // 7. Registrar el cambio exitoso
      await loggingService.registrarError(
        "AuthService.confirmarResetPassword",
        `Contraseña actualizada para usuario ID: ${userId}`,
        { type: "INFO", message: "Password reset successful" }
      );

      return {
        success: true,
        message: "Contraseña actualizada exitosamente",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error al confirmar reseteo de contraseña:", error);
      await loggingService.registrarError(
        "AuthService.confirmarResetPassword",
        "Error en reseteo de contraseña",
        error
      );

      return {
        success: false,
        message: "Error procesando el reseteo de contraseña",
        code: "SERVER_ERROR",
      };
    }
  }
}

module.exports = new AuthService();

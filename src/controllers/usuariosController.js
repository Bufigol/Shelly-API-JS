const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sgMail = require("@sendgrid/mail");
const sgMailConfig = require("../config/jsons/sgMailConfig.json");

class usuariosController {
  async handleLogin(req, res) {
    const { username, password } = req.body;
    try {
      const [user] = await pool.query(
        "SELECT * FROM users WHERE username = ?",
        [username]
      );
      if (user.length === 0) {
        return res.status(400).send("Invalid username or password");
      }

      const validPassword = await bcrypt.compare(password, user[0].password);
      if (!validPassword) {
        return res.status(400).send("Invalid username or password");
      }

      const token = jwt.sign(
        { userId: user[0].id, permissions: user[0].permissions },
        "your_jwt_secret",
        { expiresIn: "1h" }
      );
      res.json({ token });
    } catch (error) {
      console.error("Error logging in user:", error);
      res.status(500).send("Server Error");
    }
  }

  async getUsers(req, res) {
    try {
      const [users] = await pool.query(
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
        await pool.query(
          "UPDATE users SET username = ?, email = ?, permissions = ? WHERE id = ?",
          [username, email, permissions, userId]
        );
        res.sendStatus(200);
      } else {
        // Create new user
        const [existingUser] = await pool.query(
          "SELECT * FROM users WHERE username = ?",
          [username]
        );
        if (existingUser.length > 0) {
          return res.status(400).send("Username already exists");
        }

        await pool.query(
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
      const [user] = await pool.query("SELECT * FROM users WHERE email = ?", [
        email,
      ]);
      if (user.length === 0) {
        return res.status(404).send("Usuario no encontrado");
      }

      const resetToken = crypto.randomBytes(20).toString("hex");
      const resetTokenExpiry = Date.now() + 3600000; // 1 hora de validez

      await pool.query(
        "UPDATE users SET resetToken = ?, resetTokenExpiry = ? WHERE id = ?",
        [resetToken, resetTokenExpiry, user[0].id]
      );

      const resetUrl = `https://tns.thenextsecurity.cl/storage/reset-password/${resetToken}`;
      const msg = {
        to: email,
        from: sgMailConfig.email_contacto.from_verificado, // Usa el correo que hayas verificado con SendGrid
        subject: "Restablecimiento de Contraseña",
        text: `Para restablecer tu contraseña, haz clic en el siguiente enlace: ${resetUrl}`,
      };

      await sgMail
        .send(msg)
        .then(() => {
          console.log("Email sent");
        })
        .catch((error) => {
          console.error(error);
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
      // Verificar el token y actualizar la contraseña
      const [user] = await pool.query(
        "SELECT * FROM users WHERE resetToken = ? AND resetTokenExpiry > ?",
        [token, Date.now()]
      );
      if (user.length === 0) {
        return res.status(400).send("Token inválido o expirado");
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        "UPDATE users SET password = ?, resetToken = NULL, resetTokenExpiry = NULL WHERE id = ?",
        [hashedPassword, user[0].id]
      );

      // Enviar correo de confirmación
      const msg = {
        to: user[0].email,
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

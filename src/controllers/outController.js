// src/controllers/outController.js
const databaseService = require("../services/database-service");
const apiAuthMiddleware = require("../middlewares/apiAuthMiddleware");
const bcrypt = require("bcrypt");

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar el usuario en la base de datos
    const [users] = await databaseService.pool.query(
      "SELECT * FROM api_usuario WHERE email = ?",
      [email]
    );
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. Verificar la contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
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
      permissions: permissions, // Usar los permisos reales del usuario
    };

    // 5. Generar el token JWT
    const token = apiAuthMiddleware.generateToken(payload);

    // 6. Enviar el token en la respuesta
    res.json({ token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to login" });
  }
};

exports.crearUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Insertar el nuevo usuario en la base de datos
    const [result] = await databaseService.pool.query(
      "INSERT INTO api_usuario (email, password) VALUES (?, ?)",
      [email, hashedPassword]
    );

    const newUserId = result.insertId;

    // 3. Asignar el permiso "visualizador" por defecto
    const [visualizadorPermission] = await databaseService.pool.query(
      "SELECT id_Permisos FROM api_permisos WHERE nombre_pemiso = ?",
      ["visualizador"]
    );

    if (visualizadorPermission.length > 0) {
      await databaseService.pool.query(
        "INSERT INTO api_usuarios_permisos (id_usuario, id_permiso) VALUES (?, ?)",
        [newUserId, visualizadorPermission[0].id_Permisos]
      );
    }

    // 4. Enviar una respuesta exitosa
    res
      .status(201)
      .json({ message: "User created successfully", id_Usuario: newUserId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// src/controllers/outController.js
const databaseService = require('../services/databaseService');
const apiAuthMiddleware = require('../middleware/apiAuthMiddleware'); // Importa el middleware de autenticación
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscar el usuario en la base de datos
    const [users] = await databaseService.pool.query('SELECT * FROM api_usuario WHERE email = ?', [email]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. Verificar la contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Crear el payload para el token JWT
    const payload = {
      id_Usuario: user.id_Usuario,
      email: user.email,
      // Incluir otros datos relevantes del usuario (ej: roles, permisos)
      permissions: ['ver_equipos_realtime', 'ver_equipos_historico', 'exportar_equipos_historico', 'ver_datos_raw'], // Ejemplo de permisos
    };

    // 4. Generar el token JWT
    const token = apiAuthMiddleware.generateToken(payload);

    // 5. Enviar el token en la respuesta
    res.json({ token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to login' });
  }
};

exports.crearUsuario = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Hashear la contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Insertar el nuevo usuario en la base de datos
    const [result] = await databaseService.pool.query(
      'INSERT INTO api_usuario (email, password) VALUES (?, ?)',
      [email, hashedPassword]
    );

    // 3. Enviar una respuesta exitosa
    res.status(201).json({ message: 'User created successfully', id_Usuario: result.insertId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};
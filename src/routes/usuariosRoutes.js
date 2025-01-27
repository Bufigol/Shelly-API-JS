const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares');
const usuariosController = require('../controllers/usuariosController');

router.post('/login', usuariosController.handleLogin.bind(usuariosController));

// Proteger rutas que requieren autenticación
router.get('/users', authMiddleware.authenticate.bind(authMiddleware),
    usuariosController.getUsers.bind(usuariosController)
);

router.post('/register', authMiddleware.authenticate.bind(authMiddleware),
    usuariosController.registerUser.bind(usuariosController)
);

router.post('/request-password-reset',
    usuariosController.requestPasswordReset.bind(usuariosController)
);

router.post('/reset-password',
    usuariosController.resetPassword.bind(usuariosController)
);

module.exports = router;
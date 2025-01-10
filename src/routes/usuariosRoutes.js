const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares');
const usuariosController = require('../controllers/usuariosController');

router.post('/login', 
    authMiddleware.authenticate.bind(authMiddleware), 
    usuariosController.handleLogin.bind(usuariosController)
);

router.get('/users',
    authMiddleware.authenticate.bind(authMiddleware),
    usuariosController.getUsers.bind(usuariosController)
);

router.post('/register', 
    authMiddleware.authenticate.bind(authMiddleware), 
    usuariosController.registerUser.bind(usuariosController)
);

router.post('/request-password-reset',
    authMiddleware.authenticate.bind(authMiddleware),
    usuariosController.requestPasswordReset.bind(usuariosController)
);

router.post('/reset-password',
    authMiddleware.authenticate.bind(authMiddleware),
    usuariosController.resetPassword.bind(usuariosController)
);

module.exports = router;
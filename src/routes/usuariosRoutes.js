const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares');
const usuariosController = require('../controllers/usuariosController');

router.post('/login', 
    authMiddleware.authenticate, 
    usuariosController.handleLogin
);

router.get('/users',
    authMiddleware.authenticate,
    usuariosController.getUsers
);

router.post('/register', 
    authMiddleware.authenticate, 
    usuariosController.registerUser
);

router.post('/request-password-reset',
    authMiddleware.authenticate,
    usuariosController.requestPasswordReset
);

router.post('/reset-password',
    authMiddleware.authenticate,
    usuariosController.resetPassword
);

module.exports = router;
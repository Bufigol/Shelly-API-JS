// src/middlewares/apiValidationMiddleware.js
const { body, param, query, validationResult } = require("express-validator");

class ApiValidationMiddleware {
  /**
   * Ejecuta las validaciones y verifica si hay errores
   * @returns Middleware para verificar errores de validación
   */
  checkValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }
    next();
  };

  /**
   * Validación para el login de usuarios
   */
  validateLogin = [
    body("email").isEmail().withMessage("Formato de email inválido"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para la creación de usuarios
   */
  validateUsuario = [
    body("email").isEmail().withMessage("Formato de email inválido"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para la solicitud de reseteo de contraseña
   */
  validateEmail = [
    body("email").isEmail().withMessage("Formato de email inválido"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para el reseteo de contraseña mediante token (enfoque API)
   */
  validateTokenAndPassword = [
    body("token")
      .notEmpty()
      .withMessage("Token es requerido")
      .isLength({ min: 32, max: 128 })
      .withMessage("Formato de token inválido"),

    body("password")
      .isLength({ min: 6 })
      .withMessage("La contraseña debe tener al menos 6 caracteres"),

    this.checkValidationErrors,
  ];

  /**
   * Validación para ID de equipo
   */
  validateEquipoId = [
    param("id").isInt().withMessage("ID de equipo debe ser un número entero"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para ID de faena
   */
  validateFaenaId = [
    param("id").isInt().withMessage("ID de faena debe ser un número entero"),
    this.checkValidationErrors,
  ];



  /**
   * Validación para actualización de faena
   */
  validateFaenaUpdate = [
    param("id").isInt().withMessage("ID de faena debe ser un número entero"),
    body("nombre_faena")
      .optional()
      .isString()
      .withMessage("Nombre de faena debe ser texto"),
    body("fecha_inicio")
      .optional()
      .isISO8601()
      .withMessage("Formato de fecha de inicio inválido"),
    body("fecha_fin")
      .optional()
      .isISO8601()
      .withMessage("Formato de fecha de fin inválido"),
    body("id_cliente")
      .optional()
      .isInt()
      .withMessage("ID de cliente debe ser un número entero"),
    body("id_Faena_externo")
      .optional()
      .isString()
      .withMessage("ID de faena externo debe ser texto"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para parámetros de histórico
   */
  validateHistoricoParams = [
    param("id").isInt().withMessage("ID de equipo debe ser un número entero"),
    query("fecha_inicio")
      .optional()
      .isISO8601()
      .withMessage("Formato de fecha de inicio inválido"),
    query("fecha_fin")
      .optional()
      .isISO8601()
      .withMessage("Formato de fecha de fin inválido"),
    query("id_faena")
      .optional()
      .isInt()
      .withMessage("ID de faena debe ser un número entero"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para actualización de configuración
   */
  validateConfiguracion = [
    body().isObject().withMessage("Los datos deben ser un objeto"),
    body("*.valor")
      .exists()
      .withMessage("El valor es requerido para cada parámetro"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para asociar equipo a máquina
   */
  validateAsociarEquipo = [
    body("id_equipo")
      .isInt()
      .withMessage("ID de equipo debe ser un número entero"),
    body("identificador_externo")
      .isString()
      .withMessage("Identificador externo debe ser texto"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para ID de máquina
   */
  validateMaquinaId = [
    param("id").isInt().withMessage("ID de máquina debe ser un número entero"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para actualización de máquina
   */
  validateMaquinaUpdate = [
    param("id").isInt().withMessage("ID de máquina debe ser un número entero"),
    body("identificador_externo")
      .optional()
      .isString()
      .withMessage("Identificador externo debe ser texto")
      .isLength({ min: 1, max: 100 })
      .withMessage("Identificador externo debe tener entre 1 y 100 caracteres"),
    body("id_equipo")
      .optional()
      .isInt()
      .withMessage("ID de equipo debe ser un número entero"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para búsqueda de histórico consolidado
   */
  validateHistoricoConsolidado = [
    query("identificador_externo")
      .notEmpty()
      .withMessage("Identificador externo es obligatorio"),
    query("fecha_inicio")
      .optional()
      .isISO8601()
      .withMessage("Formato de fecha de inicio inválido"),
    query("fecha_fin")
      .optional()
      .isISO8601()
      .withMessage("Formato de fecha de fin inválido"),
    query("id_faena")
      .optional()
      .isInt()
      .withMessage("ID de faena debe ser un número entero"),
    this.checkValidationErrors,
  ];

  /**
   * Validación para búsqueda por faena externa
   */
  validateFaenaExterna = [
    query("id_Faena_externo")
      .notEmpty()
      .withMessage("ID de faena externo es obligatorio"),
    this.checkValidationErrors,
  ];
}

module.exports = new ApiValidationMiddleware();

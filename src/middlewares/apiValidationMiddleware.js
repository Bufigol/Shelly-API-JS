// src/middlewares/apiValidationMiddleware.js
const { body, param, query, validationResult } = require("express-validator");

/**
 * Verificación de errores de validación - usado en todos los validadores
 */
const checkValidationErrors = (req, res, next) => {
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
 * Función personalizada para validar la restricción de 3 meses entre fechas
 */
const checkFechasRestricciones = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }

  // Validar la restricción de fechas
  const { fecha_inicio, fecha_fin } = req.query;

  // Si no hay fechas, se obtienen los datos de los últimos tres meses
  if (!fecha_inicio && !fecha_fin) {
    // No necesitamos hacer nada aquí, la lógica se manejará en el controlador
    return next();
  }

  const TRES_MESES_MS = 3 * 30 * 24 * 60 * 60 * 1000; // Aproximadamente 3 meses en milisegundos
  const ahora = Date.now();

  // Convertir strings a números si es necesario
  const inicioTimestamp = fecha_inicio ? parseInt(fecha_inicio, 10) : null;
  const finTimestamp = fecha_fin ? parseInt(fecha_fin, 10) : null;

  // Validaciones específicas según los casos

  // Caso: Solo fecha inicio
  if (inicioTimestamp && !finTimestamp) {
    if (inicioTimestamp > ahora) {
      return res.status(400).json({
        success: false,
        message: "La fecha de inicio no puede ser mayor a la fecha actual",
      });
    }
    // La fecha de fin se calculará en el controlador como inicio + 3 meses o fecha actual
    return next();
  }

  // Caso: Solo fecha fin
  if (!inicioTimestamp && finTimestamp) {
    if (finTimestamp > ahora) {
      return res.status(400).json({
        success: false,
        message: "La fecha de fin no puede ser mayor a la fecha actual",
      });
    }
    // La fecha de inicio se calculará en el controlador como fin - 3 meses
    return next();
  }

  // Caso: Ambas fechas
  if (inicioTimestamp && finTimestamp) {
    // Validar que inicio sea anterior a fin
    if (inicioTimestamp >= finTimestamp) {
      return res.status(400).json({
        success: false,
        message: "La fecha de inicio debe ser anterior a la fecha de fin",
      });
    }

    // Validar que no superen los 3 meses de diferencia
    if (finTimestamp - inicioTimestamp > TRES_MESES_MS) {
      return res.status(400).json({
        success: false,
        message:
          "El rango entre fecha_inicio y fecha_fin no puede superar los 3 meses",
      });
    }

    // Validar que fin no sea mayor a la fecha actual
    if (finTimestamp > ahora) {
      return res.status(400).json({
        success: false,
        message: "La fecha de fin no puede ser mayor a la fecha actual",
      });
    }
  }

  next();
};

// Validadores comunes para reutilización
const emailValidator = body("email")
  .isEmail()
  .withMessage("Formato de email inválido");

const passwordValidator = body("password")
  .isLength({ min: 6 })
  .withMessage("La contraseña debe tener al menos 6 caracteres");

// Exporta un objeto con todos los validadores agrupados por funcionalidad
module.exports = {
  // ===================================================================
  // AUTENTICACIÓN Y USUARIOS
  // ===================================================================

  /**
   * Validación para el login de usuarios
   */
  validateLogin: [emailValidator, passwordValidator, checkValidationErrors],

  /**
   * Validación para la creación de usuarios
   */
  validateUsuario: [
    emailValidator,
    passwordValidator,
    body("asignarEditor")
      .optional()
      .isBoolean()
      .withMessage("asignarEditor debe ser un valor booleano"),
    checkValidationErrors,
  ],

  /**
   * Validación para la solicitud de reseteo de contraseña
   */
  validateEmail: [emailValidator, checkValidationErrors],

  /**
   * Validación para el reseteo de contraseña mediante token
   */
  validateTokenAndPassword: [
    body("token")
      .notEmpty()
      .withMessage("Token es requerido")
      .isLength({ min: 32, max: 128 })
      .withMessage("Formato de token inválido"),
    passwordValidator,
    checkValidationErrors,
  ],

  // ===================================================================
  // VALIDACIONES DE ENTIDADES PRINCIPALES
  // ===================================================================

  /**
   * Validación para ID de equipo
   */
  validateEquipoId: [
    param("id").isInt().withMessage("ID de equipo debe ser un número entero"),
    checkValidationErrors,
  ],

  /**
   * Validación para ID de faena
   */
  validateFaenaId: [
    param("id").isInt().withMessage("ID de faena debe ser un número entero"),
    checkValidationErrors,
  ],

  /**
   * Validación para ID de máquina
   */
  validateMaquinaId: [
    param("id").isInt().withMessage("ID de máquina debe ser un número entero"),
    checkValidationErrors,
  ],

  // ===================================================================
  // VALIDACIONES DE ACTUALIZACIÓN
  // ===================================================================

  /**
   * Validación para actualización de faena
   */
  validateFaenaUpdate: [
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
    checkValidationErrors,
  ],

  /**
   * Validación para actualización de máquina
   */
  validateMaquinaUpdate: [
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
    checkValidationErrors,
  ],

  /**
   * Validación para actualización de configuración
   */
  validateConfiguracion: [
    body().isObject().withMessage("Los datos deben ser un objeto"),
    body("*.valor")
      .exists()
      .withMessage("El valor es requerido para cada parámetro"),
    checkValidationErrors,
  ],

  /**
   * Validación para asociar equipo a máquina
   */
  validateAsociarEquipo: [
    body("id_equipo")
      .isInt()
      .withMessage("ID de equipo debe ser un número entero"),
    body("identificador_externo")
      .isString()
      .withMessage("Identificador externo debe ser texto"),
    checkValidationErrors,
  ],

  // ===================================================================
  // VALIDACIONES DE CONSULTAS
  // ===================================================================

  /**
   * Validación para parámetros de histórico
   */
  validateHistoricoParams: [
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
    checkValidationErrors,
  ],

  /**
   * Validación para búsqueda de histórico consolidado
   */
  validateHistoricoConsolidado: [
    query("identificador_externo")
      .notEmpty()
      .withMessage("Identificador externo es obligatorio"),
    query("fecha_inicio")
      .optional()
      .isInt({ min: 0 })
      .withMessage(
        "Fecha de inicio debe ser un timestamp válido (número entero)"
      ),
    query("fecha_fin")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Fecha de fin debe ser un timestamp válido (número entero)"),
    query("id_faena")
      .optional()
      .isInt()
      .withMessage("ID de faena debe ser un número entero"),
    checkFechasRestricciones,
  ],

  /**
   * Validación para consulta de datos en tiempo real
   */
  validateRealtimeQuery: [
    query("identificador_externo")
      .optional()
      .isString()
      .withMessage("El identificador externo debe ser una cadena de texto"),
    checkValidationErrors,
  ],

  /**
   * Validación para búsqueda por faena externa
   */
  validateFaenaExterna: [
    query("id_Faena_externo")
      .notEmpty()
      .withMessage("ID de faena externo es obligatorio"),
    checkValidationErrors,
  ],

  validateFaenaExternoUpdate: [
    param("id_externo")
      .notEmpty()
      .withMessage("Identificador externo de faena es requerido"),

    body().custom((body) => {
      // Modificar los campos permitidos
      const allowedFields = ["id_Faena_externo", "id_cliente_externo"];
      const receivedFields = Object.keys(body);

      const invalidFields = receivedFields.filter(
        (field) => !allowedFields.includes(field)
      );

      if (invalidFields.length > 0) {
        throw new Error(
          `Campos no permitidos: ${invalidFields.join(
            ", "
          )}. Solo se permiten: ${allowedFields.join(", ")}`
        );
      }

      return true;
    }),

    body("id_Faena_externo")
      .optional()
      .isString()
      .withMessage("ID de faena externo debe ser texto")
      .isLength({ min: 1, max: 45 })
      .withMessage("ID de faena externo debe tener entre 1 y 45 caracteres"),

    // Modificar este validador para id_cliente_externo
    body("id_cliente_externo")
      .optional()
      .isString()
      .withMessage("ID cliente externo debe ser texto")
      .isLength({ min: 1, max: 45 })
      .withMessage("ID cliente externo debe tener entre 1 y 45 caracteres"),

    checkValidationErrors,
  ],
};

// src/tests/test_notificaciones/setup.js
const notificationController = require('../../controllers/notificationController');
const mysql = require('mysql2/promise');
const config = require('../../config/js_files/config-loader');
const mockNow = require('jest-mock-now');
const { resetDatabaseState } = require('../reconexión/helpers/dbHelpers');

// Configuración global para Jest
beforeAll(async () => {
  // Configurar la conexión a la base de datos para tests
  const dbConfig = config.getConfig().database;
  global.testDB = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.username,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
  
  // Guardar estado original del NotificationController para restaurarlo
  global.originalBuffers = {
    temperatureAlertsByHour: { ...notificationController.temperatureAlertsByHour },
    disconnectionAlertsByHour: { ...notificationController.disconnectionAlertsByHour },
    tempAlertCounters: { ...notificationController.tempAlertCounters }
  };

  // Desactivar temporizadores del NotificationController para evitar interferencias
  if (notificationController.hourlyProcessingTimer) {
    clearTimeout(notificationController.hourlyProcessingTimer);
    notificationController.hourlyProcessingTimer = null;
  }
  if (notificationController.recurringHourlyTimer) {
    clearInterval(notificationController.recurringHourlyTimer);
    notificationController.recurringHourlyTimer = null;
  }
  if (notificationController.cleanupTimer) {
    clearInterval(notificationController.cleanupTimer);
    notificationController.cleanupTimer = null;
  }

  console.log("✅ Configuración de pruebas inicializada correctamente");
});

// Después de cada test, restaurar el estado
afterEach(async () => {
  // Restaurar los búfers del NotificationController
  notificationController.temperatureAlertsByHour = JSON.parse(JSON.stringify(global.originalBuffers.temperatureAlertsByHour));
  notificationController.disconnectionAlertsByHour = JSON.parse(JSON.stringify(global.originalBuffers.disconnectionAlertsByHour));
  notificationController.tempAlertCounters = JSON.parse(JSON.stringify(global.originalBuffers.tempAlertCounters));
  
  // Restaurar estado en la base de datos para canales de prueba
  await resetDatabaseState();
  
  // Restaurar el tiempo mockado
  jest.restoreAllMocks();
});

afterAll(async () => {
  // Cerrar la conexión de BD
  if (global.testDB) {
    await global.testDB.end();
    console.log("📌 Conexión a base de datos cerrada");
  }
});
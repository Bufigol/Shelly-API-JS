// src/tests/testNotificationController.js

const notificationController = require('../controllers/notificationController');
const moment = require('moment-timezone');

/**
 * Script para probar el controlador de notificaciones
 */
async function runTests() {
    console.log('=== Test de NotificationController ===');
    console.log('Hora actual:', new Date().toLocaleString());

    // Prueba 1: Verificar inicialización
    console.log('\n1. Verificando inicialización del controlador:');
    console.log('- ¿Está dentro del horario laboral?', notificationController.isWithinWorkingHours());

    // Prueba 2: Procesar una lectura de temperatura dentro del rango
    console.log('\n2. Procesando lectura dentro del rango:');
    await notificationController.processTemperatureReading(
        'test-channel-1',
        'Canal de prueba 1',
        -18.5, // Temperatura dentro del rango
        moment().format('YYYY-MM-DD HH:mm:ss'),
        -20.0, // Mínimo
        -16.0, // Máximo
        true // Operativo
    );

    // Prueba 3: Procesar una lectura de temperatura fuera del rango
    console.log('\n3. Procesando lectura fuera del rango:');
    await notificationController.processTemperatureReading(
        'test-channel-2',
        'Canal de prueba 2',
        -15.0, // Temperatura fuera del rango
        moment().format('YYYY-MM-DD HH:mm:ss'),
        -20.0, // Mínimo
        -16.0, // Máximo
        true // Operativo
    );

    // Verificar contadores
    console.log('\nEstado actual de contadores:');
    console.log(notificationController.tempAlertCounters);

    // Prueba 4: Procesar tres lecturas consecutivas fuera de rango
    console.log('\n4. Procesando tres lecturas consecutivas fuera de rango:');

    for (let i = 0; i < 3; i++) {
        console.log(`\nLectura ${i + 1}/3 fuera de rango:`);
        await notificationController.processTemperatureReading(
            'test-channel-3',
            'Canal de prueba 3',
            -15.0, // Temperatura fuera del rango
            moment().format('YYYY-MM-DD HH:mm:ss'),
            -20.0, // Mínimo
            -16.0, // Máximo
            true // Operativo
        );
    }

    // Prueba 5: Procesar un canal no operativo
    console.log('\n5. Procesando canal no operativo:');
    await notificationController.processTemperatureReading(
        'test-channel-4',
        'Canal de prueba 4',
        -15.0, // Temperatura fuera del rango
        moment().format('YYYY-MM-DD HH:mm:ss'),
        -20.0, // Mínimo
        -16.0, // Máximo
        false // No operativo
    );

    // Prueba 6: Simular cambio de estado de conexión
    console.log('\n6. Simulando cambio de estado de conexión:');
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    await notificationController.processConnectionStatusChange(
        'test-channel-5',
        'Canal de prueba 5',
        false, // No está en línea
        true, // Estaba offline
        oneHourAgo, // Desde hace una hora
        null, // No se ha enviado alerta
        true // Operativo
    );

    // Verificar búfer de alertas
    console.log('\nEstado actual de búfer de alertas de temperatura:');
    console.log(`- Alertas en búfer: ${notificationController.temperatureAlertBuffer.alerts.length}`);

    console.log('\nEstado actual de búfer de alertas de desconexión:');
    console.log(`- Alertas en búfer: ${notificationController.disconnectionAlertBuffer.alerts.length}`);

    // Prueba 7: Procesar alertas (si no estamos en horario laboral)
    if (!notificationController.isWithinWorkingHours()) {
        console.log('\n7. Procesando alertas (fuera de horario laboral):');
        await notificationController.processBufferedTemperatureAlerts();
        await notificationController.processBufferedDisconnectionAlerts();
    } else {
        console.log('\n7. No se procesan alertas (estamos en horario laboral)');
    }

    console.log('\n=== Pruebas completadas ===');
}

// Ejecutar pruebas
runTests()
    .then(() => {
        console.log('Script de prueba finalizado correctamente.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error durante las pruebas:', error);
        process.exit(1);
    });
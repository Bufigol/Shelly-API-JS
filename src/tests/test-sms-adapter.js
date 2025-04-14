// test-sms-adapter.js
const smsServiceAdapter = require('../services/sms/sms-service-adapter');
const configLoader = require('../config/js_files/config-loader');

/**
 * Script para probar el adaptador de servicio SMS
 * Este script verifica la configuración y las funcionalidades básicas
 */
async function testSmsAdapter() {
    console.log('>> INICIANDO PRUEBA DE ADAPTADOR SMS');

    // 1. Verificar estado del adaptador
    console.log('\n1. ESTADO DEL ADAPTADOR SMS');
    console.log(`Adaptador inicializado: ${smsServiceAdapter.initialized ? '✓' : '✗'}`);
    console.log(`Configuración válida: ${smsServiceAdapter.isConfigured() ? '✓' : '✗'}`);

    if (!smsServiceAdapter.isConfigured()) {
        console.log('\n⚠️ El adaptador SMS no está correctamente configurado.');
        console.log('Comprobando configuración en archivo unificado...');

        const config = configLoader.getConfig();
        console.log(`- Configuración SMS presente: ${config.sms ? '✓' : '✗'}`);
        console.log(`- Configuración del módem: ${config.sms && config.sms.modem ? '✓' : '✗'}`);
        console.log(`- URL del módem: ${config.sms && config.sms.modem ? config.sms.modem.url : 'No configurada'}`);

        console.log('\nProcediendo con configuración de respaldo.');
    }

    // 2. Mostrar configuración
    console.log('\n2. CONFIGURACIÓN SMS');
    console.log(`URL del módem: ${smsServiceAdapter.config.modem.url}`);
    console.log(`Ruta de API: ${smsServiceAdapter.config.modem.apiPath}`);
    console.log(`Timeout: ${smsServiceAdapter.config.modem.timeout}ms`);
    console.log('Horario laboral:');
    console.log(`- Lunes a Viernes: ${smsServiceAdapter.config.workingHours.weekdays.start}-${smsServiceAdapter.config.workingHours.weekdays.end}h`);
    console.log(`- Sábado: ${smsServiceAdapter.config.workingHours.saturday.start}-${smsServiceAdapter.config.workingHours.saturday.end}h`);
    console.log('Destinatarios:');
    if (smsServiceAdapter.config.recipients.default.length > 0) {
        smsServiceAdapter.config.recipients.default.forEach((num, i) => {
            console.log(`- #${i + 1}: ${num}`);
        });
    } else {
        console.log('- No hay destinatarios configurados');
    }

    // 3. Comprobar conexión con el módem
    console.log('\n3. VERIFICANDO CONEXIÓN CON EL MÓDEM');
    try {
        const connected = await smsServiceAdapter.checkModemConnection();
        console.log(`Módem conectado: ${connected ? '✓' : '✗'}`);

        if (!connected) {
            console.log('⚠️ No se pudo establecer conexión con el módem.');
            console.log('Las pruebas de envío no se ejecutarán.');
            return false;
        }
    } catch (error) {
        console.error('Error al verificar conexión con el módem:', error.message);
        console.log('Las pruebas de envío no se ejecutarán.');
        return false;
    }

    // 4. Verificar horario laboral
    console.log('\n4. VERIFICANDO HORARIO LABORAL');
    const isWorkingHours = smsServiceAdapter.isWithinWorkingHours();
    console.log(`Dentro de horario laboral: ${isWorkingHours ? 'Sí' : 'No'}`);

    // 5. Preguntar si se quiere realizar una prueba de envío
    console.log('\n5. OPCIONES DE PRUEBA DE ENVÍO');
    console.log('1. No enviar SMS (solo prueba de configuración)');
    console.log('2. Enviar SMS de prueba (forzando fuera de horario laboral)');
    console.log('3. Agregar alerta de temperatura a la cola');
    console.log('4. Procesar cola de alertas de temperatura (forzando fuera de horario laboral)');

    // Usar argumentos de línea de comandos para determinar acción
    const option = process.argv[2] || '1';

    switch (option) {
        case '2':
            console.log('\n>> PRUEBA DE ENVÍO DE SMS');
            await testSendSms();
            break;
        case '3':
            console.log('\n>> PRUEBA DE AGREGAR ALERTA A LA COLA');
            await testAddAlertToQueue();
            break;
        case '4':
            console.log('\n>> PRUEBA DE PROCESAMIENTO DE COLA');
            await testProcessQueue();
            break;
        default:
            console.log('\n>> NO SE REALIZARÁ ENVÍO DE SMS');
            break;
    }

    // 6. Mostrar métricas del servicio
    console.log('\n6. MÉTRICAS DEL SERVICIO');
    const metrics = smsServiceAdapter.getMetrics();
    console.log(`- SMS enviados: ${metrics.sentAlerts}`);
    console.log(`- SMS fallidos: ${metrics.failedAlerts}`);
    console.log(`- Alertas en cola: ${metrics.queuedAlerts}`);
    console.log(`- Tasa de éxito: ${metrics.successRate}`);
    console.log(`- Última actividad: ${metrics.lastSuccessTime ? new Date(metrics.lastSuccessTime).toLocaleString() : 'Nunca'}`);

    console.log('\n>> PRUEBA DE ADAPTADOR SMS COMPLETADA');
    return true;
}

/**
 * Prueba el envío de un SMS
 */
async function testSendSms() {
    const testMessage = `Prueba de SMS desde adaptador unificado [${new Date().toLocaleTimeString()}]`;

    console.log(`Mensaje: "${testMessage}"`);
    console.log('Enviando SMS...');

    const result = await smsServiceAdapter.sendSMS(
        testMessage,
        null, // Usar destinatarios predeterminados
        true  // Forzar envío fuera de horario laboral
    );

    console.log(`Resultado: ${result.success ? '✓ SMS enviado' : '✗ Error al enviar SMS'}`);
    console.log(`- SMS enviados: ${result.sentCount}`);
    console.log(`- SMS fallidos: ${result.failedCount}`);

    if (result.reason) {
        console.log(`- Razón: ${result.reason}`);
    }

    return result.success;
}

/**
 * Prueba agregar alertas a la cola
 */
async function testAddAlertToQueue() {
    // Agregar algunas alertas de prueba
    console.log('Agregando alertas de temperatura a la cola...');

    const alerts = [
        {
            name: 'Cámara 1',
            temperature: -22.5,
            timestamp: new Date().toISOString(),
            minThreshold: -20.0,
            maxThreshold: -16.0
        },
        {
            name: 'Reefer A',
            temperature: -14.5,
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            minThreshold: -18.0,
            maxThreshold: -15.0
        },
        {
            name: 'Cámara 3',
            temperature: -9.8,
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            minThreshold: -18.0,
            maxThreshold: -10.0
        }
    ];

    let addedCount = 0;
    for (const alert of alerts) {
        const added = smsServiceAdapter.addTemperatureAlertToQueue(
            alert.name,
            alert.temperature,
            alert.timestamp,
            alert.minThreshold,
            alert.maxThreshold
        );

        if (added) addedCount++;
    }

    console.log(`Alertas agregadas a la cola: ${addedCount}/${alerts.length}`);
    console.log(`Total en cola: ${smsServiceAdapter.messageQueue.temperatureAlerts.length}`);

    return addedCount === alerts.length;
}

/**
 * Prueba procesar la cola de alertas
 */
async function testProcessQueue() {
    // Verificar si hay alertas en la cola
    if (smsServiceAdapter.messageQueue.temperatureAlerts.length === 0) {
        console.log('No hay alertas en la cola para procesar.');
        console.log('Agregando algunas alertas de prueba...');
        await testAddAlertToQueue();
    }

    // Procesar la cola
    console.log(`Procesando cola con ${smsServiceAdapter.messageQueue.temperatureAlerts.length} alertas...`);
    const result = await smsServiceAdapter.processTemperatureAlertQueue(true); // Forzar procesamiento

    console.log(`Resultado: ${result.success ? '✓ Cola procesada' : '✗ Error al procesar cola'}`);
    console.log(`- Alertas procesadas: ${result.processed}`);

    if (result.reason) {
        console.log(`- Razón: ${result.reason}`);
    }

    if (result.error) {
        console.log(`- Error: ${JSON.stringify(result.error)}`);
    }

    return result.success;
}

// Ejecutar la prueba
testSmsAdapter().catch(error => {
    console.error('Error en la prueba del adaptador SMS:', error);
});
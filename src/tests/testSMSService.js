// src/test/testSMSService.js

const smsService = require('../services/smsService');
const config = require('../config/js_files/config-loader');

/**
 * Script para probar el servicio de SMS
 * 
 * Este script permite probar diferentes funcionalidades del servicio SMS:
 * - Verificar conexión con el módem
 * - Probar envío de mensajes individuales
 * - Probar el procesamiento de cola de mensajes
 * - Ver métricas y estado del servicio
 */

// Función para esperar un tiempo específico (en ms)
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función principal de pruebas
async function runTests() {
    console.log('=== Test de Servicio SMS ===');
    console.log('Hora actual:', new Date().toLocaleString());

    // Verificar que la configuración esté cargada
    const appConfig = config.getConfig();
    console.log('\n1. Verificando configuración cargada:');
    console.log('- Configuración SMS disponible:', !!appConfig.sms);
    if (appConfig.sms) {
        console.log('- URL del módem:', appConfig.sms.modem.url);
        console.log('- Horario laboral (L-V):',
            `${appConfig.sms.workingHours.weekdays.start} - ${appConfig.sms.workingHours.weekdays.end}`);
    }

    // Inicializar el servicio
    console.log('\n2. Inicializando servicio SMS...');
    const initialized = smsService.initialize();
    console.log('- Servicio inicializado:', initialized);

    // Probar conexión con el módem
    console.log('\n3. Verificando conexión con el módem...');
    try {
        const connected = await smsService.checkModemConnection();
        console.log('- Módem conectado:', connected);
    } catch (error) {
        console.error('- Error al conectar con el módem:', error.message);
    }

    // Verificar horario laboral actual
    console.log('\n4. Verificando horario laboral:');
    const isWorkingHours = smsService.isWithinWorkingHours();
    console.log('- Dentro de horario laboral:', isWorkingHours);

    // Agregar mensajes a la cola (opcional - depende del comando)
    const args = process.argv.slice(2);
    if (args.includes('--queue')) {
        console.log('\n5. Agregando mensajes de prueba a la cola...');

        // Agregar algunos mensajes de prueba a la cola
        smsService.addTemperatureAlertToQueue(
            'Cámara de Frío 1',
            -25.5,
            new Date().toISOString(),
            -20,
            -30
        );

        smsService.addTemperatureAlertToQueue(
            'Cámara de Frío 2',
            -15.3,
            new Date().toISOString(),
            -18,
            -22
        );

        console.log('- Mensajes agregados a la cola');
        console.log('- Total en cola:', smsService.messageQueue.temperatureAlerts.length);
    }

    // Procesar cola (opcional - depende del comando)
    if (args.includes('--process')) {
        console.log('\n6. Procesando cola de mensajes...');

        // Procesar la cola (forzando si es necesario)
        const forceProcess = args.includes('--force');
        const result = await smsService.processTemperatureAlertQueue(forceProcess);

        console.log('- Resultado del procesamiento:', result);
    }

    // Enviar mensaje de prueba (opcional - depende del comando)
    if (args.includes('--send')) {
        console.log('\n7. Enviando mensaje de prueba...');

        // Obtener destinatario y mensaje
        let recipient = null;
        let testMessage = "Mensaje de prueba del sistema SMS";

        // Buscar argumentos para destinatario y mensaje
        const recipientIndex = args.indexOf('--recipient');
        if (recipientIndex !== -1 && args.length > recipientIndex + 1) {
            recipient = args[recipientIndex + 1];
        }

        const messageIndex = args.indexOf('--message');
        if (messageIndex !== -1 && args.length > messageIndex + 1) {
            testMessage = args[messageIndex + 1];
        }

        // Forzar envío si es necesario
        const forceSend = args.includes('--force');

        // Crear array de destinatarios si se especificó uno
        const recipients = recipient ? [recipient] : null;

        // Enviar mensaje
        const result = await smsService.sendSMS(testMessage, recipients, forceSend);
        console.log('- Resultado del envío:', result);
    }

    // Mostrar métricas y estado del servicio
    console.log('\n8. Métricas y estado del servicio:');
    const metrics = smsService.getMetrics();
    console.log(JSON.stringify(metrics, null, 2));

    console.log('\n=== Test completado ===');
}

// Ejecutar pruebas
runTests()
    .then(() => {
        console.log('Script de prueba finalizado.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error durante la ejecución de pruebas:', error);
        process.exit(1);
    });
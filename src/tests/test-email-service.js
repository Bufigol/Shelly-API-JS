// test-email-service.js
const emailServiceAdapter = require('../services/email/email-service-adapter');
const configLoader = require('../config/js_files/config-loader');

// Función para mostrar información de la configuración de correo
function printEmailConfig() {
    const config = configLoader.getConfig().email;

    console.log('\n======= CONFIGURACIÓN DE CORREO ELECTRÓNICO =======');
    console.log(`API Key: ${config.sendgrid_api_key ? config.sendgrid_api_key.substring(0, 15) + '...' : 'No configurado'}`);
    console.log(`Remitente: ${config.email_contacto.from_verificado}`);
    console.log('Destinatarios predeterminados:');
    if (config.email_contacto.destinatarios && config.email_contacto.destinatarios.length > 0) {
        config.email_contacto.destinatarios.forEach((email, index) => {
            console.log(`  ${index + 1}. ${email}`);
        });
    } else {
        console.log('  No hay destinatarios configurados');
    }
    console.log('====================================================\n');
}

// Prueba de correo genérico
async function testGenericEmail() {
    console.log('\n======= PRUEBA DE CORREO GENÉRICO =======');

    // Creamos un correo de prueba con texto plano
    const subject = 'Prueba de Correo - Texto Plano';
    const content = `Este es un correo de prueba enviado desde el script de prueba de correo electrónico.
  
Fecha y hora: ${new Date().toLocaleString()}
  
Saludos,
El equipo de pruebas`;

    console.log('Enviando correo de texto plano...');
    const result = await emailServiceAdapter.sendGenericEmail(
        subject,
        content,
        null, // Usar destinatarios predeterminados
        false, // No es HTML
        { categories: ['test', 'plain-text'] }
    );

    console.log(`Resultado: ${result ? '✅ Correo enviado' : '❌ Error al enviar correo'}`);

    // Creamos un correo de prueba con HTML
    const htmlSubject = 'Prueba de Correo - HTML';
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
      <h2 style="color: #333;">Prueba de Correo HTML</h2>
      <p>Este es un correo de prueba con formato HTML enviado desde el script de prueba.</p>
      <ul>
        <li>Característica 1: Soporte para HTML</li>
        <li>Característica 2: Estilos en línea</li>
        <li>Característica 3: Listas y formato</li>
      </ul>
      <p style="margin-top: 20px;">Fecha y hora: <strong>${new Date().toLocaleString()}</strong></p>
      <hr style="margin: 20px 0; border: 0; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #777;">Este es un mensaje automático generado por el sistema de pruebas.</p>
    </div>
  `;

    console.log('\nEnviando correo HTML...');
    const htmlResult = await emailServiceAdapter.sendGenericEmail(
        htmlSubject,
        htmlContent,
        null, // Usar destinatarios predeterminados
        true, // Es HTML
        { categories: ['test', 'html'], highPriority: true }
    );

    console.log(`Resultado: ${htmlResult ? '✅ Correo HTML enviado' : '❌ Error al enviar correo HTML'}`);
}

// Prueba de correo de restablecimiento de contraseña
async function testPasswordResetEmail() {
    console.log('\n======= PRUEBA DE CORREO DE RESTABLECIMIENTO DE CONTRASEÑA =======');

    // Datos de prueba
    const userEmail = emailServiceAdapter.config.defaultRecipients[0];
    const resetToken = 'test-reset-token-123456';
    const resetUrl = `https://example.com/reset-password?token=${resetToken}`;

    console.log(`Enviando correo de restablecimiento a: ${userEmail}`);
    const result = await emailServiceAdapter.sendPasswordResetEmail(userEmail, resetToken, resetUrl);

    console.log(`Resultado: ${result ? '✅ Correo enviado' : '❌ Error al enviar correo'}`);

    // Prueba de confirmación
    console.log('\nEnviando correo de confirmación de restablecimiento...');
    const confirmResult = await emailServiceAdapter.sendPasswordResetConfirmationEmail(userEmail);

    console.log(`Resultado: ${confirmResult ? '✅ Correo enviado' : '❌ Error al enviar correo'}`);
}

// Prueba de alertas de temperatura
async function testTemperatureAlert() {
    console.log('\n======= PRUEBA DE ALERTAS DE TEMPERATURA =======');

    // Datos de prueba
    const outOfRangeChannels = [
        {
            name: 'Cámara 1',
            temperature: -22.5,
            timestamp: new Date(),
            minThreshold: -20.0,
            maxThreshold: -16.0
        },
        {
            name: 'Reefer A',
            temperature: -14.5,
            timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutos antes
            minThreshold: -18.0,
            maxThreshold: -15.0
        },
        {
            name: 'Cámara 3',
            temperature: -9.8,
            timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutos antes
            minThreshold: -18.0,
            maxThreshold: -10.0
        }
    ];

    console.log(`Enviando alerta de temperatura para ${outOfRangeChannels.length} canales...`);
    const result = await emailServiceAdapter.sendTemperatureAlert(outOfRangeChannels);

    console.log(`Resultado: ${result ? '✅ Alerta enviada' : '❌ Error al enviar alerta'}`);
}

// Prueba de alertas de desconexión
async function testDisconnectionAlert() {
    console.log('\n======= PRUEBA DE ALERTAS DE DESCONEXIÓN =======');

    // Datos de prueba
    const now = new Date();
    const disconnectedChannels = [
        {
            name: 'Cámara 2',
            lastConnectionTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 horas antes
            disconnectionInterval: 60
        },
        {
            name: 'Reefer B',
            lastConnectionTime: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 horas antes
            disconnectionInterval: 90
        },
        {
            name: 'Cámara 4',
            lastConnectionTime: new Date(now.getTime() - 8 * 60 * 60 * 1000), // 8 horas antes
            disconnectionInterval: 120
        }
    ];

    console.log(`Enviando alerta de desconexión para ${disconnectedChannels.length} canales...`);
    const result = await emailServiceAdapter.sendDisconnectionAlert(disconnectedChannels);

    console.log(`Resultado: ${result ? '✅ Alerta enviada' : '❌ Error al enviar alerta'}`);
}

// Prueba de cambio de entorno
async function testEnvironmentSwitch() {
    console.log('\n======= PRUEBA DE CAMBIO DE ENTORNO =======');

    // Guardar configuración original
    const originalEnv = configLoader.getCurrentEnvironment().index;
    const originalApiKey = emailServiceAdapter.config.apiKey;

    try {
        // Cambiar de entorno
        const newEnvIndex = originalEnv === 0 ? 1 : 0;
        console.log(`Cambiando de entorno ${originalEnv} a ${newEnvIndex}...`);
        await configLoader.changeEnvironment(newEnvIndex);

        // Recargar configuración
        emailServiceAdapter.reloadConfig();

        // Verificar cambio
        console.log('Verificando nueva configuración:');
        console.log(`- API Key original: ${originalApiKey.substring(0, 10)}...`);
        console.log(`- Nueva API Key: ${emailServiceAdapter.config.apiKey.substring(0, 10)}...`);

        // Enviar correo de prueba con la nueva configuración
        console.log('\nEnviando correo de prueba con la nueva configuración...');
        const testResult = await emailServiceAdapter.sendGenericEmail(
            'Prueba de Cambio de Entorno',
            `Este correo fue enviado después de cambiar al entorno ${newEnvIndex}.\nFecha y hora: ${new Date().toLocaleString()}`,
            null,
            false
        );

        console.log(`Resultado: ${testResult ? '✅ Correo enviado' : '❌ Error al enviar correo'}`);

        // Restaurar entorno original
        console.log(`\nRestaurando entorno original (${originalEnv})...`);
        await configLoader.changeEnvironment(originalEnv);
        emailServiceAdapter.reloadConfig();

        console.log(`Entorno restaurado a ${originalEnv}`);
    } catch (error) {
        console.error(`\n❌ Error en prueba de cambio de entorno: ${error.message}`);

        // Asegurar que se restaure el entorno original
        console.log(`\nIntentando restaurar entorno original (${originalEnv})...`);
        await configLoader.changeEnvironment(originalEnv);
        emailServiceAdapter.reloadConfig();
    }
}

// Función principal
async function runTests() {
    console.log('>> INICIANDO PRUEBAS DE SERVICIO DE CORREO');

    // Mostrar configuración actual
    printEmailConfig();

    // Pregunta al usuario qué pruebas ejecutar
    console.log('\nSeleccione qué pruebas ejecutar:');
    console.log('1. Todas las pruebas (puede enviar varios correos)');
    console.log('2. Solo prueba de configuración (no envía correos)');
    console.log('3. Solo prueba de correo genérico');
    console.log('4. Solo prueba de restablecimiento de contraseña');
    console.log('5. Solo prueba de alertas de temperatura');
    console.log('6. Solo prueba de alertas de desconexión');
    console.log('7. Solo prueba de cambio de entorno');

    // Opción por defecto para pruebas automatizadas
    const option = process.argv[2] || '2';

    switch (option) {
        case '1':
            console.log('\nEjecutando todas las pruebas...');
            await testGenericEmail();
            await testPasswordResetEmail();
            await testTemperatureAlert();
            await testDisconnectionAlert();
            await testEnvironmentSwitch();
            break;
        case '2':
            console.log('\nEjecutando solo prueba de configuración...');
            // Ya se mostró la configuración al inicio
            break;
        case '3':
            console.log('\nEjecutando prueba de correo genérico...');
            await testGenericEmail();
            break;
        case '4':
            console.log('\nEjecutando prueba de restablecimiento de contraseña...');
            await testPasswordResetEmail();
            break;
        case '5':
            console.log('\nEjecutando prueba de alertas de temperatura...');
            await testTemperatureAlert();
            break;
        case '6':
            console.log('\nEjecutando prueba de alertas de desconexión...');
            await testDisconnectionAlert();
            break;
        case '7':
            console.log('\nEjecutando prueba de cambio de entorno...');
            await testEnvironmentSwitch();
            break;
        default:
            console.log('\nOpción no válida. Ejecutando solo prueba de configuración...');
            break;
    }

    console.log('\n>> PRUEBAS DE SERVICIO DE CORREO COMPLETADAS');
}

// Ejecutar pruebas
runTests().catch(error => {
    console.error('Error durante las pruebas:', error);
});
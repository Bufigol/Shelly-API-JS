// test-email-environment.js
const emailServiceAdapter = require('../services/email/email-service-adapter');
const configLoader = require('../config/js_files/config-loader');

/**
 * Script para probar específicamente la configuración de correo electrónico
 * y verificar que todo está configurado correctamente
 */
async function testEmailConfiguration() {
    console.log('>> INICIANDO PRUEBA DE CONFIGURACIÓN DE CORREO ELECTRÓNICO');

    // Verificar configuración actual
    const config = configLoader.getConfig().email;

    console.log('\n======= CONFIGURACIÓN DE CORREO ELECTRÓNICO =======');
    console.log(`API Key: ${config.sendgrid_api_key ? (config.sendgrid_api_key.startsWith('SG.') ? config.sendgrid_api_key.substring(0, 10) + '...' : 'Formato incorrecto') : 'No configurada'}`);
    console.log(`Formato de API Key correcto: ${config.sendgrid_api_key?.startsWith('SG.') ? '✅ Sí' : '❌ No'}`);
    console.log(`Remitente: ${config.email_contacto.from_verificado || 'No configurado'}`);
    console.log('Destinatarios predeterminados:');
    if (config.email_contacto.destinatarios && config.email_contacto.destinatarios.length > 0) {
        config.email_contacto.destinatarios.forEach((email, index) => {
            console.log(`  ${index + 1}. ${email}`);
        });
    } else {
        console.log('  ❌ No hay destinatarios configurados');
    }

    // Verificar estado del adaptador
    console.log('\n======= ESTADO DEL ADAPTADOR DE CORREO =======');
    console.log(`Adaptador inicializado: ${emailServiceAdapter.initialized ? '✅ Sí' : '❌ No'}`);
    console.log(`Configuración válida: ${emailServiceAdapter.isConfigured() ? '✅ Sí' : '❌ No'}`);

    if (!emailServiceAdapter.initialized || !emailServiceAdapter.isConfigured()) {
        console.log('\n❌ El adaptador de correo no está correctamente inicializado o configurado.');
        console.log('Por favor, verifique la API key de SendGrid en el archivo de configuración unificado.');
        console.log('La API key debe comenzar con "SG."');

        // Sugerir solución
        console.log('\nPara actualizar la API key, ejecute:');
        console.log('node update-unified-config.js');

        return false;
    }

    console.log('\n✅ El adaptador de correo está correctamente configurado');
    return true;
}

// Ejecutar la prueba
testEmailConfiguration().then(success => {
    if (success) {
        console.log('\nAhora puede ejecutar las pruebas de envío de correo con:');
        console.log('node src/tests/test-email-service.js 1');
    }
});
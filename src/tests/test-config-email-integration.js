// test-config-email-integration.js
const configLoader = require('../config/js_files/config-loader');
const emailServiceAdapter = require('../services/email/email-service-adapter');

/**
 * Script para probar la integración entre ConfigLoader y EmailServiceAdapter
 * Este script demuestra cómo actualizar y usar la configuración unificada
 */
async function testConfigEmailIntegration() {
    console.log('>> INICIANDO PRUEBA DE INTEGRACIÓN CONFIG-EMAIL');

    // 1. Verificar la configuración actual
    console.log('\n1. ESTADO ACTUAL DE LA CONFIGURACIÓN');
    const currentConfig = configLoader.getConfig();
    console.log(`Entorno: ${currentConfig.environment.name}`);

    // Verificar configuración de email
    console.log('\nConfiguración de email:');
    const emailConfig = currentConfig.email;
    console.log(`- API Key presente: ${emailConfig && emailConfig.SENDGRID_API_KEY ? '✓' : '✗'}`);
    console.log(`- Formato correcto: ${emailConfig && emailConfig.SENDGRID_API_KEY && emailConfig.SENDGRID_API_KEY.startsWith('SG.') ? '✓' : '✗'}`);

    if (!emailConfig || !emailConfig.SENDGRID_API_KEY || !emailConfig.SENDGRID_API_KEY.startsWith('SG.')) {
        console.log('\n2. ACTUALIZANDO CONFIGURACIÓN DE EMAIL');

        const updated = configLoader.updateConfigValue('email.sendgrid_api_key', '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');

        if (updated) {
            console.log('✓ API Key actualizada correctamente');
        } else {
            console.log('✗ Error al actualizar API Key');
        }

        // Verificar configuración actualizada
        const updatedConfig = configLoader.getConfig();
        console.log('\nConfiguración de email actualizada:');
        const updatedEmailConfig = updatedConfig.email;
        console.log(`- API Key presente: ${updatedEmailConfig && updatedEmailConfig.SENDGRID_API_KEY ? '✓' : '✗'}`);
        console.log(`- Formato correcto: ${updatedEmailConfig && updatedEmailConfig.SENDGRID_API_KEY && updatedEmailConfig.SENDGRID_API_KEY.startsWith('SG.') ? '✓' : '✗'}`);
    }

    // 3. Reinicializar EmailServiceAdapter con la nueva configuración
    console.log('\n3. REINICIALIZANDO ADAPTADOR DE EMAIL');
    emailServiceAdapter.reloadConfig();

    console.log('\nEstado del adaptador:');
    console.log(`- Inicializado: ${emailServiceAdapter.initialized ? '✓' : '✗'}`);
    console.log(`- Configuración válida: ${emailServiceAdapter.isConfigured() ? '✓' : '✗'}`);

    // 4. Probar el envío de un correo
    if (emailServiceAdapter.isConfigured()) {
        console.log('\n4. ENVIANDO CORREO DE PRUEBA');

        const result = await emailServiceAdapter.sendGenericEmail(
            'Prueba de Integración Config-Email',
            `Este es un correo de prueba para verificar la integración entre ConfigLoader y EmailServiceAdapter.
      
Fecha y hora: ${new Date().toLocaleString()}

Esta prueba demuestra el uso del archivo de configuración unificado.`,
            null, // Usar destinatarios predeterminados
            false, // No es HTML
            { categories: ['test', 'integration'] }
        );

        console.log(`Resultado: ${result ? '✓ Correo enviado correctamente' : '✗ Error al enviar correo'}`);

        if (result) {
            console.log('\n✓ La prueba de integración Config-Email fue exitosa');
            console.log('La configuración unificada funciona correctamente con el adaptador de correo');
        } else {
            console.log('\n✗ La prueba de integración Config-Email falló');
            console.log('Revise los mensajes de error para más información');
        }
    } else {
        console.log('\n✗ No se puede probar el envío de correo porque el adaptador no está configurado correctamente');
    }
}

// Ejecutar la prueba
testConfigEmailIntegration().catch(error => {
    console.error('Error en la prueba de integración:', error);
});
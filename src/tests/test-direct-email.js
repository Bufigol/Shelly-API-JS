// test-direct-email.js
const directEmailAdapter = require('../services/email/direct-email-adapter');

/**
 * Script para probar el adaptador directo de correo electrónico
 * Este script envía un correo de prueba sin depender de la configuración
 */
async function testDirectEmail() {
    console.log('>> INICIANDO PRUEBA DE ADAPTADOR DIRECTO DE CORREO');

    // Verificar estado del adaptador
    console.log('\n======= ESTADO DEL ADAPTADOR =======');
    console.log(`Adaptador inicializado: ${directEmailAdapter.initialized ? '✅ Sí' : '❌ No'}`);
    console.log(`Configuración válida: ${directEmailAdapter.isConfigured() ? '✅ Sí' : '❌ No'}`);

    // Mostrar configuración
    console.log('\n======= CONFIGURACIÓN =======');
    console.log(`API Key: ${directEmailAdapter.config.apiKey.substring(0, 10)}...`);
    console.log(`Remitente: ${directEmailAdapter.config.fromEmail}`);
    console.log('Destinatarios predeterminados:');
    directEmailAdapter.config.defaultRecipients.forEach((email, index) => {
        console.log(`  ${index + 1}. ${email}`);
    });

    if (!directEmailAdapter.isConfigured()) {
        console.log('\n❌ El adaptador no está correctamente configurado.');
        return false;
    }

    // Enviar correo de prueba
    console.log('\n======= ENVIANDO CORREO DE PRUEBA =======');
    const result = await directEmailAdapter.sendGenericEmail(
        'Prueba de Adaptador Directo',
        `Este es un correo de prueba enviado desde el adaptador directo.
    
Fecha y hora: ${new Date().toLocaleString()}
    
Este correo utiliza directamente la API key configurada en el código para evitar problemas con la carga de configuración.`,
        null, // Usar destinatarios predeterminados
        false, // No es HTML
        { categories: ['test', 'direct-adapter'] }
    );

    console.log(`Resultado: ${result ? '✅ Correo enviado correctamente' : '❌ Error al enviar correo'}`);
    return result;
}

// Ejecutar la prueba
testDirectEmail().then(success => {
    if (success) {
        console.log('\n✅ La prueba del adaptador directo fue exitosa');
        console.log('Este enfoque evita los problemas con la carga de configuración');
    } else {
        console.log('\n❌ La prueba del adaptador directo falló');
        console.log('Revise los mensajes de error para más información');
    }
});
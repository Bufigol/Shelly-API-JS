// simple-email-test.js
const sgMail = require('@sendgrid/mail');

// Configurar API key directamente
const SENDGRID_API_KEY = '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';
sgMail.setApiKey(SENDGRID_API_KEY);

// Mensaje de prueba muy sencillo
const msg = {
    to: 'felipev7450@gmail.com',
    from: 'f.vasquez.tort@proton.me',
    subject: 'Prueba básica de SendGrid',
    text: 'Este es un texto de prueba simple.',
    html: '<p>Este es un <strong>correo de prueba</strong> simple.</p>'
};

// Función principal
async function sendTestEmail() {
    console.log('>> PRUEBA BÁSICA DE SENDGRID');
    console.log('Configuración:');
    console.log(`- API Key: ${SENDGRID_API_KEY.substring(0, 10)}...`);
    console.log(`- Para: ${msg.to}`);
    console.log(`- De: ${msg.from}`);
    console.log(`- Asunto: ${msg.subject}`);

    try {
        console.log('\nEnviando correo...');
        const response = await sgMail.send(msg);
        console.log(`✅ Correo enviado correctamente (${response[0].statusCode})`);
        return true;
    } catch (error) {
        console.error('❌ Error al enviar correo:', error.message);
        if (error.response) {
            console.error('Detalles de la respuesta:', error.response.body);
        }
        return false;
    }
}

// Ejecutar la prueba
sendTestEmail()
    .then(success => {
        if (success) {
            console.log('\n✅ La prueba básica fue exitosa');
        }
    })
    .catch(error => {
        console.error('\n❌ Error en la prueba:', error);
    });
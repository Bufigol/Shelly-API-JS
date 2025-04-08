// test-sendgrid.js - Script para probar la configuración de SendGrid
const sgMail = require("@sendgrid/mail");
const fs = require("fs");
const path = require("path");
const configLoader = require("../config/js_files/config-loader");

console.log("======================================================");
console.log("PRUEBA DE CONFIGURACIÓN DE SENDGRID");
console.log("======================================================");

try {
  // 1. Verificar si el archivo existe físicamente
  const configPath = path.join(
    __dirname,
    "config",
    "jsons",
    "sgMailConfig.json"
  );
  console.log("Buscando archivo de configuración en:", configPath);

  if (fs.existsSync(configPath)) {
    console.log("✅ El archivo sgMailConfig.json EXISTE");

    // Intentar leer el archivo directamente
    try {
      const fileContent = fs.readFileSync(configPath, "utf8");
      const directConfig = JSON.parse(fileContent);
      console.log("✅ El archivo se puede leer y parsear correctamente");
      console.log("📝 Configuración encontrada:", {
        tieneApiKey: !!directConfig.SENDGRID_API_KEY,
        longitudApiKey: directConfig.SENDGRID_API_KEY
          ? directConfig.SENDGRID_API_KEY.length
          : 0,
        fromEmail: directConfig.email_contacto?.from_verificado,
      });
    } catch (parseError) {
      console.error(
        "❌ Error al leer o parsear el archivo:",
        parseError.message
      );
    }
  } else {
    console.error(
      "❌ El archivo sgMailConfig.json NO EXISTE en la ruta esperada"
    );
  }

  // 2. Verificar si configLoader carga la configuración
  console.log("\n-- Probando carga desde configLoader --");
  const emailConfig = configLoader.getValue("email");

  if (emailConfig) {
    console.log('✅ configLoader pudo cargar la sección "email"');
    console.log("📝 Configuración cargada:", {
      tieneApiKey: !!emailConfig.SENDGRID_API_KEY,
      longitudApiKey: emailConfig.SENDGRID_API_KEY
        ? emailConfig.SENDGRID_API_KEY.length
        : 0,
      fromEmail: emailConfig.email_contacto?.from_verificado,
    });

    // 3. Intentar enviar un email de prueba
    if (
      emailConfig.SENDGRID_API_KEY &&
      emailConfig.email_contacto?.from_verificado
    ) {
      console.log("\n-- Intentando enviar email de prueba --");

      sgMail.setApiKey(emailConfig.SENDGRID_API_KEY);

      // Usar la primera dirección de destinatarios o caer en la dirección verificada
      const toEmail =
        emailConfig.email_contacto?.destinatarios?.[1] ||
        emailConfig.email_contacto.from_verificado;

      console.log(`📧 Enviando email de prueba a: ${toEmail}`);
      sgMail
        .send({
          to: toEmail,
          from: emailConfig.email_contacto.from_verificado,
          subject: "Prueba de configuración de SendGrid",
          text: "Si recibes este email, la configuración de SendGrid está funcionando correctamente.",
          html: "<p>Si recibes este email, la configuración de SendGrid está funcionando correctamente.</p>",
        })
        .then(() => {
          console.log("✅ Email enviado correctamente!");
          console.log("La configuración de SendGrid está funcionando.");
        })
        .catch((error) => {
          console.error("❌ Error al enviar email:", error.message);
          if (error.response) {
            console.error("Detalles del error:", error.response.body);
          }
        });
    } else {
      console.error(
        "❌ Configuración incompleta, no se puede enviar email de prueba"
      );
    }
  } else {
    console.error('❌ configLoader NO pudo cargar la sección "email"');
  }
} catch (error) {
  console.error("❌ Error general en la prueba:", error);
}

// src/services/email/emailService.js

const sgMail = require("@sendgrid/mail");
const BaseAlertService = require("../baseAlertService"); // Hereda de BaseAlertService
const config = require("../../config/js_files/config-loader");
const moment = require("moment-timezone");
const notificationController = require("../../controllers/notificationController"); // Para isWithinWorkingHours

/**
 * Servicio centralizado para el envío de correos electrónicos utilizando SendGrid.
 * Hereda funcionalidades base de BaseAlertService.
 */
class EmailService extends BaseAlertService {
  constructor() {
    super(); // Llama al constructor de BaseAlertService
    this.sgMail = sgMail; // Usar la instancia importada
    this.config = null;
    this.fromEmail = null;
    this.defaultRecipients = [];
    this.timeZone = "America/Santiago"; // Default, se actualizará en initialize
    this.appName = "Sistema de Monitoreo";
    this.companyName = "The Next Security";
    // La inicialización se llamará desde BaseAlertService o explícitamente si es necesario
    // pero la configuración de sgMail se hará en initialize()
  }

  /**
   * Inicializa el servicio de Email.
   * Carga la configuración y configura la API Key de SendGrid.
   * Sobrescribe el método de BaseAlertService si es necesario o complementa.
   */
  async initialize() {
    if (this.initialized) return;

    console.log("Inicializando EmailService...");
    try {
      // 1. Cargar Configuración específica de Email
      const appConfig = config.getConfig(); // Obtener configuración general

      if (!appConfig.email || !appConfig.email.SENDGRID_API_KEY) {
        throw new Error("Configuración de email o SENDGRID_API_KEY no encontrada.");
      }

      // Validar formato de API Key
      if (!appConfig.email.SENDGRID_API_KEY.startsWith("SG.")) {
        console.warn("⚠️ La API Key de SendGrid no parece tener el formato correcto (debe empezar con 'SG.').");
        // Continuar de todos modos, pero advertir.
      }

      this.config = appConfig.email; // Guardar solo la sección de email
      this.appName = appConfig.appInfo?.appName || this.appName;
      this.companyName = appConfig.appInfo?.companyName || this.companyName;
      this.timeZone = appConfig.alertSystem?.timeZone || this.timeZone;
      this.fromEmail = this.config.email_contacto?.from_verificado;
      this.defaultRecipients = this.config.email_contacto?.destinatarios || [];

      if (!this.fromEmail) {
        console.warn("⚠️ Email remitente (from_verificado) no configurado en email.email_contacto.");
        // Considerar lanzar un error si es crítico: throw new Error("Email remitente no configurado");
      }

      // 2. Configurar SendGrid API Key
      this.sgMail.setApiKey(this.config.SENDGRID_API_KEY);
      console.log("EmailService: SendGrid API Key configurada.");

      // 3. Inicializar Timers (llamando al método de BaseAlertService)
      super.initializeTimers(); // Asegura que los timers de la clase base se inicien

      this.initialized = true;
      console.log("✅ EmailService inicializado correctamente.");

    } catch (error) {
      console.error("❌ Error inicializando EmailService:", error.message);
      this.initialized = false; // Marcar como no inicializado en caso de error
      // Podrías querer re-lanzar el error si la inicialización es crítica para el arranque
      // throw error;
    }
  }

  /**
   * Verifica si el servicio de email está correctamente configurado.
   * @returns {boolean} True si está listo para enviar correos.
   */
  isConfigured() {
    const configured = this.initialized &&
      this.config &&
      this.config.SENDGRID_API_KEY &&
      this.config.SENDGRID_API_KEY.startsWith("SG.") && // Verificar formato básico
      this.fromEmail; // Asegurar que el remitente está definido

    if (!configured && this.initialized) {
      // Loguear detalles si está inicializado pero no configurado
      console.warn("EmailService está inicializado pero no completamente configurado.");
      if (!this.config?.SENDGRID_API_KEY?.startsWith("SG.")) console.warn("- API Key inválida o faltante.");
      if (!this.fromEmail) console.warn("- Email remitente (from_verificado) faltante.");
    }
    return configured;
  }

  /**
   * Método privado para enviar correos usando la instancia configurada de sgMail.
   * Incluye manejo básico de errores.
   * @param {Object} message - Objeto de mensaje compatible con SendGrid (to, subject, text, html, [from])
   * @returns {Promise<boolean>} True si el envío fue exitoso.
   * @private
   */
  async _sendMail(message) {
    if (!this.isConfigured()) {
      console.error("EmailService no está configurado para enviar correos.");
      this.metrics.failedAlerts++;
      this.metrics.lastError = "Servicio no configurado";
      return false;
    }

    // Asegurar remitente por defecto si no se proporciona
    if (!message.from) {
      message.from = this.fromEmail;
    }

    // Asegurar que 'to' es un array o string válido
    if (!message.to || (Array.isArray(message.to) && message.to.length === 0)) {
      console.error("Error: No se especificaron destinatarios para el correo.");
      this.metrics.failedAlerts++;
      this.metrics.lastError = "Sin destinatarios";
      return false;
    }

    // Asegurar contenido mínimo
    if (!message.text && !message.html) {
      console.warn("Advertencia: El correo no tiene contenido 'text' ni 'html'. Se enviará vacío.");
      message.text = ' '; // Contenido mínimo requerido por SendGrid
    } else if (!message.text) {
      message.text = this._stripHtml(message.html || ' '); // Generar texto plano si falta
    }


    try {
      await this.sgMail.send(message);
      const recipients = Array.isArray(message.to) ? message.to.join(', ') : message.to;
      console.log(`Correo "${message.subject}" enviado exitosamente a: ${recipients}`);
      // No incrementar sentAlerts aquí, se hace en processAlert o métodos públicos
      return true;
    } catch (error) {
      console.error(`Error al enviar correo "${message.subject}" vía SendGrid:`, error.message);
      // Log detallado si la respuesta de SendGrid está disponible
      if (error.response && error.response.body && error.response.body.errors) {
        console.error("SendGrid Response Errors:", JSON.stringify(error.response.body.errors));
      } else if (error.response) {
        console.error("SendGrid Response Status:", error.response.statusCode);
        console.error("SendGrid Response Body:", error.response.body);
      }
      // Registrar error para métricas
      this.metrics.failedAlerts++; // Incrementar aquí podría ser redundante si processAlert ya lo hace
      this.metrics.lastError = `SendGrid Error: ${error.message}`;
      return false; // Indicar fallo
    }
  }

  /**
   * Procesa una alerta de la cola (método sobrescrito/implementado de BaseAlertService).
   * Formatea el contenido y utiliza _sendMail para el envío.
   * @param {Object} alert - Objeto de alerta con { type, data, recipients? }
   */
  async processAlert(alert) {
    // Verificar inicialización primero
    if (!this.initialized) {
      console.error("EmailService no inicializado. No se puede procesar alerta.");
      this.metrics.failedAlerts++;
      this.metrics.lastError = "Servicio no inicializado";
      // Considerar lanzar un error si el procesamiento debe detenerse
      // throw new Error("EmailService no inicializado");
      return; // Salir si no está listo
    }

    console.log(`Procesando alerta de email tipo: ${alert.type}`);

    try {
      const { type, data, recipients } = alert;
      const emailRecipients = recipients || this.defaultRecipients;

      if (!emailRecipients || emailRecipients.length === 0) {
        console.error(`No hay destinatarios para alerta tipo ${type}.`);
        this.metrics.failedAlerts++;
        this.metrics.lastError = `Sin destinatarios para ${type}`;
        return; // No se puede enviar
      }

      // Generar contenido específico del tipo de alerta
      const { subject, htmlContent, plainText } = this.generateEmailContent(type, data);

      const msg = {
        to: emailRecipients,
        subject: subject,
        text: plainText,
        html: htmlContent
        // 'from' será añadido por _sendMail si no está aquí
      };

      // Delegar el envío al método privado
      const success = await this._sendMail(msg);

      // Actualizar métricas basadas en el resultado del envío
      if (success) {
        this.metrics.sentAlerts++; // Incrementar solo si _sendMail tuvo éxito
        this.metrics.lastSuccessTime = new Date();
      } else {
        // _sendMail ya incrementó failedAlerts y actualizó lastError
        console.warn(`Fallo al enviar alerta tipo ${type}`);
      }

    } catch (error) {
      // Capturar errores inesperados durante el formateo o la lógica previa al envío
      console.error(`Error general procesando alerta de email (tipo ${alert.type}):`, error);
      this.metrics.failedAlerts++;
      this.metrics.lastError = `Error procesando ${alert.type}: ${error.message}`;
      // No relanzar para no detener el procesamiento de otras alertas en la cola
    }
  }

  // --- Métodos Específicos de Envío (Usan _sendMail) ---

  async sendPasswordResetEmail(email, resetToken, resetUrl) {
    if (!email || !resetUrl) {
      console.error("EmailService: Correo o URL de restablecimiento no proporcionados");
      return false;
    }
    const subject = `${this.appName} - Restablecimiento de Contraseña`;
    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
                <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Restablecimiento de Contraseña</h2>
                <p>Se ha solicitado un restablecimiento de contraseña para tu cuenta en <strong>${this.appName}</strong>.</p>
                <p>Para continuar con el proceso, haz clic en el siguiente enlace:</p>
                <p style="margin: 20px 0;">
                <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Restablecer Contraseña
                </a>
                </p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <p>Este enlace expirará en 1 hora por seguridad.</p>
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
                <p>Este es un mensaje automático del sistema de ${this.companyName}. Por favor no responda a este correo.</p>
                </div>
            </div>
        `;
    const text = this._stripHtml(html); // Generar texto plano

    const success = await this._sendMail({ to: email, subject, text, html });
    if (success) {
      this.recordEmailSuccess(subject, 1); // Actualizar métricas manualmente si es necesario
    } else {
      this.recordEmailError(subject, this.metrics.lastError || "Error desconocido");
    }
    return success;
  }

  async sendPasswordResetConfirmationEmail(email) {
    if (!email) {
      console.error("EmailService: Correo no proporcionado para confirmación.");
      return false;
    }
    const subject = `${this.appName} - Contraseña restablecida con éxito`;
    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
                <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Contraseña Restablecida</h2>
                <p>Tu contraseña ha sido restablecida exitosamente.</p>
                <p>Si tú no realizaste este cambio, contacta a soporte inmediatamente.</p>
                <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
                <p>Este es un mensaje automático del sistema de ${this.companyName}. Por favor no responda a este correo.</p>
                </div>
            </div>
        `;
    const text = this._stripHtml(html);

    const success = await this._sendMail({ to: email, subject, text, html });
    if (success) {
      this.recordEmailSuccess(subject, 1);
    } else {
      this.recordEmailError(subject, this.metrics.lastError || "Error desconocido");
    }
    return success;
  }

  async sendTemperatureRangeAlertsEmail(outOfRangeChannels, currentTime = null, recipients = null, forceOutsideWorkingHours = false) {
    // Usar NotificationController para verificar horario laboral
    if (!forceOutsideWorkingHours && notificationController.isWithinWorkingHours(currentTime)) {
      console.log("EmailService: Dentro de horario laboral. Posponiendo alerta de temperatura.");
      return false; // No enviar si estamos en horario laboral y no se fuerza
    }

    if (!outOfRangeChannels || outOfRangeChannels.length === 0) {
      console.log("EmailService: No hay canales fuera de rango para reportar.");
      return false;
    }

    const emailRecipients = recipients || this.defaultRecipients;
    if (!emailRecipients || emailRecipients.length === 0) {
      console.error("EmailService: No hay destinatarios para alerta de temperatura.");
      return false;
    }

    const subject = `Alerta de Temperatura - ${outOfRangeChannels.length} canales fuera de rango`;
    const { html, text } = this._formatTemperatureAlertContent(outOfRangeChannels);

    const success = await this._sendMail({ to: emailRecipients, subject, text, html });
    if (success) {
      this.recordEmailSuccess(subject, emailRecipients.length);
    } else {
      this.recordEmailError(subject, this.metrics.lastError || "Error desconocido");
    }
    return success;
  }

  async sendDisconnectedSensorsEmail(disconnectedChannels, recipients = null) {
    // Nota: Las alertas de desconexión generalmente se envían sin importar el horario.
    if (!disconnectedChannels || disconnectedChannels.length === 0) {
      console.log("EmailService: No hay canales desconectados para reportar.");
      return false;
    }

    const emailRecipients = recipients || this.defaultRecipients;
    if (!emailRecipients || emailRecipients.length === 0) {
      console.error("EmailService: No hay destinatarios para alerta de desconexión.");
      return false;
    }

    const subject = `Alerta de Conexión - ${disconnectedChannels.length} dispositivos con eventos`;
    const { html, text } = this._formatDisconnectionAlertContent(disconnectedChannels);

    const success = await this._sendMail({ to: emailRecipients, subject, text, html });
    if (success) {
      this.recordEmailSuccess(subject, emailRecipients.length);
    } else {
      this.recordEmailError(subject, this.metrics.lastError || "Error desconocido");
    }
    return success;
  }


  // --- Métodos de Ayuda ---

  /**
   * Genera el contenido HTML y Texto para alertas de temperatura.
   * @param {Array} outOfRangeChannels
   * @returns {{html: string, text: string}}
   * @private
   */
  _formatTemperatureAlertContent(outOfRangeChannels) {
    const formattedTime = moment().tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss");
    let htmlRows = "";
    let textContent = `Alerta: ${outOfRangeChannels.length} canales con temperaturas fuera de límites.\nFecha: ${formattedTime}\n\nDetalles:\n`;

    outOfRangeChannels.forEach((channel) => {
      const status = channel.temperature < channel.minThreshold ? "Por debajo" : "Por encima";
      const statusColor = channel.temperature < channel.minThreshold ? "#0000FF" : "#FF0000";
      const readTime = moment(channel.timestamp).tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss");

      textContent += `- ${channel.name}: ${channel.temperature}°C (${status} del rango ${channel.minThreshold}°C - ${channel.maxThreshold}°C). Leído: ${readTime}\n`;

      htmlRows += `
                 <tr>
                     <td style="padding: 8px; border: 1px solid #ddd;">${channel.name || 'N/A'}</td>
                     <td style="padding: 8px; border: 1px solid #ddd;">${channel.temperature !== undefined ? channel.temperature + '°C' : 'N/A'}</td>
                     <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${status}</td>
                     <td style="padding: 8px; border: 1px solid #ddd;">${channel.minThreshold !== undefined ? channel.minThreshold + '°C' : 'N/A'} - ${channel.maxThreshold !== undefined ? channel.maxThreshold + '°C' : 'N/A'}</td>
                     <td style="padding: 8px; border: 1px solid #ddd;">${readTime}</td>
                 </tr>
             `;
    });

    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
                <h2 style="color: #D32F2F; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Alerta de Temperatura</h2>
                <p>Se han detectado <strong>${outOfRangeChannels.length} canales</strong> con temperaturas fuera de los límites establecidos.</p>
                <p>Fecha y hora de la alerta: ${formattedTime}</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Canal</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Temperatura</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Estado</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Rango Permitido</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Hora de Lectura</th>
                        </tr>
                    </thead>
                    <tbody>${htmlRows}</tbody>
                </table>
                <p style="margin-top: 20px; font-style: italic;">Esta alerta se genera automáticamente.</p>
            </div>`;

    return { html, text: textContent };
  }

  /**
   * Genera el contenido HTML y Texto para alertas de desconexión.
   * @param {Array} disconnectedChannels
   * @returns {{html: string, text: string}}
   * @private
   */
  _formatDisconnectionAlertContent(disconnectedChannels) {
    const formattedTime = moment().tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss");
    let htmlRows = "";
    let textContent = `Alerta: ${disconnectedChannels.length} sensores con eventos de conexión reportados.\nFecha: ${formattedTime}\n\nDetalles:\n`;

    disconnectedChannels.forEach((channel) => {
      const finalStatus = channel.lastEvent === "disconnected" ? "DESCONECTADO" : "CONECTADO";
      const statusColor = channel.lastEvent === "disconnected" ? "#FF0000" : "#00AA00";
      const disconnectFormatted = channel.disconnectTime ? moment(channel.disconnectTime).tz(this.timeZone).format("DD/MM HH:mm:ss") : "N/A en periodo";
      const reconnectFormatted = channel.reconnectTime ? moment(channel.reconnectTime).tz(this.timeZone).format("DD/MM HH:mm:ss") : "N/A en periodo";

      textContent += `- ${channel.name}: Estado Actual: ${finalStatus}. Desconexión: ${disconnectFormatted}. Reconexión: ${reconnectFormatted}\n`;

      htmlRows += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${channel.name || 'N/A'}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${finalStatus}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${disconnectFormatted}</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${reconnectFormatted}</td>
                </tr>
            `;
    });

    const html = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
                <h2 style="color: #D32F2F; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Alerta de Conexión de Sensores</h2>
                <p>Se han detectado <strong>${disconnectedChannels.length} sensores</strong> con eventos de conexión o desconexión.</p>
                <p>Fecha y hora de la alerta: ${formattedTime}</p>
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <thead style="background-color: #f2f2f2;">
                        <tr>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Canal</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Estado Actual</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Hora de Desconexión</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Hora de Reconexión</th>
                        </tr>
                    </thead>
                    <tbody>${htmlRows}</tbody>
                </table>
                <p style="margin-top: 20px; font-style: italic;">Esta alerta se genera automáticamente.</p>
            </div>`;

    return { html, text: textContent };
  }

  /**
   * Utilidad para quitar etiquetas HTML de un texto.
   * @param {string} html - Texto HTML.
   * @returns {string} Texto plano.
   * @private
   */
  _stripHtml(html) {
    return html ? html.replace(/<[^>]*>?/gm, '').replace(/ /g, ' ').trim() : '';
  }

  // Métodos de ayuda para métricas (pueden ser llamados desde los métodos públicos)
  recordEmailSuccess(subject, recipientCount) {
    console.log(`Métrica: Correo "${subject}" enviado a ${recipientCount} a las ${new Date().toLocaleTimeString()}`);
    // Podrías incrementar contadores específicos aquí si lo necesitas
  }

  recordEmailError(subject, errorMessage) {
    console.error(`Métrica: Error enviando "${subject}" - ${errorMessage}`);
    // Podrías incrementar contadores específicos aquí
  }

  // generateEmailContent puede permanecer aquí si es lógica específica del servicio
  generateEmailContent(type, data) {
    // ... (la lógica existente para generar subject, htmlContent, plainText según el type)
    // Asegúrate de que devuelve { subject, htmlContent, plainText }
    let subject = "Alerta del Sistema"; // Valor predeterminado
    let htmlContent = `<p>Alerta tipo: ${type}</p><p>Datos: ${JSON.stringify(data)}</p>`; // Contenido predeterminado
    let plainText = `Alerta tipo: ${type}\nDatos: ${JSON.stringify(data)}`; // Contenido predeterminado

    // Añadir lógica específica para 'temperature', 'disconnection', etc.
    switch (type) {
      case "temperature":
      case "disconnection":
        // Reutilizar la lógica de formateo
        const formatted = type === "temperature" ? this._formatTemperatureAlertContent([data]) : this._formatDisconnectionAlertContent([data]);
        subject = `Alerta de ${type === "temperature" ? "Temperatura" : "Conexión"} - ${data.channelName || data.name || data.device || 'Dispositivo desconocido'}`;
        htmlContent = formatted.html;
        plainText = formatted.text;
        break;
      // Añadir más casos si es necesario
    }

    // Asegurarse de devolver siempre el objeto esperado
    return { subject, htmlContent, plainText };
  }

}

module.exports = new EmailService(); // Exportar instancia única
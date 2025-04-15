// src/services/emailService.js

const sgMail = require("@sendgrid/mail");
const fs = require("fs");
const path = require("path");
const BaseAlertService = require("../baseAlertService");
const config = require("../../config/js_files/config-loader");
const moment = require("moment-timezone");
const notificationController = require("../../controllers/notificationController");

/**
 * Servicio centralizado para el envío de correos electrónicos
 */
class EmailService extends BaseAlertService {
  constructor() {
    super();
    this.initialized = false;
    this.config = config.getConfig();
    this.sgMail = sgMail;
    this.sgMail.setApiKey(this.config.email.SENDGRID_API_KEY);

    // Cargar configuración de email desde el config-loader
    this.fromEmail = this.config.email?.email_contacto?.from_verificado;
    this.defaultRecipients = this.config.email?.email_contacto?.destinatarios || [];

    // Horarios laborales desde la configuración centralizada
    this.timeZone = this.config.alertSystem?.timeZone || "America/Santiago";

    // Imprimir información de diagnóstico
    console.log(`Email Service - TimeZone: ${this.timeZone}`);
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Inicializar temporizadores del servicio base
      this.initializeTimers();
      this.initialized = true;
      console.log("✅ EmailService inicializado correctamente");
    } catch (error) {
      console.error("❌ Error inicializando EmailService:", error);
      throw error;
    }
  }

  async processAlert(alert) {
    if (!this.initialized) {
      throw new Error("EmailService no inicializado");
    }

    try {
      const { type, data, recipients } = alert;

      // Verificar que haya destinatarios, usar los predeterminados si no hay
      const emailRecipients = recipients || this.defaultRecipients;

      if (!emailRecipients || emailRecipients.length === 0) {
        throw new Error("No hay destinatarios configurados para la alerta");
      }

      // Generar contenido del correo basado en el tipo de alerta
      const { subject, htmlContent, plainText } = this.generateEmailContent(type, data);

      const msg = {
        to: emailRecipients,
        from: this.fromEmail,
        subject: subject,
        text: plainText,
        html: htmlContent
      };

      await this.sgMail.send(msg);
      this.metrics.sentAlerts++;
      this.metrics.lastSuccessTime = new Date();
    } catch (error) {
      console.error("Error enviando alerta por email:", error);
      this.metrics.failedAlerts++;
      this.metrics.lastError = error.message;
      throw error;
    }
  }

  generateEmailContent(type, data) {
    let subject, htmlContent, plainText;

    switch (type) {
      case "temperature":
        subject = `Alerta de Temperatura - ${data.location}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Alerta de Temperatura</h2>
            <p>Se ha detectado una temperatura fuera del rango permitido:</p>
            <ul>
              <li>Ubicación: ${data.location}</li>
              <li>Temperatura actual: ${data.temperature}°C</li>
              <li>Límite mínimo: ${data.minThreshold}°C</li>
              <li>Límite máximo: ${data.maxThreshold}°C</li>
            </ul>
            <p>Fecha y hora: ${new Date().toLocaleString()}</p>
          </div>
        `;
        plainText = `Alerta de Temperatura\nUbicación: ${data.location}\nTemperatura: ${data.temperature}°C\nLímites: ${data.minThreshold}°C - ${data.maxThreshold}°C`;
        break;

      case "disconnection":
        subject = `Alerta de Desconexión - ${data.device}`;
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Alerta de Desconexión</h2>
            <p>Se ha detectado una desconexión en el dispositivo:</p>
            <ul>
              <li>Dispositivo: ${data.device}</li>
              <li>Última conexión: ${data.lastConnection}</li>
              <li>Tiempo sin conexión: ${data.disconnectionTime}</li>
            </ul>
            <p>Fecha y hora: ${new Date().toLocaleString()}</p>
          </div>
        `;
        plainText = `Alerta de Desconexión\nDispositivo: ${data.device}\nÚltima conexión: ${data.lastConnection}\nTiempo sin conexión: ${data.disconnectionTime}`;
        break;

      default:
        subject = data.subject || "Alerta del Sistema";
        htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">${subject}</h2>
            <p>${data.message || "Se ha generado una alerta en el sistema."}</p>
            <p>Fecha y hora: ${new Date().toLocaleString()}</p>
          </div>
        `;
        plainText = `${subject}\n${data.message || "Se ha generado una alerta en el sistema."}`;
    }

    return { subject, htmlContent, plainText };
  }

  async sendAlert(subject, data, templateName) {
    if (!this.initialized) {
      throw new Error("EmailService no inicializado");
    }

    let alert;

    // Si se recibe un objeto completo (nuevo formato)
    if (typeof subject === 'object') {
      alert = subject;
    } else {
      // Formato antiguo (subject, data, templateName)
      alert = {
        type: templateName,
        data: { ...data, subject },
        recipients: this.defaultRecipients,
        priority: data?.priority || "normal",
        timestamp: new Date()
      };
    }

    return this.processAlert(alert);
  }

  getStatus() {
    return {
      ...super.getStatus(),
      service: "email",
      config: {
        fromEmail: this.fromEmail,
        recipients: this.defaultRecipients
      }
    };
  }

  /**
   * Verifica si estamos dentro del horario laboral para enviar notificaciones
   * Usa NotificationController como fuente centralizada
   * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar (opcional)
   * @returns {boolean} true si estamos en horario laboral
   */
  isWithinWorkingHours(checkTime = null) {
    // Usar NotificationController como fuente centralizada
    return notificationController.isWithinWorkingHours();
  }

  /**
   * Verifica si el servicio de email está correctamente configurado
   */
  isConfigured() {
    const hasApiKey = !!this.config.email?.SENDGRID_API_KEY;
    const hasFromEmail = !!this.fromEmail;

    if (!hasApiKey) {
      console.error("Email Service - Error: SendGrid API key no configurada");
    }

    if (!hasFromEmail) {
      console.error("Email Service - Error: Email de remitente no configurado");
    }

    return hasApiKey && hasFromEmail;
  }

  /**
   * Convierte una hora en formato decimal a texto (8.5 -> "8:30")
   */
  _formatHourToText(hourDecimal) {
    const hours = Math.floor(hourDecimal);
    const minutes = Math.round((hourDecimal - hours) * 60);
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  }

  /**
   * Devuelve una descripción de texto del horario laboral
   */
  getWorkingHoursDescription() {
    // Obtener la configuración desde notificationController
    const workingHours = notificationController.workingHours;

    const weekdayStart = this._formatHourToText(
      workingHours.weekdays.start
    );
    const weekdayEnd = this._formatHourToText(workingHours.weekdays.end);
    const saturdayStart = this._formatHourToText(
      workingHours.saturday.start
    );
    const saturdayEnd = this._formatHourToText(workingHours.saturday.end);

    return `Lunes a Viernes de ${weekdayStart} a ${weekdayEnd}, Sábados de ${saturdayStart} a ${saturdayEnd}`;
  }

  /**
   * Envía un correo para restablecer la contraseña
   */
  async sendPasswordResetEmail(email, resetToken, resetUrl) {
    if (!email || !resetUrl) {
      console.error(
        "Error: Correo o URL de restablecimiento no proporcionados"
      );
      return false;
    }

    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }

    const appConfig = config.getConfig();
    const appName = appConfig.appName || "Sistema de Monitoreo";
    const companyName = appConfig.companyName || "The Next Security";

    const message = {
      to: email,
      from: this.fromEmail,
      subject: `${appName} - Restablecimiento de Contraseña`,
      text: `Para restablecer tu contraseña en ${appName}, haz clic en el siguiente enlace: ${resetUrl}. Este enlace expirará en 1 hora por seguridad.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Restablecimiento de Contraseña</h2>
          <p>Se ha solicitado un restablecimiento de contraseña para tu cuenta en <strong>${appName}</strong>.</p>
          <p>Para continuar con el proceso, haz clic en el siguiente enlace:</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block;">
              Restablecer Contraseña
            </a>
          </p>
          <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
          <p>Este enlace expirará en 1 hora por seguridad.</p>
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p>Este es un mensaje automático del sistema de ${companyName}. Por favor no responda a este correo.</p>
          </div>
        </div>
      `,
    };

    try {
      await this.sgMail.send(message);
      console.log(`Correo de restablecimiento enviado a: ${email}`);
      this.recordEmailSuccess(message.subject, 1);
      return true;
    } catch (error) {
      console.error("Error al enviar correo de restablecimiento:", error);
      if (error.response) {
        console.error("Datos de respuesta:", error.response.body);
      }
      this.recordEmailError(message.subject, error.message);
      return false;
    }
  }

  /**
   * Envía un correo de confirmación después de restablecer la contraseña
   */
  async sendPasswordResetConfirmationEmail(email) {
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }

    const appConfig = config.getConfig();
    const appName = appConfig.appName || "Sistema de Monitoreo";
    const companyName = appConfig.companyName || "The Next Security";

    const message = {
      to: email,
      from: this.fromEmail,
      subject: `${appName} - Contraseña restablecida con éxito`,
      text: `Su contraseña ha sido restablecida exitosamente.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Contraseña Restablecida</h2>
          <p>Tu contraseña ha sido restablecida exitosamente.</p>
          <p>Si tú no realizaste este cambio, contacta a soporte inmediatamente.</p>
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p>Este es un mensaje automático del sistema de ${companyName}. Por favor no responda a este correo.</p>
          </div>
        </div>
      `,
    };

    try {
      await this.sgMail.send(message);
      console.log(`Correo de confirmación enviado a: ${email}`);
      this.recordEmailSuccess(message.subject, 1);
      return true;
    } catch (error) {
      console.error("Error al enviar correo de confirmación:", error);
      if (error.response) {
        console.error("Datos de respuesta:", error.response.body);
      }
      this.recordEmailError(message.subject, error.message);
      return false;
    }
  }

  /**
 * Envía un correo con todos los canales fuera del rango de temperatura
 * Adaptado para funcionar con el nuevo formato de alertas agrupadas
 *
 * @param {Array} outOfRangeChannels - Array de objetos con información de canales fuera de rango
 * @param {Date} [currentTime=null] - Hora actual
 * @param {Array} [recipients=null] - Lista de destinatarios
 * @param {boolean} [forceOutsideWorkingHours=false] - Forzar envío incluso en horario laboral
 * @returns {Promise<boolean>} true si el correo se envió exitosamente
 */
  async sendTemperatureRangeAlertsEmail(
    outOfRangeChannels,
    currentTime = null,
    recipients = null,
    forceOutsideWorkingHours = false
  ) {
    if (!this.isConfigured() || !this.initialized) {
      return false;
    }

    // CAMBIO CRÍTICO: Usar NotificationController para verificar horario laboral
    if (!forceOutsideWorkingHours && notificationController.isWithinWorkingHours()) {
      console.log(
        `Email Service - Dentro de horario laboral. Posponiendo alertas de temperatura para fuera de horario.`
      );
      return false;
    }

    if (!outOfRangeChannels || outOfRangeChannels.length === 0) {
      console.log(
        "Email Service - No hay canales fuera de rango para reportar."
      );
      return false;
    }

    // Usar destinatarios proporcionados o los predeterminados
    const emailRecipients = recipients || this.defaultRecipients;

    if (!emailRecipients || emailRecipients.length === 0) {
      console.error(
        "Email Service - No hay destinatarios configurados para la alerta de temperatura."
      );
      return false;
    }

    const formattedTime = moment()
      .tz(this.timeZone)
      .format("DD/MM/YYYY HH:mm:ss");
    let textContent = `Alerta: ${outOfRangeChannels.length} canales tienen temperaturas fuera de los límites establecidos.\n\n`;
    let htmlRows = "";

    // CAMBIO: Adaptado para trabajar con el nuevo formato de alertas
    outOfRangeChannels.forEach((channel) => {
      // Verificar si tenemos múltiples lecturas
      const hasMultipleReadings = channel.allReadings && channel.allReadings.length > 1;

      const status =
        channel.temperature < channel.minThreshold
          ? "Por debajo"
          : "Por encima";

      const readTime = moment(channel.timestamp)
        .tz(this.timeZone)
        .format("DD/MM/YYYY HH:mm:ss");

      textContent += `- ${channel.name}: ${channel.temperature}°C (${status} del rango permitido: ${channel.minThreshold}°C - ${channel.maxThreshold}°C). Leído a las ${readTime}\n`;

      // Usar colores para destacar el tipo de alerta
      const statusColor =
        channel.temperature < channel.minThreshold ? "#0000FF" : "#FF0000";

      // Crear fila principal
      htmlRows += `
          <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${channel.name}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${channel.temperature}°C</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${status}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${channel.minThreshold}°C - ${channel.maxThreshold}°C</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${readTime}</td>
          </tr>
      `;

      // Si hay múltiples lecturas, agregar detalles de cada una (opcional)
      if (hasMultipleReadings) {
        channel.allReadings.forEach((reading, index) => {
          if (index === channel.allReadings.length - 1) return; // Omitir la última que ya está en la fila principal

          const readingStatus = reading.temperature < reading.minThreshold ? "Por debajo" : "Por encima";
          const readingColor = reading.temperature < reading.minThreshold ? "#0000FF" : "#FF0000";
          const readingTime = moment(reading.timestamp).tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss");

          htmlRows += `
                  <tr style="background-color: #f9f9f9;">
                      <td style="padding: 4px 8px; border: 1px solid #ddd; font-size: 0.9em;">${channel.name} (lectura previa)</td>
                      <td style="padding: 4px 8px; border: 1px solid #ddd; font-size: 0.9em;">${reading.temperature}°C</td>
                      <td style="padding: 4px 8px; border: 1px solid #ddd; color: ${readingColor}; font-weight: bold; font-size: 0.9em;">${readingStatus}</td>
                      <td style="padding: 4px 8px; border: 1px solid #ddd; font-size: 0.9em;">${reading.minThreshold}°C - ${reading.maxThreshold}°C</td>
                      <td style="padding: 4px 8px; border: 1px solid #ddd; font-size: 0.9em;">${readingTime}</td>
                  </tr>
              `;
        });
      }
    });

    const message = {
      to: emailRecipients,
      from: this.fromEmail,
      subject: `Alerta de Temperatura - ${outOfRangeChannels.length} canales fuera de rango`,
      text: textContent,
      html: `
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
                  <tbody>
                      ${htmlRows}
                  </tbody>
              </table>
              
              <p style="margin-top: 20px; font-style: italic;">Esta alerta se genera automáticamente. Por favor, tome las medidas necesarias.</p>
          </div>
      `,
    };

    try {
      await this.sgMail.send(message);
      console.log(
        `Correo de alerta de temperatura enviado a: ${emailRecipients.join(
          ", "
        )}`
      );

      // Registrar el éxito en las métricas o log
      this.recordEmailSuccess(message.subject, emailRecipients.length);
      return true;
    } catch (error) {
      console.error("Error al enviar correo de alerta de temperatura:", error);
      if (error.response) {
        console.error("Datos de respuesta:", error.response.body);
      }

      // Registrar el error en las métricas o log
      this.recordEmailError(message.subject, error.message);
      return false;
    }
  }

  /**
 * Envía un correo con todos los canales desconectados
 * Adaptado para funcionar con el nuevo formato de alertas agrupadas
 * @param {Array} disconnectedChannels - Canales desconectados
 * @param {Array} [recipients=null] - Destinatarios personalizados
 * @returns {Promise<boolean>} true si el envío fue exitoso
 */
  async sendDisconnectedSensorsEmail(disconnectedChannels, recipients = null) {
    if (!this.isConfigured() || !this.initialized) {
      return false;
    }

    if (!disconnectedChannels || disconnectedChannels.length === 0) {
      console.log(
        "Email Service - No hay canales desconectados para reportar."
      );
      return false;
    }

    // Usar destinatarios proporcionados o los predeterminados
    const emailRecipients = recipients || this.defaultRecipients;

    if (!emailRecipients || emailRecipients.length === 0) {
      console.error(
        "Email Service - No hay destinatarios configurados para la alerta de desconexión."
      );
      return false;
    }

    // Registrar datos del envío (ayuda en diagnóstico)
    console.log(
      `Email Service - Enviando alerta de ${disconnectedChannels.length} sensores desconectados a ${emailRecipients.length} destinatarios.`
    );

    const formattedTime = moment()
      .tz(this.timeZone)
      .format("DD/MM/YYYY HH:mm:ss");
    let textContent = `Alerta: ${disconnectedChannels.length} sensores de temperatura tienen eventos de conexión reportados.\n\n`;
    let htmlRows = "";

    // CAMBIO: Adaptado para el nuevo formato con eventos agrupados
    disconnectedChannels.forEach((channel) => {
      // Determinar si tuvo eventos de desconexión y reconexión
      const hadDisconnection = channel.disconnectTime !== undefined;
      const hadReconnection = channel.reconnectTime !== undefined;

      // Formatear tiempos
      const disconnectFormatted = hadDisconnection ?
        moment(channel.disconnectTime).tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss") :
        "No en este período";

      const reconnectFormatted = hadReconnection ?
        moment(channel.reconnectTime).tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss") :
        "No en este período";

      // Determinar estado final
      const finalStatus = channel.lastEvent === "disconnected" ?
        "DESCONECTADO" : "CONECTADO";

      // Texto plano del mensaje
      textContent += `- ${channel.name}: Estado actual: ${finalStatus}\n`;
      textContent += `  Desconexión: ${disconnectFormatted}\n`;
      textContent += `  Reconexión: ${reconnectFormatted}\n\n`;

      // Formatear fila HTML
      const statusColor = channel.lastEvent === "disconnected" ? "#FF0000" : "#00AA00";

      htmlRows += `
          <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${channel.name}</td>
              <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${finalStatus}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${disconnectFormatted}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reconnectFormatted}</td>
          </tr>
      `;

      // Añadir detalles de cada evento (opcional)
      if (channel.events && channel.events.length > 1) {
        channel.events.forEach((event, index) => {
          const eventTime = moment(event.timestamp).tz(this.timeZone).format("DD/MM/YYYY HH:mm:ss");
          const eventColor = event.event === "disconnected" ? "#FF0000" : "#00AA00";

          htmlRows += `
                  <tr style="background-color: #f9f9f9;">
                      <td style="padding: 4px 8px; border: 1px solid #ddd; font-size: 0.9em;">${channel.name} (evento ${index + 1})</td>
                      <td style="padding: 4px 8px; border: 1px solid #ddd; color: ${eventColor}; font-weight: bold; font-size: 0.9em;">${event.event.toUpperCase()}</td>
                      <td style="padding: 4px 8px; border: 1px solid #ddd; font-size: 0.9em;" colspan="2">${eventTime}</td>
                  </tr>
              `;
        });
      }
    });

    const message = {
      to: emailRecipients,
      from: this.fromEmail,
      subject: `Alerta de Conexión de Sensores - ${disconnectedChannels.length} dispositivos con eventos reportados`,
      text: textContent,
      html: `
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
                  <tbody>
                      ${htmlRows}
                  </tbody>
              </table>
              
              <p style="margin-top: 20px; font-style: italic;">Esta alerta se genera automáticamente y se envía fuera del horario laboral.</p>
          </div>
      `,
    };

    try {
      await this.sgMail.send(message);
      console.log(
        `Correo de alerta de conexión de sensores enviado a: ${emailRecipients.join(
          ", "
        )}`
      );

      // Registrar el éxito en las métricas o log
      this.recordEmailSuccess(message.subject, emailRecipients.length);
      return true;
    } catch (error) {
      console.error(
        "Error al enviar correo de alerta de sensores desconectados:",
        error
      );
      if (error.response) {
        console.error("Datos de respuesta:", error.response.body);
      }

      // Registrar el error en las métricas o log
      this.recordEmailError(message.subject, error.message);
      return false;
    }
  }

  /**
   * Registra una operación exitosa de envío de correo (para métricas)
   */
  recordEmailSuccess(subject, recipientCount) {
    console.log(
      `Email Service - Métricas: Correo "${subject}" enviado a ${recipientCount} destinatarios a las ${new Date().toLocaleTimeString()}`
    );
  }

  /**
   * Registra un error de envío de correo (para métricas)
   */
  recordEmailError(subject, errorMessage) {
    console.error(
      `Email Service - Métricas: Error enviando "${subject}" - ${errorMessage}`
    );
  }
}

module.exports = new EmailService();
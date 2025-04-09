// src/services/emailService.js

const sgMail = require("@sendgrid/mail");
const fs = require("fs");
const path = require("path");
const BaseAlertService = require("./baseAlertService");
const config = require("../config/js_files/config-loader");
const moment = require("moment-timezone");

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

    // Horarios laborales desde la configuración centralizada de SMS
    if (this.config.sms && this.config.sms.workingHours) {
      this.workingHours = this.config.sms.workingHours;
      this.timeZone = this.config.sms.timeZone || "America/Santiago";
    } else {
      // Valores por defecto si no se encuentra configuración
      this.workingHours = {
        weekdays: {
          // Lunes a Viernes
          start: 8.5, // 8:30
          end: 18.5, // 18:30
        },
        saturday: {
          // Sábado
          start: 8.5, // 8:30
          end: 14.5, // 14:30
        },
      };
      this.timeZone = "America/Santiago";
    }

    // Imprimir información de diagnóstico
    console.log(`Email Service - TimeZone: ${this.timeZone}`);
    console.log(
      `Email Service - Working Hours: Mon-Fri ${this.workingHours.weekdays.start}-${this.workingHours.weekdays.end}, Sat ${this.workingHours.saturday.start}-${this.workingHours.saturday.end}`
    );
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
   * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar (opcional)
   * @returns {boolean} true si estamos en horario laboral
   */
  isWithinWorkingHours(checkTime = null) {
    // Si hay una hora específica para verificar, usarla, sino usar la hora actual
    let timeToCheck;

    if (checkTime) {
      // Preservar el objeto moment original si ya es un objeto moment
      timeToCheck = moment.isMoment(checkTime)
        ? checkTime.clone()
        : moment(checkTime);
    } else {
      timeToCheck = moment();
    }

    const localTime = timeToCheck.tz(this.timeZone);

    // Obtener el día de la semana y la hora como decimal para las comparaciones
    const dayOfWeek = localTime.day(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
    const hourDecimal = localTime.hour() + localTime.minute() / 60; // Hora como decimal (ej: 8:30 = 8.5)

    console.log(
      `Verificando horario: día ${dayOfWeek}, hora ${hourDecimal.toFixed(
        2
      )}, fecha completa: ${localTime.format("YYYY-MM-DD HH:mm:ss")}`
    );

    // Domingo siempre está fuera de horario laboral
    if (dayOfWeek === 0) {
      return false;
    }

    // Sábado tiene horario especial
    if (dayOfWeek === 6) {
      return (
        hourDecimal >= this.workingHours.saturday.start &&
        hourDecimal <= this.workingHours.saturday.end
      );
    }

    // Lunes a viernes (días 1-5)
    return (
      hourDecimal >= this.workingHours.weekdays.start &&
      hourDecimal <= this.workingHours.weekdays.end
    );
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
    const weekdayStart = this._formatHourToText(
      this.workingHours.weekdays.start
    );
    const weekdayEnd = this._formatHourToText(this.workingHours.weekdays.end);
    const saturdayStart = this._formatHourToText(
      this.workingHours.saturday.start
    );
    const saturdayEnd = this._formatHourToText(this.workingHours.saturday.end);

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
   * Solo envía FUERA del horario laboral a menos que se fuerce con forceOutsideWorkingHours
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
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }

    // CAMBIO CRÍTICO: Invertir la lógica para enviar solo FUERA del horario laboral
    // a menos que se fuerce específicamente con el parámetro forceOutsideWorkingHours
    if (!forceOutsideWorkingHours && this.isWithinWorkingHours(currentTime)) {
      const workingHoursDesc = this.getWorkingHoursDescription();
      console.log(
        `Email Service - Dentro de horario laboral (${workingHoursDesc}). Posponiendo alertas de temperatura para fuera de horario.`
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

    outOfRangeChannels.forEach((channel) => {
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

      htmlRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.temperature}°C</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${status}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.minThreshold}°C - ${channel.maxThreshold}°C</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${readTime}</td>
        </tr>
      `;
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
   * Se envía independientemente del horario
   */
  async sendDisconnectedSensorsEmail(disconnectedChannels, recipients = null) {
    if (!this.isConfigured() || !this.initialize()) {
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
    let textContent = `Alerta: ${disconnectedChannels.length} sensores de temperatura están desconectados.\n\n`;
    let htmlRows = "";

    disconnectedChannels.forEach((channel) => {
      const lastConnectionFormatted = moment(channel.lastConnectionTime)
        .tz(this.timeZone)
        .format("DD/MM/YYYY HH:mm:ss");
      const disconnectionDuration = moment.duration(
        moment().diff(moment(channel.lastConnectionTime))
      );
      const durationText = `${Math.floor(
        disconnectionDuration.asHours()
      )}h ${disconnectionDuration.minutes()}m`;

      textContent += `- ${channel.name}: Sin conexión desde ${lastConnectionFormatted} (${durationText}). Límite de desconexión configurado: ${channel.disconnectionInterval} minutos\n`;

      htmlRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${lastConnectionFormatted}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${durationText}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.disconnectionInterval} minutos</td>
        </tr>
      `;
    });

    const message = {
      to: emailRecipients,
      from: this.fromEmail,
      subject: `Alerta de Sensores Desconectados - ${disconnectedChannels.length} dispositivos sin conexión`,
      text: textContent,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <h2 style="color: #D32F2F; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Alerta de Sensores Desconectados</h2>
          <p>Se han detectado <strong>${disconnectedChannels.length} sensores</strong> de temperatura sin conexión.</p>
          <p>Fecha y hora de la alerta: ${formattedTime}</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead style="background-color: #f2f2f2;">
              <tr>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Canal</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Última Conexión</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Tiempo Sin Conexión</th>
                <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Límite Configurado</th>
              </tr>
            </thead>
            <tbody>
              ${htmlRows}
            </tbody>
          </table>
          
          <p style="margin-top: 20px; color: #D32F2F; font-weight: bold;">Se requiere atención inmediata para restablecer la conexión de estos sensores.</p>
          <p style="font-style: italic;">Esta alerta se genera automáticamente y se envía independientemente del horario laboral.</p>
        </div>
      `,
    };

    try {
      await this.sgMail.send(message);
      console.log(
        `Correo de alerta de sensores desconectados enviado a: ${emailRecipients.join(
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
// src/services/emailService.js
const sgMail = require('@sendgrid/mail');
const configLoader = require('../config/js_files/config-loader');
const moment = require('moment-timezone');

/**
 * Servicio centralizado para el envío de correos electrónicos
 * Maneja todos los casos de correos del sistema utilizando SendGrid
 */
class EmailService {
  constructor() {
    const config = configLoader.getConfig();
    
    // Cargar configuración de email desde el config-loader
    this.apiKey = config.email?.SENDGRID_API_KEY;
    this.fromEmail = config.email?.email_contacto?.from_verificado;
    this.defaultRecipients = config.email?.email_contacto?.destinatarios || [];
    
    // Parámetros de configuración para el envío de correos
    this.initialized = false;
    this.workingHoursStart = config.email?.working_hours?.start || 8; // 8:00 AM por defecto
    this.workingHoursEnd = config.email?.working_hours?.end || 20;    // 8:00 PM por defecto
    this.timeZone = config.measurement?.zona_horaria || 'America/Santiago';
    
    // Imprimir información de diagnóstico
    console.log(`Email Service - TimeZone: ${this.timeZone}`);
    console.log(`Email Service - Working Hours: ${this.workingHoursStart}:00 to ${this.workingHoursEnd}:00`);
  }

  /**
   * Inicializa el servicio de correo electrónico
   * @throws {Error} Si hay problemas con la configuración de la API key
   * @returns {boolean} true si la inicialización fue exitosa
   */
  initialize() {
    if (this.initialized) return true;
    
    if (!this.apiKey) {
      // Intentar recargar la configuración en caso de que haya cambiado
      const config = configLoader.reloadConfig();
      this.apiKey = config.email?.SENDGRID_API_KEY;
      
      if (!this.apiKey) {
        console.error('Error: SendGrid API key no encontrada en la configuración');
        throw new Error('SendGrid API key no disponible. Verifique la configuración.');
      }
    }
    
    try {
      sgMail.setApiKey(this.apiKey);
      this.initialized = true;
      console.log('✅ Email service initialized');
      return true;
    } catch (error) {
      console.error('Error initializing email service:', error);
      throw error;
    }
  }

  /**
   * Verifica si estamos dentro del horario laboral para enviar notificaciones
   * @param {Date|string|null} [checkTime=null] - Tiempo específico a verificar (opcional)
   * @returns {boolean} true si estamos en horario laboral
   */
  isWithinWorkingHours(checkTime = null) {
    // Si hay una hora específica para verificar, usarla, sino usar la hora actual
    const timeToCheck = checkTime ? moment(checkTime) : moment();
    const localTime = timeToCheck.tz(this.timeZone);
    
    const currentHour = localTime.hour();
    const isWorkday = localTime.day() > 0 && localTime.day() < 6; // 0 es domingo, 6 es sábado
    
    // Solo se considera dentro de horario laboral si es día de semana y está dentro del rango horario
    return isWorkday && currentHour >= this.workingHoursStart && currentHour < this.workingHoursEnd;
  }
  
  /**
   * Verifica si el servicio de email está correctamente configurado
   * @returns {boolean} true si el servicio está configurado correctamente
   */
  isConfigured() {
    const hasApiKey = !!this.apiKey;
    const hasFromEmail = !!this.fromEmail;
    
    if (!hasApiKey) {
      console.error('Email Service - Error: SendGrid API key no configurada');
    }
    
    if (!hasFromEmail) {
      console.error('Email Service - Error: Email de remitente no configurado');
    }
    
    return hasApiKey && hasFromEmail;
  }

  /**
   * Envía un correo para restablecer la contraseña
   * @param {string} email - Correo del usuario
   * @param {string} resetToken - Token único de restablecimiento
   * @param {string} resetUrl - URL completa para restablecer
   * @returns {Promise<boolean>} true si el correo se envió exitosamente
   */
  async sendPasswordResetEmail(email, resetToken, resetUrl) {
    if (!email || !resetUrl) {
      console.error('Error: Correo o URL de restablecimiento no proporcionados');
      return false;
    }
    
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }
    
    // Obtener nombre de aplicación desde config
    const config = configLoader.getConfig();
    const appName = config.appName || 'Sistema de Monitoreo';
    const companyName = config.companyName || 'The Next Security';
    
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
      `
    };

    try {
      await sgMail.send(message);
      console.log(`Correo de restablecimiento enviado a: ${email}`);
      return true;
    } catch (error) {
      console.error('Error al enviar correo de restablecimiento:', error);
      if (error.response) {
        console.error('Datos de respuesta:', error.response.body);
      }
      return false;
    }
  }

  /**
   * Envía un correo de confirmación después de restablecer la contraseña
   * @param {string} email - Correo del usuario
   * @returns {Promise<boolean>} true si el correo se envió exitosamente
   */
  async sendPasswordResetConfirmationEmail(email) {
    this.initialize();
    
    const message = {
      to: email,
      from: this.fromEmail,
      subject: 'Contraseña restablecida con éxito',
      text: 'Su contraseña ha sido restablecida exitosamente.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
          <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Contraseña Restablecida</h2>
          <p>Tu contraseña ha sido restablecida exitosamente.</p>
          <p>Si tú no realizaste este cambio, contacta a soporte inmediatamente.</p>
        </div>
      `
    };

    try {
      await sgMail.send(message);
      console.log(`Correo de confirmación enviado a: ${email}`);
      return true;
    } catch (error) {
      console.error('Error al enviar correo de confirmación:', error);
      if (error.response) {
        console.error('Datos de respuesta:', error.response.body);
      }
      return false;
    }
  }

  /**
   * Envía un correo con todos los canales fuera del rango de temperatura
   * Solo envía durante horario laboral
   * 
   * @param {Array} outOfRangeChannels - Array de objetos con información de canales fuera de rango
   * @param {Date} [currentTime=null] - Hora actual
   * @param {Array} [recipients=null] - Lista de destinatarios (opcional, usa la lista por defecto si no se proporciona)
   * @param {boolean} [forceOutsideWorkingHours=false] - Forzar envío incluso fuera de horario laboral
   * @returns {Promise<boolean>} true si el correo se envió exitosamente
   */
  async sendTemperatureRangeAlertsEmail(outOfRangeChannels, currentTime = null, recipients = null, forceOutsideWorkingHours = false) {
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }
    
    // Verificar si estamos en horario laboral (a menos que se fuerce el envío)
    if (!forceOutsideWorkingHours && !this.isWithinWorkingHours(currentTime)) {
      console.log(`Email Service - Fuera de horario laboral (${this.workingHoursStart}:00-${this.workingHoursEnd}:00). No se envían alertas de temperatura.`);
      return false;
    }

    if (!outOfRangeChannels || outOfRangeChannels.length === 0) {
      console.log('Email Service - No hay canales fuera de rango para reportar.');
      return false;
    }
    
    // Usar destinatarios proporcionados o los predeterminados
    const emailRecipients = recipients || this.defaultRecipients;
    
    if (!emailRecipients || emailRecipients.length === 0) {
      console.error('Email Service - No hay destinatarios configurados para la alerta de temperatura.');
      return false;
    }

    const formattedTime = moment().tz(this.timeZone).format('DD/MM/YYYY HH:mm:ss');
    let textContent = `Alerta: ${outOfRangeChannels.length} canales tienen temperaturas fuera de los límites establecidos.\n\n`;
    let htmlRows = '';

    outOfRangeChannels.forEach(channel => {
      const status = channel.temperature < channel.minThreshold ? 'Por debajo' : 'Por encima';
      const readTime = moment(channel.timestamp).tz(this.timeZone).format('DD/MM/YYYY HH:mm:ss');
      
      textContent += `- ${channel.name}: ${channel.temperature}°C (${status} del rango permitido: ${channel.minThreshold}°C - ${channel.maxThreshold}°C). Leído a las ${readTime}\n`;
      
      // Usar colores para destacar el tipo de alerta
      const statusColor = channel.temperature < channel.minThreshold ? '#0000FF' : '#FF0000';
      
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
      to: recipients,
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
      `
    };

    try {
      await sgMail.send(message);
      console.log(`Correo de alerta de temperatura enviado a: ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error al enviar correo de alerta de temperatura:', error);
      if (error.response) {
        console.error('Datos de respuesta:', error.response.body);
      }
      return false;
    }
  }

  /**
   * Envía un correo con todos los canales desconectados
   * Se envía independientemente del horario
   * 
   * @param {Array} disconnectedChannels - Array de objetos con información de canales desconectados
   * @param {Array} [recipients=null] - Lista de destinatarios (opcional, usa la lista por defecto si no se proporciona)
   * @returns {Promise<boolean>} true si el correo se envió exitosamente
   */
  async sendDisconnectedSensorsEmail(disconnectedChannels, recipients = null) {
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }
    
    if (!disconnectedChannels || disconnectedChannels.length === 0) {
      console.log('Email Service - No hay canales desconectados para reportar.');
      return false;
    }
    
    // Usar destinatarios proporcionados o los predeterminados
    const emailRecipients = recipients || this.defaultRecipients;
    
    if (!emailRecipients || emailRecipients.length === 0) {
      console.error('Email Service - No hay destinatarios configurados para la alerta de desconexión.');
      return false;
    }
    
    // Registrar datos del envío (ayuda en diagnóstico)
    console.log(`Email Service - Enviando alerta de ${disconnectedChannels.length} sensores desconectados a ${emailRecipients.length} destinatarios.`);

    const formattedTime = moment().tz(this.timeZone).format('DD/MM/YYYY HH:mm:ss');
    let textContent = `Alerta: ${disconnectedChannels.length} sensores de temperatura están desconectados.\n\n`;
    let htmlRows = '';

    disconnectedChannels.forEach(channel => {
      const lastConnectionFormatted = moment(channel.lastConnectionTime).tz(this.timeZone).format('DD/MM/YYYY HH:mm:ss');
      const disconnectionDuration = moment.duration(moment().diff(moment(channel.lastConnectionTime)));
      const durationText = `${Math.floor(disconnectionDuration.asHours())}h ${disconnectionDuration.minutes()}m`;
      
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
      to: recipients,
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
      `
    };

    try {
      await sgMail.send(message);
      console.log(`Correo de alerta de sensores desconectados enviado a: ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error al enviar correo de alerta de sensores desconectados:', error);
      if (error.response) {
        console.error('Datos de respuesta:', error.response.body);
      }
      return false;
    }
  }

  /**
   * Envía un correo de alerta de intrusión
   * @param {string} sector - Sector donde ocurrió la intrusión
   * @param {string} intruderInfo - Información del intruso (beacon/individuo)
   * @param {Date|string} timestamp - Hora de detección
   * @param {Array} [recipients=null] - Lista de destinatarios (opcional, usa la lista por defecto si no se proporciona)
   * @param {boolean} [highPriority=true] - Indicar si es alta prioridad para configurar encabezados
   * @returns {Promise<boolean>} true si el correo se envió exitosamente
   */
  async sendIntrusionAlertEmail(sector, intruderInfo, timestamp, recipients = null, highPriority = true) {
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }
    
    if (!sector) {
      console.error('Email Service - Error: Sector no especificado para alerta de intrusión.');
      return false;
    }
    
    // Verificar y obtener la lista de destinatarios
    const securityConfig = configLoader.getValue('security') || {};
    const securityRecipients = securityConfig.alertRecipients || [];
    
    // Priorizar los destinatarios directos, luego los de seguridad específicos, luego los generales
    const emailRecipients = recipients || securityRecipients.length ? securityRecipients : this.defaultRecipients;
    
    if (!emailRecipients || emailRecipients.length === 0) {
      console.error('Email Service - No hay destinatarios configurados para la alerta de intrusión.');
      return false;
    }
    
    const formattedTime = timestamp 
      ? moment(timestamp).tz(this.timeZone).format('DD/MM/YYYY HH:mm:ss')
      : moment().tz(this.timeZone).format('DD/MM/YYYY HH:mm:ss');
    
    // Obtener información del sistema para incluir en el correo
    const config = configLoader.getConfig();
    const companyName = config.companyName || 'The Next Security';
    const appName = config.appName || 'Sistema de Seguridad';
    
    // Agregar un ID de alerta único para seguimiento (timestamp + sector hasheado simplemente)
    const alertId = `ALERT-${Date.now()}-${sector.replace(/\s/g, '').substring(0, 8).toUpperCase()}`;
    
    const message = {
      to: emailRecipients,
      from: this.fromEmail,
      subject: `🚨 ALERTA DE SEGURIDAD: Intrusión Detectada en ${sector}`,
      text: `¡ALERTA DE SEGURIDAD! ID: ${alertId}
      
Se ha detectado una intrusión en el sector: ${sector}
Intruso/Individuo identificado: ${intruderInfo}
Fecha y hora de detección: ${formattedTime}

Esta alerta requiere atención inmediata.

Por favor no responda a este correo. Para responder a esta alerta, siga el protocolo de seguridad establecido.
${companyName} - ${appName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #FF0000; border-radius: 5px; background-color: #FFF0F0;">
          <h2 style="color: #FF0000; border-bottom: 1px solid #FF0000; padding-bottom: 10px;">🚨 ALERTA DE SEGURIDAD</h2>
          
          <p style="font-size: 16px; font-weight: bold;">Se ha detectado una intrusión en las instalaciones.</p>
          <p style="font-size: 12px; color: #666;">ID de Alerta: ${alertId}</p>
          
          <div style="background-color: #FFFFFF; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Sector:</strong> ${sector}</p>
            <p><strong>Intruso/Individuo:</strong> ${intruderInfo}</p>
            <p><strong>Fecha y hora:</strong> ${formattedTime}</p>
          </div>
          
          <p style="color: #FF0000; font-weight: bold; font-size: 16px;">Esta alerta requiere atención inmediata.</p>
          <p style="font-style: italic;">Esta notificación se genera automáticamente por el sistema de seguridad.</p>
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p>Por favor no responda a este correo. Para responder a esta alerta, siga el protocolo de seguridad establecido.</p>
            <p>${companyName} - ${appName}</p>
          </div>
        </div>
      `
    };
    
    // Si es de alta prioridad, agregar encabezados especiales
    if (highPriority) {
      message.headers = {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High'
      };
    }

    try {
      await sgMail.send(message);
      console.log(`Correo de alerta de intrusión enviado a: ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error al enviar correo de alerta de intrusión:', error);
      if (error.response) {
        console.error('Datos de respuesta:', error.response.body);
      }
      return false;
    }
  }

  /**
   * Envía un correo genérico con contenido personalizable
   * @param {string} subject - Asunto del correo
   * @param {string} content - Contenido/mensaje (puede ser HTML)
   * @param {Array|string} [recipients=null] - Lista de destinatarios o un solo destinatario (opcional, usa valores por defecto)
   * @param {boolean} [isHtml=false] - Indica si el contenido es HTML
   * @param {Object} [options={}] - Opciones adicionales para el correo
   * @param {boolean} [options.highPriority=false] - Si es de alta prioridad
   * @param {Object} [options.attachments=null] - Archivos adjuntos (formato SendGrid)
   * @param {string} [options.category=null] - Categoría para seguimiento
   * @returns {Promise<boolean>} true si el correo se envió exitosamente
   */
  async sendGenericEmail(subject, content, recipients = null, isHtml = false, options = {}) {
    if (!this.isConfigured() || !this.initialize()) {
      return false;
    }
    
    if (!subject || !content) {
      console.error('Email Service - Error: Asunto o contenido no proporcionados para correo genérico.');
      return false;
    }
    
    // Normalizar recipients a un array o usar los predeterminados
    const recipientList = recipients 
      ? (Array.isArray(recipients) ? recipients : [recipients]) 
      : this.defaultRecipients;
      
    if (!recipientList || recipientList.length === 0) {
      console.error('Email Service - No hay destinatarios configurados para el correo genérico.');
      return false;
    }
    
    // Desestructurar opciones
    const { highPriority = false, attachments = null, category = null } = options;
    
    // Obtener información del sistema para pie de página
    const config = configLoader.getConfig();
    const companyName = config.companyName || 'The Next Security';
    const appName = config.appName || 'Sistema de Monitoreo';
    
    // Crear el mensaje base
    const message = {
      to: recipientList,
      from: this.fromEmail,
      subject: subject
    };

    // Configurar el contenido según el formato
    if (isHtml) {
      // Si es HTML, agregar firma corporativa al final si no parece tener una
      if (!content.includes('</body>') && !content.includes('margin-top: 30px; padding-top: 15px; border-top:')) {
        const signature = `
          <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
            <p>Este es un mensaje automático del sistema de ${companyName}. Por favor no responda a este correo.</p>
            <p>${companyName} - ${appName}</p>
          </div>
        `;
        message.html = content + signature;
      } else {
        message.html = content;
      }
      
      // Crear versión texto plano
      message.text = content.replace(/<[^>]*>?/gm, ''); 
    } else {
      // Si es texto plano, agregar firma corporativa si no parece tener una
      if (!content.includes(companyName) && !content.includes('mensaje automático')) {
        const signature = `\n\n---\nEste es un mensaje automático del sistema de ${companyName}. Por favor no responda a este correo.\n${companyName} - ${appName}`;
        message.text = content + signature;
      } else {
        message.text = content;
      }
    }
    
    // Agregar categoría si se proporciona (para análisis de correos)
    if (category) {
      message.category = category;
    }
    
    // Agregar archivos adjuntos si se proporcionan
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      message.attachments = attachments;
    }
    
    // Si es de alta prioridad, agregar encabezados especiales
    if (highPriority) {
      message.headers = {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'High'
      };
    }

    try {
      await sgMail.send(message);
      console.log(`Email Service - Correo "${subject}" enviado a: ${recipientList.join(', ')}`);
      
      // Registrar el éxito en las métricas o log
      this.recordEmailSuccess(subject, recipientList.length);
      return true;
    } catch (error) {
      console.error('Email Service - Error al enviar correo:', error);
      if (error.response) {
        console.error('Datos de respuesta:', error.response.body);
      }
      
      // Registrar el error en las métricas o log
      this.recordEmailError(subject, error.message);
      return false;
    }
  }
  
  /**
   * Registra una operación exitosa de envío de correo (para métricas)
   * @param {string} subject - Asunto del correo
   * @param {number} recipientCount - Número de destinatarios
   * @private
   */
  recordEmailSuccess(subject, recipientCount) {
    // Implementación simple que podría expandirse para almacenar métricas en la base de datos
    console.log(`Email Service - Métricas: Correo "${subject}" enviado a ${recipientCount} destinatarios a las ${new Date().toLocaleTimeString()}`);
  }
  
  /**
   * Registra un error de envío de correo (para métricas)
   * @param {string} subject - Asunto del correo
   * @param {string} errorMessage - Mensaje de error
   * @private
   */
  recordEmailError(subject, errorMessage) {
    // Implementación simple que podría expandirse para almacenar errores en la base de datos
    console.error(`Email Service - Métricas: Error enviando "${subject}" - ${errorMessage}`);
  }
}

module.exports = new EmailService();
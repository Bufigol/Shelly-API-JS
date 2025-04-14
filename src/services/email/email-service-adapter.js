// src/services/email/email-service-adapter.js
const sgMail = require('@sendgrid/mail');
const config = require('../../config/js_files/config-loader');

/**
 * Adaptador para el servicio de correo electrónico
 * Proporciona una interfaz unificada para enviar correos utilizando SendGrid
 */
class EmailServiceAdapter {
    constructor() {
        this.config = null;
        this.initialized = false;
        this.initialize();
    }

    /**
     * Inicializa el adaptador de servicio de correo
     */
    initialize() {
        try {
            // Cargar configuración
            const appConfig = config.getConfig();

            // Asegurar que tenemos la configuración de email
            if (!appConfig.email || !appConfig.email.SENDGRID_API_KEY) {
                console.error("No se encontró configuración de email válida. Usando configuración de respaldo.");
                this.useBackupConfig();
                return;
            }

            // Verificar formato de la API key
            if (!appConfig.email.SENDGRID_API_KEY.startsWith('SG.')) {
                console.error("La API key de SendGrid no tiene el formato correcto. Usando configuración de respaldo.");
                this.useBackupConfig();
                return;
            }

            this.config = {
                apiKey: appConfig.email.SENDGRID_API_KEY,
                fromEmail: appConfig.email.email_contacto?.from_verificado || 'f.vasquez.tort@proton.me',
                defaultRecipients: appConfig.email.email_contacto?.destinatarios || ['felipev7450@gmail.com'],
                appName: appConfig.appName || 'Sistema de Monitoreo',
                companyName: appConfig.companyName || 'The Next Security'
            };

            // Inicializar SendGrid
            sgMail.setApiKey(this.config.apiKey);
            this.initialized = true;
            console.log('EmailServiceAdapter inicializado correctamente');
            console.log(`- API Key: ${this.config.apiKey.substring(0, 10)}...`);
            console.log(`- Remitente: ${this.config.fromEmail}`);
        } catch (error) {
            console.error('Error al inicializar EmailServiceAdapter:', error.message);
            this.useBackupConfig();
        }
    }

    /**
     * Usa una configuración de respaldo en caso de problemas
     * @private
     */
    useBackupConfig() {
        this.config = {
            apiKey: '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',
            fromEmail: 'f.vasquez.tort@proton.me',
            defaultRecipients: ['felipev7450@gmail.com', 'f.vasquez.tort@gmail.com'],
            appName: 'Sistema de Monitoreo',
            companyName: 'The Next Security'
        };

        try {
            sgMail.setApiKey(this.config.apiKey);
            this.initialized = true;
            console.log('EmailServiceAdapter inicializado con configuración de respaldo');
        } catch (error) {
            console.error('Error al inicializar con configuración de respaldo:', error.message);
            this.initialized = false;
        }
    }

    /**
     * Recarga la configuración de correo
     */
    reloadConfig() {
        try {
            const appConfig = config.reloadConfig();

            // Verificar si hay configuración de email válida
            if (!appConfig.email || !appConfig.email.SENDGRID_API_KEY || !appConfig.email.SENDGRID_API_KEY.startsWith('SG.')) {
                console.warn("Configuración de email inválida al recargar. Manteniendo configuración actual.");
                return;
            }

            this.config = {
                apiKey: appConfig.email.SENDGRID_API_KEY,
                fromEmail: appConfig.email.email_contacto?.from_verificado || 'f.vasquez.tort@proton.me',
                defaultRecipients: appConfig.email.email_contacto?.destinatarios || ['felipev7450@gmail.com'],
                appName: appConfig.appName || 'Sistema de Monitoreo',
                companyName: appConfig.companyName || 'The Next Security'
            };

            // Re-inicializar SendGrid con la nueva API key
            sgMail.setApiKey(this.config.apiKey);
            this.initialized = true;
            console.log('EmailServiceAdapter: Configuración recargada correctamente');
        } catch (error) {
            console.error('Error al recargar configuración de EmailServiceAdapter:', error.message);
        }
    }

    /**
     * Verifica si el servicio está configurado correctamente
     * @returns {boolean} - true si está configurado correctamente
     */
    isConfigured() {
        return this.initialized &&
            this.config &&
            this.config.apiKey &&
            this.config.apiKey.startsWith('SG.') &&
            this.config.fromEmail;
    }

    /**
     * Envía un correo electrónico
     * @param {Object} options - Opciones del correo
     * @param {string|string[]} options.to - Destinatario(s)
     * @param {string} options.subject - Asunto del correo
     * @param {string} options.text - Versión texto plano del correo
     * @param {string} [options.html] - Versión HTML del correo
     * @param {Object} [options.metadata] - Metadatos adicionales
     * @returns {Promise<boolean>} - true si el envío fue exitoso
     */
    async sendEmail(options) {
        if (!this.isConfigured()) {
            console.error('El servicio de correo no está configurado correctamente');
            return false;
        }

        if (!options.to || !options.subject) {
            console.error('Faltan parámetros requeridos para enviar el correo');
            return false;
        }

        // Asegurar que siempre hay un contenido de texto, incluso si solo se especifica HTML
        if (!options.text && options.html) {
            options.text = this.stripHtml(options.html);
        }

        // Asegurar que siempre hay contenido de texto, como mínimo un espacio
        if (!options.text) {
            options.text = ' '; // Un espacio para cumplir con el requisito de SendGrid
        }

        try {
            const message = {
                to: options.to,
                from: options.from || this.config.fromEmail,
                subject: options.subject,
                text: options.text,
            };

            // Solo incluir HTML si está presente
            if (options.html && options.html.trim() !== '') {
                message.html = options.html;
            }

            // Añadir metadatos si existen
            if (options.metadata) {
                message.categories = options.metadata.categories || [];
                message.customArgs = options.metadata.customArgs || {};

                if (options.metadata.highPriority) {
                    message.headers = {
                        Priority: 'high',
                        'X-Priority': '1',
                        ...message.headers
                    };
                }
            }

            // Enviar el correo
            const response = await sgMail.send(message);
            console.log(`Correo enviado exitosamente a: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
            return true;
        } catch (error) {
            console.error('Error al enviar correo:', error.message);
            if (error.response) {
                console.error('Detalles de la respuesta:', error.response.body);
            }
            return false;
        }
    }

    /**
     * Envía un correo genérico
     * @param {string} subject - Asunto del correo
     * @param {string} content - Contenido del correo
     * @param {string|string[]} recipients - Destinatario(s)
     * @param {boolean} [isHtml=false] - Si el contenido es HTML
     * @param {Object} [metadata={}] - Metadatos adicionales
     * @returns {Promise<boolean>} - true si el envío fue exitoso
     */
    async sendGenericEmail(subject, content, recipients, isHtml = false, metadata = {}) {
        const to = recipients || this.config.defaultRecipients;

        // Asegurar que el contenido es una cadena no vacía
        if (!content || typeof content !== 'string' || content.trim() === '') {
            content = 'Este es un correo de prueba.';
        }

        const options = {
            to,
            subject,
            metadata
        };

        if (isHtml) {
            options.html = content;
            options.text = this.stripHtml(content);
        } else {
            options.text = content;
        }

        return await this.sendEmail(options);
    }

    /**
     * Envía un correo para restablecimiento de contraseña
     * @param {string} email - Correo del usuario
     * @param {string} resetToken - Token de restablecimiento
     * @param {string} resetUrl - URL para restablecer la contraseña
     * @returns {Promise<boolean>} - true si el envío fue exitoso
     */
    async sendPasswordResetEmail(email, resetToken, resetUrl) {
        if (!email || !resetUrl) {
            console.error('Correo o URL de restablecimiento no proporcionados');
            return false;
        }

        const subject = `${this.config.appName} - Restablecimiento de Contraseña`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Restablecimiento de Contraseña</h2>
        <p>Se ha solicitado un restablecimiento de contraseña para tu cuenta en <strong>${this.config.appName}</strong>.</p>
        <p>Para continuar con el proceso, haz clic en el siguiente enlace:</p>
        <p style="margin: 20px 0;">
          <a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Restablecer Contraseña
          </a>
        </p>
        <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
        <p>Este enlace expirará en 1 hora por seguridad.</p>
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
          <p>Este es un mensaje automático del sistema de ${this.config.companyName}. Por favor no responda a este correo.</p>
        </div>
      </div>
    `;

        return await this.sendEmail({
            to: email,
            subject,
            html,
            text: this.stripHtml(html),
            metadata: {
                categories: ['password-reset'],
                highPriority: true
            }
        });
    }

    /**
     * Envía un correo de confirmación de restablecimiento de contraseña
     * @param {string} email - Correo del usuario
     * @returns {Promise<boolean>} - true si el envío fue exitoso
     */
    async sendPasswordResetConfirmationEmail(email) {
        if (!email) {
            console.error('Correo no proporcionado');
            return false;
        }

        const subject = `${this.config.appName} - Contraseña restablecida con éxito`;
        const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
        <h2 style="color: #333; border-bottom: 1px solid #e1e1e1; padding-bottom: 10px;">Contraseña Restablecida</h2>
        <p>Tu contraseña ha sido restablecida exitosamente.</p>
        <p>Si tú no realizaste este cambio, contacta a soporte inmediatamente.</p>
        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #e1e1e1; font-size: 12px; color: #777;">
          <p>Este es un mensaje automático del sistema de ${this.config.companyName}. Por favor no responda a este correo.</p>
        </div>
      </div>
    `;

        return await this.sendEmail({
            to: email,
            subject,
            html,
            text: this.stripHtml(html),
            metadata: {
                categories: ['password-reset-confirmation']
            }
        });
    }

    /**
     * Envía una alerta de temperatura
     * @param {Array} outOfRangeChannels - Canales fuera de rango
     * @param {string|string[]} [recipients] - Destinatarios personalizados
     * @returns {Promise<boolean>} - true si el envío fue exitoso
     */
    async sendTemperatureAlert(outOfRangeChannels, recipients = null) {
        if (!outOfRangeChannels || outOfRangeChannels.length === 0) {
            console.log('No hay canales fuera de rango para reportar');
            return false;
        }

        const to = recipients || this.config.defaultRecipients;
        const formattedTime = new Date().toLocaleString();
        let htmlRows = '';

        outOfRangeChannels.forEach(channel => {
            const status = channel.temperature < channel.minThreshold ? 'Por debajo' : 'Por encima';
            const statusColor = channel.temperature < channel.minThreshold ? '#0000FF' : '#FF0000';
            const readTime = new Date(channel.timestamp).toLocaleString();

            htmlRows += `
        <tr>
          // src/services/email/email-service-adapter.js (continuación)
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.temperature}°C</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: ${statusColor}; font-weight: bold;">${status}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.minThreshold}°C - ${channel.maxThreshold}°C</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${readTime}</td>
        </tr>
      `;
        });

        const subject = `Alerta de Temperatura - ${outOfRangeChannels.length} canales fuera de rango`;
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
          <tbody>
            ${htmlRows}
          </tbody>
        </table>
        
        <p style="margin-top: 20px; font-style: italic;">Esta alerta se genera automáticamente. Por favor, tome las medidas necesarias.</p>
      </div>
    `;

        // Crear versión texto
        let text = `ALERTA DE TEMPERATURA - ${outOfRangeChannels.length} CANALES FUERA DE RANGO\n\n`;
        text += `Fecha y hora: ${formattedTime}\n\n`;

        outOfRangeChannels.forEach(channel => {
            const status = channel.temperature < channel.minThreshold ? 'Por debajo' : 'Por encima';
            const readTime = new Date(channel.timestamp).toLocaleString();
            text += `- ${channel.name}: ${channel.temperature}°C (${status} del rango ${channel.minThreshold}°C - ${channel.maxThreshold}°C). Leído a las ${readTime}\n`;
        });

        text += '\nEsta alerta se genera automáticamente. Por favor, tome las medidas necesarias.';

        return await this.sendEmail({
            to,
            subject,
            html,
            text,
            metadata: {
                categories: ['temperatura', 'alerta'],
                highPriority: true
            }
        });
    }

    /**
     * Envía una alerta de sensores desconectados
     * @param {Array} disconnectedChannels - Canales desconectados
     * @param {string|string[]} [recipients] - Destinatarios personalizados
     * @returns {Promise<boolean>} - true si el envío fue exitoso
     */
    async sendDisconnectionAlert(disconnectedChannels, recipients = null) {
        if (!disconnectedChannels || disconnectedChannels.length === 0) {
            console.log('No hay canales desconectados para reportar');
            return false;
        }

        const to = recipients || this.config.defaultRecipients;
        const formattedTime = new Date().toLocaleString();
        let htmlRows = '';

        disconnectedChannels.forEach(channel => {
            const lastConnectionTime = new Date(channel.lastConnectionTime).toLocaleString();
            const disconnectionDuration = this.calculateDuration(channel.lastConnectionTime);

            htmlRows += `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${lastConnectionTime}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${disconnectionDuration}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${channel.disconnectionInterval} minutos</td>
        </tr>
      `;
        });

        const subject = `Alerta de Sensores Desconectados - ${disconnectedChannels.length} dispositivos sin conexión`;
        const html = `
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
    `;

        // Crear versión texto
        let text = `ALERTA DE SENSORES DESCONECTADOS - ${disconnectedChannels.length} DISPOSITIVOS SIN CONEXIÓN\n\n`;
        text += `Fecha y hora: ${formattedTime}\n\n`;

        disconnectedChannels.forEach(channel => {
            const lastConnectionTime = new Date(channel.lastConnectionTime).toLocaleString();
            const disconnectionDuration = this.calculateDuration(channel.lastConnectionTime);
            text += `- ${channel.name}: Sin conexión desde ${lastConnectionTime} (${disconnectionDuration}). Límite: ${channel.disconnectionInterval} minutos\n`;
        });

        text += '\nSe requiere atención inmediata para restablecer la conexión de estos sensores.\n';
        text += 'Esta alerta se genera automáticamente y se envía independientemente del horario laboral.';

        return await this.sendEmail({
            to,
            subject,
            html,
            text,
            metadata: {
                categories: ['desconexion', 'alerta'],
                highPriority: true
            }
        });
    }

    /**
     * Utilidad para quitar etiquetas HTML de un texto
     * @param {string} html - Texto HTML a convertir
     * @returns {string} - Texto plano
     */
    stripHtml(html) {
        if (!html || typeof html !== 'string') {
            return 'Contenido del correo';
        }

        // Implementación simple para quitar etiquetas HTML
        return html
            .replace(/<[^>]*>?/gm, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim() || 'Contenido del correo';
    }

    /**
     * Calcula la duración entre un momento pasado y el presente
     * @param {string|Date} startTime - Momento de inicio
     * @returns {string} - Duración formateada
     */
    calculateDuration(startTime) {
        const start = new Date(startTime);
        const now = new Date();
        const diffMs = now - start;

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m`;
    }
}

module.exports = new EmailServiceAdapter();
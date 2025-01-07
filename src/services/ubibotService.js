// src/services/ubibot-service.js

const mysql = require('mysql2/promise');
const config = require('../config/config-loader');
const { convertToMySQLDateTime, isDifferenceGreaterThan } = require('../utils/transformUtils');
const sgMailConfig = require('../config/sgMailConfig.json');
const twilioConfig = require('../config/twilio.json');
const moment = require('moment-timezone');
const twilio = require('twilio');
const axios = require('axios');


// Configuración de SendGrid
const SENDGRID_API_KEY = sgMailConfig.SENDGRID_API_KEY;

// Configuración de Twilio
const twilioClient = new twilio(twilioConfig.accountSid, twilioConfig.authToken);

const INTERVALO_SIN_CONEXION_SENSOR = 95;

const pool = mysql.createPool({
    host: config.getConfig().database.host,
    user: config.getConfig().database.username,
    password: config.getConfig().database.password,
    database: config.getConfig().database.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

class UbibotService {
    /**
     * Procesa los datos de un canal de Ubibot.
     * Si el canal no existe en la base de datos, lo crea.
     * Si el canal ya existe, verifica si ha habido cambios en la información
     * básica del canal (como la latitud o la fecha de creación), y en caso
     * de que sí, actualiza la información del canal en la base de datos.
     * @param {Object} channelData Información del canal de Ubibot
     * @returns {Promise<void>}
     */
     async processChannelData(channelData) {
        const connection = await pool.getConnection();
        try {
          const [existingChannel] = await connection.query(
            'SELECT * FROM channels_ubibot WHERE channel_id = ?',
            [channelData.channel_id]
          );
      
          const basicInfo = {
            product_id: channelData.product_id,
            device_id: channelData.device_id,
            latitude: channelData.latitude,
            longitude: channelData.longitude,
            firmware: channelData.firmware,
            mac_address: channelData.mac_address,
            last_entry_date: new Date(channelData.last_entry_date),
            created_at: new Date(channelData.created_at)
          };
      
          if (existingChannel.length === 0) {
            await connection.query(
              'INSERT INTO channels_ubibot SET ?',
              { ...basicInfo, channel_id: channelData.channel_id, name: channelData.name }
            );
          } else {
            const currentChannel = existingChannel[0];
            const hasChanges = Object.keys(basicInfo).some(key => 
              basicInfo[key] instanceof Date 
                ? basicInfo[key].getTime() !== new Date(currentChannel[key]).getTime()
                : basicInfo[key] !== currentChannel[key]
            );
      
            if (hasChanges) {
              await connection.query(
                'UPDATE channels_ubibot SET ? WHERE channel_id = ?',
                [basicInfo, channelData.channel_id]
              );
            }
          }
        } finally {
          connection.release();
        }
    }
    /**
     * Convierte una fecha/hora UTC a una fecha/hora en la zona horaria de
     * Santiago de Chile.
     * @param {Date|String|Number} utcTime Fecha/hora en formato UTC
     * @returns {moment} Fecha/hora en la zona horaria de Santiago de Chile
     */
    getSantiagoTime(utcTime) {
        return moment.utc(utcTime).tz("America/Santiago");
    }


    /**
     * Processes the sensor readings from a Ubibot channel and inserts them into the database.
     * Converts the timestamp from UTC to the Santiago timezone and logs the timestamp information.
     * If sensor readings are not present or the timestamp is missing, logs an error and returns.
     * After data insertion, checks parameters and sends notifications if necessary.
     *
     * @param {number} channelId - The ID of the Ubibot channel.
     * @param {Object} lastValues - The latest sensor readings, including fields for temperature, humidity, light, etc.
     * @returns {Promise<void>}
     */

    async processSensorReadings(channelId, lastValues) {
       const connection = await pool.getConnection();
       try {
            if(!lastValues || !lastValues.field1 || !lastValues.field1.created_at){
                console.error(`Ubibot: No se encontraron valores o timestamp para el canal ${channelId}`);
                return;
            }

          const utcTimestamp = moment.utc(lastValues.field1.created_at);
          const santiagoTime = this.getSantiagoTime(utcTimestamp);
          
          console.log('UTC Timestamp:', utcTimestamp.format());
          console.log('Santiago Time:', santiagoTime.format());
    
          await connection.query(
            'INSERT INTO sensor_readings_ubibot (channel_id, timestamp, temperature, humidity, light, voltage, wifi_rssi, external_temperature,external_temperature_timestamp, insercion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              channelId,
              utcTimestamp.toDate(),
              lastValues.field1.value,
              lastValues.field2.value,
              lastValues.field3.value,
              lastValues.field4.value,
              lastValues.field5.value,
              lastValues.field8 ? lastValues.field8.value : null,
              convertToMySQLDateTime(lastValues.field8.created_at),
              santiagoTime.format('YYYY-MM-DD HH:mm:ss')
            ]
          );
    
          console.log('Inserted data:', {
            channel_id: channelId,
            timestamp: utcTimestamp.toDate(),
            insercion: santiagoTime.format('YYYY-MM-DD HH:mm:ss')
          });
    
          // Verificar parámetros después de la inserción
           await this.checkParametersAndNotify(channelId, lastValues);
        } finally {
          connection.release();
        }
    }

    
    /**
     * Verifica los parámetros del canal especificado y envía notificaciones
     * si la temperatura se encuentra fuera del rango permitido.
     * 
     * @param {number} channelId - El ID del canal Ubibot.
     * @param {Object} lastValues - Los valores más recientes del sensor, incluyendo la temperatura, humedad, luz, etc.
     * @returns {Promise<void>}
     */
    async checkParametersAndNotify(channelId, lastValues) {
      let connection;
        try {
            connection = await pool.getConnection();
        
            // Obtener la información del canal, incluyendo si está operativo y su grupo
            const [channelInfo] = await connection.query(
                'SELECT c.name, c.esOperativa, p.minimo AS minima_temp_camara, p.maximo AS maxima_temp_camara ' +
                'FROM channels_ubibot c ' +
                'JOIN parametrizaciones p ON c.id_parametrizacion = p.param_id ' +
                'WHERE c.channel_id = ?', 
                [channelId]
              );

            if (channelInfo.length === 0 || !channelInfo[0].esOperativa) {
              console.log(`Ubibot: Canal ${channelId} no encontrado o no operativo. Abortando la verificación.`);
              return;
            }
        
            const { name: channelName, minima_temp_camara, maxima_temp_camara } = channelInfo[0];
            const temperature = lastValues.field8 ? parseFloat(lastValues.field8.value) : null;
            
            if (temperature === null) {
              console.log(`Ubibot: No se pudo obtener la temperatura para el canal ${channelId}. Abortando la verificación.`);
              return;
            }
        
            console.log(`Ubibot: Verificando temperatura para el canal ${channelId} (${channelName}): ${temperature.toFixed(2)}°C`);
            console.log(`Ubibot: Rango permitido: ${minima_temp_camara}°C a ${maxima_temp_camara}°C`);
        
            if (temperature < minima_temp_camara || temperature > maxima_temp_camara) {
              console.log(`Ubibot: Temperatura fuera de rango. Enviando alerta.`);
              
              const timestamp = moment(lastValues.field1.created_at).format('YYYY-MM-DD HH:mm:ss');
              
              // Enviar notificaciones
              await this.sendEmail(channelName, temperature, timestamp, minima_temp_camara, maxima_temp_camara);
              await this.sendSMS(channelName, temperature, timestamp, minima_temp_camara, maxima_temp_camara);
        
              console.log(`Ubibot: Alertas enviadas para el canal ${channelName}`);
            } else {
              console.log(`Ubibot: Temperatura dentro del rango permitido. No se requiere alerta.`);
            }
           
            const utcTimestamp = moment.utc(lastValues.field1.created_at);
            if(isDifferenceGreaterThan(utcTimestamp.toDate(),convertToMySQLDateTime(lastValues.field8.created_at),INTERVALO_SIN_CONEXION_SENSOR)){
               //await sendEmaillSensorSinConexion(channelName,convertToMySQLDateTime(lastValues.field8.created_at));
            }
        
        
          } catch (error) {
            console.error('Ubibot: Error en checkParametersAndNotify:', error);
          } finally {
            if (connection) connection.release();
        }
    }

    
    /**
     * Envía un correo electrónico a los destinatarios configurados cuando un sensor
     * de temperatura externa está desconectado por más de un intervalo determinado.
     * @param {string} channelName - Nombre del canal
     * @param {string} hora - Hora en que se detectó la desconexión
     */
    async sendEmaillSensorSinConexion(channelName, hora) {
        const FROM_EMAIL = sgMailConfig.email_contacto.from_verificado;
      
        const data = {
          personalizations: [{ to: [{ email: FROM_EMAIL }] }], // Cambiado a un array de objetos
          from: { email: FROM_EMAIL },
          subject: `Alerta de Sensor Desconectado para ${channelName}`,
          content: [{ 
            type: 'text/plain', 
            value: `El sensor de temperatura externa de ${channelName} está desconectado desde ${hora}.
                    Límites de desconexion configurado: ${INTERVALO_SIN_CONEXION_SENSOR} minutos`
          }]
        };
      
        try {
          console.log('Intentando enviar email con la siguiente configuración:');
          console.log('API Key:', SENDGRID_API_KEY.substring(0, 10) + '...');
          console.log('Destinatario:', FROM_EMAIL);
          console.log('Remitente:', FROM_EMAIL);
      
          const response = await axios.post('https://api.sendgrid.com/v3/mail/send', data, {
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
      
          console.log('Respuesta de SendGrid:', response.status, response.statusText);
          console.log('Email enviado exitosamente');
          return true;
        } catch (error) {
          console.error('Error al enviar el email:');
          if (error.response) {
            console.error('Datos de respuesta:', error.response.data);
            console.error('Estado de respuesta:', error.response.status);
            console.error('Cabeceras de respuesta:', error.response.headers);
          } else if (error.request) {
            console.error('No se recibió respuesta. Detalles de la solicitud:', error.request);
          } else {
            console.error('Error al configurar la solicitud:', error.message);
          }
          console.error('Configuración completa del error:', error.config);
          return false;
        }
    }


    
    /**
     * Envía un correo electrónico a los destinatarios configurados cuando un sensor
     * de temperatura externa está fuera de los límites establecidos.
     * @param {string} channelName - Nombre del canal
     * @param {number} temperature - Temperatura medida en el sensor
     * @param {string} timestamp - Marca de tiempo en que se detectó la temperatura
     * @param {number} minima_temp_camara - Límite mínimo de temperatura permitido
     * @param {number} maxima_temp_camara - Límite máximo de temperatura permitido
     * @returns {Promise<boolean>} Verdadero si el email se envió exitosamente, falso en caso contrario
     */
    async sendEmail(channelName, temperature, timestamp, minima_temp_camara, maxima_temp_camara) {
        const FROM_EMAIL = sgMailConfig.email_contacto.from_verificado;
        const TO_EMAILS = sgMailConfig.email_contacto.destinatarios;
      
        const data = {
          personalizations: [{ to: TO_EMAILS.map(email => ({ email })) }],
          from: { email: FROM_EMAIL },
          subject: `Alerta de temperatura para ${channelName}`,
          content: [{ 
            type: 'text/plain', 
            value: `La temperatura en ${channelName} está fuera de los límites establecidos.
                    Temperatura: ${temperature}°C
                    Timestamp: ${timestamp}
                    Límites permitidos: ${minima_temp_camara}°C / ${maxima_temp_camara}°C`
          }]
        };
      
        try {
          console.log('Intentando enviar email con la siguiente configuración:');
          console.log('API Key:', SENDGRID_API_KEY.substring(0, 10) + '...');
          console.log('Destinatarios:', TO_EMAILS);
          console.log('Remitente:', FROM_EMAIL);
      
          const response = await axios.post('https://api.sendgrid.com/v3/mail/send', data, {
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json'
            }
          });
      
          console.log('Respuesta de SendGrid:', response.status, response.statusText);
          console.log('Email enviado exitosamente');
          return true;
        } catch (error) {
          console.error('Error al enviar el email:');
          if (error.response) {
            console.error('Datos de respuesta:', error.response.data);
            console.error('Estado de respuesta:', error.response.status);
            console.error('Cabeceras de respuesta:', error.response.headers);
          } else if (error.request) {
            console.error('No se recibió respuesta. Detalles de la solicitud:', error.request);
          } else {
            console.error('Error al configurar la solicitud:', error.message);
          }
          console.error('Configuración completa del error:', error.config);
          return false;
        }
    }
    /**
     * Envía un SMS de alerta a los destinatarios configurados cuando la temperatura en un canal
     * supera los límites establecidos.
     * @param {string} channelName - Nombre del canal
     * @param {number} temperature - Temperatura actual
     * @param {string} timestamp - Timestamp de la lectura
     * @param {number} minima_temp_camara - Límite inferior de temperatura permitido
     * @param {number} maxima_temp_camara - Límite superior de temperatura permitido
     */
    async sendSMS(channelName, temperature, timestamp, minima_temp_camara, maxima_temp_camara) {
        const message = `Alerta: La temperatura en ${channelName} está fuera de los límites. 
                         Temperatura: ${temperature}°C 
                         Timestamp: ${timestamp} 
                         Límites permitidos: ${minima_temp_camara}°C - ${maxima_temp_camara}°C`;
      
        const destinatarios = twilioConfig.destinatarios;
      
        console.log('Destinatarios SMS:', destinatarios);
      
        for (const destinatario of destinatarios) {
          try {
            const result = await twilioClient.messages.create({
              body: message,
              from: twilioConfig.phoneNumber,
              to: destinatario
            });
            console.log(`SMS de alerta enviado a ${destinatario}. SID: ${result.sid}`);
          } catch (error) {
            console.error(`Error al enviar SMS de alerta a ${destinatario}:`, error.message);
            if (error.code) {
              console.error('Código de error Twilio:', error.code);
            }
          }
        }
    }
}

module.exports = new UbibotService();
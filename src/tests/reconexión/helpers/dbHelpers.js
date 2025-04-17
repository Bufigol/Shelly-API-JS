// src/tests/test_notificaciones/helpers/dbHelpers.js
const moment = require('moment-timezone');

/**
 * Restaura el estado de los canales de prueba en la base de datos
 */
async function resetDatabaseState() {
    if (!global.testDB) {
        throw new Error('Conexión de base de datos para tests no inicializada');
    }

    try {
        // Restaurar canales de prueba a su estado inicial
        await global.testDB.query(`
      UPDATE channels_ubibot 
      SET is_currently_out_of_range = 0, 
          out_of_range_since = NULL, 
          last_alert_sent = NULL 
      WHERE channel_id IN ('9999', '694209')
    `);

        console.log("🔄 Estado de canales de prueba restaurado en base de datos");
    } catch (error) {
        console.error(`❌ Error restaurando estado de BD: ${error.message}`);
        throw error;
    }
}

/**
 * Actualiza el estado de un canal para simular un evento
 * @param {string} channelId - ID del canal a actualizar
 * @param {boolean} isOutOfRange - Si está fuera de alcance (1) o no (0)
 * @param {Date|null} outOfRangeSince - Timestamp desde cuando está fuera de alcance (o null)
 * @param {Date|null} lastAlertSent - Timestamp de la última alerta enviada (o null)
 */
async function updateChannelState(channelId, isOutOfRange, outOfRangeSince = null, lastAlertSent = null) {
    if (!global.testDB) {
        throw new Error('Conexión de base de datos para tests no inicializada');
    }

    try {
        // Formatear fechas para MySQL si existen
        const formattedOutOfRangeSince = outOfRangeSince ?
            moment(outOfRangeSince).format('YYYY-MM-DD HH:mm:ss') : null;

        const formattedLastAlertSent = lastAlertSent ?
            moment(lastAlertSent).format('YYYY-MM-DD HH:mm:ss') : null;

        await global.testDB.query(`
      UPDATE channels_ubibot 
      SET is_currently_out_of_range = ?, 
          out_of_range_since = ?, 
          last_alert_sent = ? 
      WHERE channel_id = ?
    `, [isOutOfRange ? 1 : 0, formattedOutOfRangeSince, formattedLastAlertSent, channelId]);

        console.log(`📝 Estado del canal ${channelId} actualizado: outOfRange=${isOutOfRange}, outOfRangeSince=${formattedOutOfRangeSince}, lastAlertSent=${formattedLastAlertSent}`);
    } catch (error) {
        console.error(`❌ Error actualizando estado del canal ${channelId}: ${error.message}`);
        throw error;
    }
}

/**
 * Verifica el estado actual de un canal en la base de datos
 * @param {string} channelId - ID del canal a verificar
 * @returns {Promise<Object>} Información del canal
 */
async function getChannelState(channelId) {
    if (!global.testDB) {
        throw new Error('Conexión de base de datos para tests no inicializada');
    }

    try {
        const [rows] = await global.testDB.query(
            `SELECT * FROM channels_ubibot WHERE channel_id = ?`,
            [channelId]
        );

        if (rows.length === 0) {
            throw new Error(`Canal ${channelId} no encontrado en la base de datos`);
        }

        return rows[0];
    } catch (error) {
        console.error(`❌ Error obteniendo estado del canal ${channelId}: ${error.message}`);
        throw error;
    }
}

/**
 * Obtiene los parámetros de temperatura para un canal
 * @param {string} channelId - ID del canal
 * @returns {Promise<{minThreshold: number, maxThreshold: number}>} Umbrales de temperatura
 */
async function getTemperatureThresholds(channelId) {
    if (!global.testDB) {
        throw new Error('Conexión de base de datos para tests no inicializada');
    }

    try {
        const [rows] = await global.testDB.query(`
      SELECT p.minimo, p.maximo 
      FROM channels_ubibot c
      JOIN parametrizaciones p ON c.id_parametrizacion = p.param_id
      WHERE c.channel_id = ?
    `, [channelId]);

        if (rows.length === 0) {
            throw new Error(`No se encontraron parámetros de temperatura para el canal ${channelId}`);
        }

        return {
            minThreshold: parseFloat(rows[0].minimo),
            maxThreshold: parseFloat(rows[0].maximo)
        };
    } catch (error) {
        console.error(`❌ Error obteniendo umbrales de temperatura para canal ${channelId}: ${error.message}`);
        throw error;
    }
}

module.exports = {
    resetDatabaseState,
    updateChannelState,
    getChannelState,
    getTemperatureThresholds
};
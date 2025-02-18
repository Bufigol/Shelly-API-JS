// src/controllers/onPremiseController.js
const onPremiseService = require('../services/onPremiseService');

class OnPremiseController {
    /**
     * Obtiene los canales activos y sus datos asociados
     */
    async getChannels() {
        try {
            return await onPremiseService.getActiveChannels();
        } catch (error) {
            console.error('Error getting channels:', error);
            throw error;
        }
    }

    /**
     * Obtiene datos de un canal específico
     */
    async getChannelData(channelId) {
        try {
            const channels = await this.getChannels();
            const channel = channels.find(ch => ch.chanel_id === channelId);
            
            if (!channel) {
                throw new Error(`Channel ${channelId} not found`);
            }

            return await onPremiseService.fetchChannelData(channelId, channel.apikey);
        } catch (error) {
            console.error(`Error getting channel ${channelId} data:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta la sincronización de las bases de datos
     */
    async syncDatabases() {
        try {
            return await onPremiseService.syncDatabases();
        } catch (error) {
            console.error('Error syncing databases:', error);
            throw error;
        }
    }
}

module.exports = new OnPremiseController();
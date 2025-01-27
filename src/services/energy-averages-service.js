// energy-averages-service.js
const databaseService = require('./database-service');

class EnergyAveragesService {
    constructor() {
        this.initialized = false;
    }

    async getHourlyAverages(startTime, endTime) {
        if (!this.initialized) await this.initialize();
        
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT * FROM promedios_energia_hora
                WHERE fecha_hora BETWEEN ? AND ?
                ORDER BY fecha_hora DESC
            `, [startTime, endTime]);
            
            return rows;
        } catch (error) {
            console.error('Error fetching hourly averages:', error);
            throw error;
        }
    }

    async getDailyAverages(startDate, endDate) {
        if (!this.initialized) await this.initialize();
        
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT * FROM promedios_energia_dia
                WHERE fecha BETWEEN ? AND ?
                ORDER BY fecha DESC
            `, [startDate, endDate]);
            
            return rows;
        } catch (error) {
            console.error('Error fetching daily averages:', error);
            throw error;
        }
    }

    async getMonthlyAverages(startMonth, endMonth) {
        if (!this.initialized) await this.initialize();
        
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT * FROM promedios_energia_mes
                WHERE fecha_mes BETWEEN ? AND ?
                ORDER BY fecha_mes DESC
            `, [startMonth, endMonth]);
            
            return rows;
        } catch (error) {
            console.error('Error fetching monthly averages:', error);
            throw error;
        }
    }

    async getLatestExecutionStatus() {
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT *
                FROM event_execution_log
                WHERE event_name = 'calcular_promedios_y_totales_consumo_electrico'
                ORDER BY execution_start DESC
                LIMIT 1
            `);
            
            return rows[0] || null;
        } catch (error) {
            console.error('Error fetching execution status:', error);
            throw error;
        }
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await databaseService.testConnection();
            this.initialized = true;
            console.log('✅ Energy averages service initialized');
        } catch (error) {
            console.error('Error initializing energy averages service:', error);
            throw error;
        }
    }

    async stop() {
        this.initialized = false;
        console.log('Energy averages service stopped');
    }
}

// total-energy-service.js


module.exports = new EnergyAveragesService();   
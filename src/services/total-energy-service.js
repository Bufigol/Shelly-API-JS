const databaseService = require('./database-service');

class TotalEnergyService {
    constructor() {
        this.initialized = false;
    }

    async getHourlyTotals(startTime, endTime) {
        if (!this.initialized) await this.initialize();
        
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT * FROM totales_energia_hora
                WHERE fecha_hora BETWEEN ? AND ?
                ORDER BY fecha_hora DESC
            `, [startTime, endTime]);
            
            return rows;
        } catch (error) {
            console.error('Error fetching hourly totals:', error);
            throw error;
        }
    }

    async getDailyTotals(startDate, endDate) {
        if (!this.initialized) await this.initialize();
        
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT * FROM totales_energia_dia
                WHERE fecha BETWEEN ? AND ?
                ORDER BY fecha DESC
            `, [startDate, endDate]);
            
            return rows;
        } catch (error) {
            console.error('Error fetching daily totals:', error);
            throw error;
        }
    }

    async getMonthlyTotals(startMonth, endMonth) {
        if (!this.initialized) await this.initialize();
        
        try {
            const [rows] = await databaseService.pool.query(`
                SELECT * FROM totales_energia_mes
                WHERE anio = YEAR(?) AND mes BETWEEN MONTH(?) AND MONTH(?)
                ORDER BY anio DESC, mes DESC
            `, [startMonth, startMonth, endMonth]);
            
            return rows;
        } catch (error) {
            console.error('Error fetching monthly totals:', error);
            throw error;
        }
    }

    async getLatestAggregations() {
        if (!this.initialized) await this.initialize();
        
        try {
            const [hourly] = await databaseService.pool.query(`
                SELECT * FROM totales_energia_hora 
                ORDER BY fecha_hora DESC LIMIT 1
            `);
            
            const [daily] = await databaseService.pool.query(`
                SELECT * FROM totales_energia_dia
                ORDER BY fecha DESC LIMIT 1
            `);
            
            const [monthly] = await databaseService.pool.query(`
                SELECT * FROM totales_energia_mes
                ORDER BY anio DESC, mes DESC LIMIT 1
            `);
            
            return {
                hourly: hourly[0] || null,
                daily: daily[0] || null,
                monthly: monthly[0] || null
            };
        } catch (error) {
            console.error('Error fetching latest aggregations:', error);
            throw error;
        }
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await databaseService.testConnection();
            this.initialized = true;
            console.log('✅ Total energy service initialized');
        } catch (error) {
            console.error('Error initializing total energy service:', error);
            throw error;
        }
    }

    async stop() {
        this.initialized = false;
        console.log('Total energy service stopped');
    }
}

module.exports = new TotalEnergyService();
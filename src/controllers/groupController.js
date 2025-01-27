const databaseService = require('../services/database-service');
const { NotFoundError, ValidationError } = require('../utils/errors');

class GroupController {
    async getGroupAverages(req, res, next) {
        try {
            const { groupId } = req.params;
            const { start, end, period } = req.validatedDates;
            
            const averages = await databaseService.getGroupAverages(
                groupId,
                start,
                end,
                period
            );
            
            res.json({ data: averages, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async getGroupTotals(req, res, next) {
        try {
            const { groupId } = req.params;
            const { start, end, period } = req.validatedDates;
            
            const totals = await databaseService.getGroupTotals(
                groupId,
                start,
                end,
                period
            );
            
            res.json({ data: totals, timestamp: new Date() });
        } catch (error) {
            next(error);
        }
    }

    async createGroup(req, res, next) {
        try {
            const result = await databaseService.createGroup(req.body);
            res.status(201).json({ 
                data: result, 
                message: 'Grupo creado exitosamente',
                timestamp: new Date() 
            });
        } catch (error) {
            next(error);
        }
    }

    async updateGroup(req, res, next) {
        try {
            const { groupId } = req.params;
            const result = await databaseService.updateGroup(groupId, req.body);
            
            if (!result) {
                throw new NotFoundError('Grupo no encontrado', groupId);
            }
            
            res.json({ 
                data: result, 
                message: 'Grupo actualizado exitosamente',
                timestamp: new Date() 
            });
        } catch (error) {
            next(error);
        }
    }

    async deleteGroup(req, res, next) {
        try {
            const { groupId } = req.params;
            const result = await databaseService.deleteGroup(groupId);
            
            if (!result) {
                throw new NotFoundError('Grupo no encontrado', groupId);
            }
            
            res.json({ 
                message: 'Grupo eliminado exitosamente',
                timestamp: new Date() 
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new GroupController();
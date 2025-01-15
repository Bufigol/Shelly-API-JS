// controllers/sem_configController.js
const databaseService = require('../services/database-service');
const { ValidationError } = require('../utils/errors');

class sem_ConfigController {
    async getSystemParameters(req, res, next) {
        try {
            const query = `
                SELECT tp.nombre, tp.tipo_dato, c.valor, tp.reglas_validacion
                FROM sem_configuracion c
                JOIN sem_tipos_parametros tp ON c.tipo_parametro_id = tp.id
                WHERE tp.nombre IN (
                    'PRECIO_KWH', 
                    'DIAS_RETENCION', 
                    'FACTOR_POTENCIA_MIN', 
                    'MAX_DESVIACION_VOLTAJE', 
                    'VOLTAJE_NOMINAL'
                )
                AND c.activo = 1
                ORDER BY tp.nombre`;

            const [rows] = await databaseService.pool.query(query);

            // Transformar los valores según el tipo de dato
            const parameters = rows.map(row => ({
                name: row.nombre,
                value: this.parseConfigValue(row.valor, row.tipo_dato),
                dataType: row.tipo_dato,
                validation: JSON.parse(row.reglas_validacion || '{}')
            }));

            res.json({
                success: true,
                data: parameters,
                timestamp: new Date()
            });

        } catch (error) {
            next(error);
        }
    }

    async updateSystemParameters(req, res, next) {
        const conn = await databaseService.pool.getConnection();
        try {
            await conn.beginTransaction();

            const updates = req.body;
            const results = [];

            for (const [paramName, newValue] of Object.entries(updates)) {
                // Validar el parámetro antes de actualizarlo
                await this.validateParameter(paramName, newValue);

                // Buscar el ID del tipo de parámetro
                const [paramInfo] = await conn.query(
                    `SELECT id FROM sem_tipos_parametros WHERE nombre = ?`,
                    [paramName]
                );

                if (paramInfo.length === 0) {
                    throw new ValidationError(`Parámetro no encontrado: ${paramName}`);
                }

                // Desactivar la configuración anterior
                await conn.query(
                    `UPDATE sem_configuracion 
                     SET activo = 0, 
                         valido_hasta = CURRENT_TIMESTAMP 
                     WHERE tipo_parametro_id = ? AND activo = 1`,
                    [paramInfo[0].id]
                );

                // Insertar nueva configuración
                const [result] = await conn.query(
                    `INSERT INTO sem_configuracion 
                     (tipo_parametro_id, valor, activo, valido_desde) 
                     VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
                    [paramInfo[0].id, newValue.toString()]
                );

                results.push({
                    parameter: paramName,
                    updated: result.affectedRows > 0
                });
            }

            await conn.commit();

            res.json({
                success: true,
                message: 'Parámetros actualizados correctamente',
                updates: results,
                timestamp: new Date()
            });

        } catch (error) {
            await conn.rollback();
            next(error);
        } finally {
            conn.release();
        }
    }

    async validateParameter(paramName, value) {
        const [param] = await databaseService.pool.query(
            `SELECT tipo_dato, reglas_validacion 
             FROM sem_tipos_parametros 
             WHERE nombre = ?`,
            [paramName]
        );

        if (param.length === 0) {
            throw new ValidationError(`Parámetro desconocido: ${paramName}`);
        }

        const rules = JSON.parse(param[0].reglas_validacion || '{}');

        switch (param[0].tipo_dato) {
            case 'DECIMAL':
            case 'ENTERO':
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    throw new ValidationError(`Valor inválido para ${paramName}`);
                }
                if (rules.min !== undefined && numValue < rules.min) {
                    throw new ValidationError(
                        `Valor muy bajo para ${paramName}. Mínimo: ${rules.min}`
                    );
                }
                if (rules.max !== undefined && numValue > rules.max) {
                    throw new ValidationError(
                        `Valor muy alto para ${paramName}. Máximo: ${rules.max}`
                    );
                }
                break;
            // Agregar más validaciones según sea necesario
        }
    }

    parseConfigValue(value, type) {
        switch (type) {
            case 'DECIMAL':
                return parseFloat(value);
            case 'ENTERO':
                return parseInt(value);
            default:
                return value;
        }
    }
}

module.exports = new sem_ConfigController();
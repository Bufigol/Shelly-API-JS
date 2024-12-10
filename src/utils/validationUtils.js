class ValidationUtils {
    /**
     * Valida un campo numérico
     */
    validateNumericField(value, fieldName, options = {}) {
        const {
            required = true,
            min = null,
            max = null,
            defaultValue = 0
        } = options;

        if (value === null || value === undefined) {
            if (required) {
                throw new Error(`El campo ${fieldName} es requerido`);
            }
            return defaultValue;
        }

        const numValue = Number(value);
        if (isNaN(numValue)) {
            throw new Error(`El campo ${fieldName} debe ser numérico`);
        }

        if (min !== null && numValue < min) {
            throw new Error(`El campo ${fieldName} debe ser mayor o igual a ${min}`);
        }

        if (max !== null && numValue > max) {
            throw new Error(`El campo ${fieldName} debe ser menor o igual a ${max}`);
        }

        return numValue;
    }

    /**
     * Valida los parámetros de medición eléctrica
     */
    validateElectricalMeasurement(data) {
        const validatedData = {};

        // Validar voltajes
        ['a_voltage', 'b_voltage', 'c_voltage'].forEach(field => {
            validatedData[field] = this.validateNumericField(data[field], field, {
                min: 0,
                max: 260,
                required: true
            });
        });

        // Validar corrientes
        ['a_current', 'b_current', 'c_current', 'total_current'].forEach(field => {
            validatedData[field] = this.validateNumericField(data[field], field, {
                min: 0,
                max: 200,
                required: true
            });
        });

        // Validar potencias
        ['a_act_power', 'b_act_power', 'c_act_power', 'total_act_power'].forEach(field => {
            validatedData[field] = this.validateNumericField(data[field], field, {
                min: 0,
                required: true
            });
        });

        // Validar factores de potencia
        ['a_pf', 'b_pf', 'c_pf'].forEach(field => {
            validatedData[field] = this.validateNumericField(data[field], field, {
                min: -1,
                max: 1,
                required: true
            });
        });

        return validatedData;
    }

    /**
     * Valida la calidad de los datos
     */
    validateDataQuality(data, options = {}) {
        const {
            minQuality = 80,
            maxDeviation = 10
        } = options;

        const quality = {
            isValid: true,
            score: 100,
            issues: []
        };

        // Verificar valores nulos o indefinidos
        const nullCount = Object.values(data).filter(v => v === null || v === undefined).length;
        if (nullCount > 0) {
            quality.issues.push(`Se encontraron ${nullCount} valores nulos`);
            quality.score -= (nullCount * 5);
        }

        // Verificar valores fuera de rango
        const outOfRangeCount = Object.entries(data)
            .filter(([key, value]) => {
                if (key.includes('voltage')) {
                    return value < 180 || value > 260;
                }
                if (key.includes('current')) {
                    return value < 0 || value > 200;
                }
                if (key.includes('pf')) {
                    return value < -1 || value > 1;
                }
                return false;
            }).length;

        if (outOfRangeCount > 0) {
            quality.issues.push(`Se encontraron ${outOfRangeCount} valores fuera de rango`);
            quality.score -= (outOfRangeCount * 10);
        }

        // Verificar desviaciones significativas
        if (data.previous) {
            const deviations = Object.entries(data)
                .filter(([key, value]) => {
                    if (!data.previous[key]) return false;
                    const deviation = Math.abs((value - data.previous[key]) / data.previous[key] * 100);
                    return deviation > maxDeviation;
                }).length;

            if (deviations > 0) {
                quality.issues.push(`Se encontraron ${deviations} desviaciones significativas`);
                quality.score -= (deviations * 5);
            }
        }

        quality.isValid = quality.score >= minQuality;
        return quality;
    }
}

module.exports = new ValidationUtils();
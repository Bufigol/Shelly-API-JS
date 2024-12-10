class TransformUtils {
    /**
     * Transforma datos de medición para almacenamiento
     */
    transformMeasurementData(rawData) {
        const transformed = {
            timestamp_utc: new Date(),
            device_data: {},
            measurements: {},
            quality_metrics: {}
        };

        // Transformar datos del dispositivo
        if (rawData.device_status) {
            transformed.device_data = {
                code: rawData.device_status.code,
                cloud_connected: Boolean(rawData.device_status.cloud?.connected),
                wifi_status: rawData.device_status.wifi?.status,
                wifi_ssid: rawData.device_status.wifi?.ssid,
                wifi_rssi: parseInt(rawData.device_status.wifi?.rssi) || 0,
                sys_timestamp: new Date(rawData.device_status.sys?.unixtime * 1000)
            };
        }

        // Transformar mediciones eléctricas
        if (rawData.device_status['em:0']) {
            const emData = rawData.device_status['em:0'];
            transformed.measurements = {
                phase_a: {
                    voltage: parseFloat(emData.a_voltage) || 0,
                    current: parseFloat(emData.a_current) || 0,
                    power: parseFloat(emData.a_act_power) || 0,
                    power_factor: parseFloat(emData.a_pf) || 0
                },
                phase_b: {
                    voltage: parseFloat(emData.b_voltage) || 0,
                    current: parseFloat(emData.b_current) || 0,
                    power: parseFloat(emData.b_act_power) || 0,
                    power_factor: parseFloat(emData.b_pf) || 0
                },
                phase_c: {
                    voltage: parseFloat(emData.c_voltage) || 0,
                    current: parseFloat(emData.c_current) || 0,
                    power: parseFloat(emData.c_act_power) || 0,
                    power_factor: parseFloat(emData.c_pf) || 0
                },
                total: {
                    current: parseFloat(emData.total_current) || 0,
                    active_power: parseFloat(emData.total_act_power) || 0,
                    apparent_power: parseFloat(emData.total_aprt_power) || 0
                }
            };
        }

        // Métricas de calidad
        transformed.quality_metrics = {
            reading_quality: rawData.device_status.reading_quality || 'UNKNOWN',
            interval_seconds: rawData.device_status.interval_ms ? 
                Math.round(rawData.device_status.interval_ms / 1000) : 10,
            measurement_timestamp: transformed.device_data.sys_timestamp
        };

        return transformed;
    }

    /**
     * Transforma datos para respuestas API
     */
    transformApiResponse(data, options = {}) {
        const {
            includeMetadata = true,
            format = 'default'
        } = options;

        const response = {
            data: {},
            metadata: includeMetadata ? {
                timestamp: new Date(),
                version: '1.0'
            } : undefined
        };

        switch (format) {
            case 'simple':
                response.data = this.transformToSimpleFormat(data);
                break;
            case 'detailed':
                response.data = this.transformToDetailedFormat(data);
                break;
            default:
                response.data = data;
        }

        return response;
    }

    /**
     * Transforma a formato simple
     */
    transformToSimpleFormat(data) {
        return {
            timestamp: data.timestamp_utc,
            total_power: data.measurements?.total?.active_power || 0,
            total_current: data.measurements?.total?.current || 0,
            quality: data.quality_metrics?.reading_quality
        };
    }

    /**
     * Transforma a formato detallado
     */
    transformToDetailedFormat(data) {
        const transformed = {
            timestamp: data.timestamp_utc,
            device: {
                ...data.device_data,
                status: {
                    online: data.device_data.cloud_connected,
                    wifi_strength: this.calculateWifiStrength(data.device_data.wifi_rssi)
                }
            },
            measurements: {
                phases: {
                    a: data.measurements?.phase_a,
                    b: data.measurements?.phase_b,
                    c: data.measurements?.phase_c
                },
                total: data.measurements?.total
            },
            quality: {
                ...data.quality_metrics,
                reliability_score: this.calculateReliabilityScore(data.quality_metrics)
            }
        };

        return transformed;
    }

    /**
     * Calcula la fuerza de la señal WiFi
     */
    calculateWifiStrength(rssi) {
        if (rssi >= -50) return 'Excelente';
        if (rssi >= -60) return 'Buena';
        if (rssi >= -70) return 'Regular';
        return 'Débil';
    }

    /**
     * Calcula el score de confiabilidad
     */
    calculateReliabilityScore(metrics) {
        if (!metrics) return 0;

        let score = 100;

        if (metrics.reading_quality !== 'GOOD') {
            score -= 20;
        }

        const expectedInterval = 10;
        const intervalDeviation = Math.abs(metrics.interval_seconds - expectedInterval);
        if (intervalDeviation > 1) {
            score -= intervalDeviation * 5;
        }

        return Math.max(0, Math.min(100, score));
    }
}

module.exports = new TransformUtils();
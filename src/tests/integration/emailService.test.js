// tests/integration/emailService.test.js
const emailService = require('../../../src/services/email/emailService');
const config = require('../../../src/config/js_files/config-loader');
const notificationController = require('../../../src/controllers/notificationController');
const UbibotCollector = require('../../../collectors/ubibot-collector');
const moment = require('moment-timezone');

// Mock para interceptar las llamadas a sgMail.send
jest.mock('@sendgrid/mail', () => {
    const mockSend = jest.fn().mockResolvedValue([{ statusCode: 202 }]);
    return {
        setApiKey: jest.fn(),
        send: mockSend
    };
});

// Mock para moment-timezone
jest.mock('moment-timezone', () => {
    const originalMoment = jest.requireActual('moment-timezone');
    return jest.fn((...args) => originalMoment(...args));
});

// Mock para notificationController
jest.mock('../../src/controllers/notificationController', () => ({
    isWithinWorkingHours: jest.fn().mockReturnValue(false) // Simular fuera de horario laboral para que envíe notificaciones
}));

describe('EmailService - Pruebas de Integración', () => {
    let sgMailMock;
    let originalApiKey;
    let testApiKey = 'SG.test-api-key-for-integration-tests';

    beforeAll(async () => {
        // Guardar la API key original
        originalApiKey = config.getConfig().email.SENDGRID_API_KEY;

        // Configurar el mock de sgMail
        sgMailMock = require('@sendgrid/mail');

        // Inicializar el servicio de email
        await emailService.initialize();
    });

    beforeEach(() => {
        // Limpiar mocks entre pruebas
        jest.clearAllMocks();

        // Simular la nueva API key en la configuración
        jest.spyOn(config, 'getConfig').mockImplementation(() => ({
            ...config.getConfig(),
            email: {
                ...config.getConfig().email,
                SENDGRID_API_KEY: testApiKey
            }
        }));
    });

    afterAll(() => {
        // Restaurar la API key original si es necesario
        jest.spyOn(config, 'getConfig').mockRestore();
    });

    test('Debería cargar correctamente la nueva API key', () => {
        // Verificar que la nueva API key esté configurada
        expect(config.getConfig().email.SENDGRID_API_KEY).toBe(testApiKey);

        // Verificar que se haya llamado a setApiKey con la nueva clave
        expect(sgMailMock.setApiKey).toHaveBeenCalledWith(testApiKey);
    });

    test('isConfigured() debería devolver true con la configuración correcta', () => {
        // Verificar que el servicio esté correctamente configurado
        expect(emailService.isConfigured()).toBe(true);
    });

    test('sendPasswordResetEmail debería enviar un correo con la configuración correcta', async () => {
        // Simular datos para envío de correo
        const email = 'test@example.com';
        const resetToken = 'test-reset-token';
        const resetUrl = 'https://example.com/reset-password/test-reset-token';

        // Enviar el correo
        const result = await emailService.sendPasswordResetEmail(email, resetToken, resetUrl);

        // Verificar que se haya enviado correctamente
        expect(result).toBe(true);
        expect(sgMailMock.send).toHaveBeenCalledTimes(1);

        // Verificar los datos del correo
        const sentEmail = sgMailMock.send.mock.calls[0][0];
        expect(sentEmail.to).toBe(email);
        expect(sentEmail.from).toBe(emailService.fromEmail);
        expect(sentEmail.subject).toContain('Restablecimiento de Contraseña');
        expect(sentEmail.html).toContain(resetUrl);
    });

    test('sendPasswordResetConfirmationEmail debería enviar un correo de confirmación', async () => {
        // Simular datos para envío de correo
        const email = 'test@example.com';

        // Enviar el correo
        const result = await emailService.sendPasswordResetConfirmationEmail(email);

        // Verificar que se haya enviado correctamente
        expect(result).toBe(true);
        expect(sgMailMock.send).toHaveBeenCalledTimes(1);

        // Verificar los datos del correo
        const sentEmail = sgMailMock.send.mock.calls[0][0];
        expect(sentEmail.to).toBe(email);
        expect(sentEmail.from).toBe(emailService.fromEmail);
        expect(sentEmail.subject).toContain('Contraseña restablecida con éxito');
    });

    test('sendTemperatureRangeAlertsEmail debería enviar alertas de temperatura', async () => {
        // Simular canales fuera de rango
        const outOfRangeChannels = [
            {
                name: 'Cámara 1',
                temperature: -5.5,
                timestamp: '2025-04-15T15:30:00.000Z',
                minThreshold: -20,
                maxThreshold: -10,
                allReadings: [
                    {
                        temperature: -9.8,
                        timestamp: '2025-04-15T14:30:00.000Z',
                        minThreshold: -20,
                        maxThreshold: -10
                    },
                    {
                        temperature: -5.5,
                        timestamp: '2025-04-15T15:30:00.000Z',
                        minThreshold: -20,
                        maxThreshold: -10
                    }
                ]
            },
            {
                name: 'Cámara 2',
                temperature: -25.3,
                timestamp: '2025-04-15T15:35:00.000Z',
                minThreshold: -20,
                maxThreshold: -10,
                allReadings: [
                    {
                        temperature: -25.3,
                        timestamp: '2025-04-15T15:35:00.000Z',
                        minThreshold: -20,
                        maxThreshold: -10
                    }
                ]
            }
        ];

        // Enviar alertas de temperatura
        const result = await emailService.sendTemperatureRangeAlertsEmail(
            outOfRangeChannels,
            new Date(),
            null,
            true // Forzar envío incluso en horario laboral
        );

        // Verificar que se haya enviado correctamente
        expect(result).toBe(true);
        expect(sgMailMock.send).toHaveBeenCalledTimes(1);

        // Verificar los datos del correo
        const sentEmail = sgMailMock.send.mock.calls[0][0];
        expect(sentEmail.to).toEqual(emailService.defaultRecipients);
        expect(sentEmail.subject).toContain('Alerta de Temperatura');
        expect(sentEmail.html).toContain('Cámara 1');
        expect(sentEmail.html).toContain('Cámara 2');
        expect(sentEmail.html).toContain('-5.5°C');
        expect(sentEmail.html).toContain('-25.3°C');
    });

    test('sendDisconnectedSensorsEmail debería enviar alertas de sensores desconectados', async () => {
        // Simular canales desconectados
        const disconnectedChannels = [
            {
                name: 'Reefer A',
                channelId: '12345',
                lastEvent: 'disconnected',
                disconnectTime: '2025-04-15T10:30:00.000Z',
                reconnectTime: null,
                events: [
                    {
                        event: 'connected',
                        timestamp: '2025-04-15T08:30:00.000Z'
                    },
                    {
                        event: 'disconnected',
                        timestamp: '2025-04-15T10:30:00.000Z'
                    }
                ]
            },
            {
                name: 'Reefer B',
                channelId: '67890',
                lastEvent: 'connected',
                disconnectTime: '2025-04-15T11:30:00.000Z',
                reconnectTime: '2025-04-15T12:30:00.000Z',
                events: [
                    {
                        event: 'disconnected',
                        timestamp: '2025-04-15T11:30:00.000Z'
                    },
                    {
                        event: 'connected',
                        timestamp: '2025-04-15T12:30:00.000Z'
                    }
                ]
            }
        ];

        // Enviar alertas de sensores desconectados
        const result = await emailService.sendDisconnectedSensorsEmail(disconnectedChannels);

        // Verificar que se haya enviado correctamente
        expect(result).toBe(true);
        expect(sgMailMock.send).toHaveBeenCalledTimes(1);

        // Verificar los datos del correo
        const sentEmail = sgMailMock.send.mock.calls[0][0];
        expect(sentEmail.to).toEqual(emailService.defaultRecipients);
        expect(sentEmail.subject).toContain('Alerta de Conexión de Sensores');
        expect(sentEmail.html).toContain('Reefer A');
        expect(sentEmail.html).toContain('Reefer B');
        expect(sentEmail.html).toContain('DESCONECTADO');
        expect(sentEmail.html).toContain('CONECTADO');
    });

    test('Debería procesar alertas fuera del horario laboral', async () => {
        // Configurar notificationController.isWithinWorkingHours para que devuelva false (fuera de horario)
        notificationController.isWithinWorkingHours.mockReturnValue(false);

        // Agregar una alerta a la cola
        emailService.addAlertToQueue({
            type: 'temperature',
            data: {
                location: 'Cámara Test',
                temperature: -25,
                minThreshold: -20,
                maxThreshold: -10,
                timestamp: new Date().toISOString()
            },
            recipients: ['test@example.com'],
            priority: 'high'
        });

        // Procesar la cola de alertas
        const result = await emailService.processAlertQueue();

        // Verificar que se haya procesado correctamente
        expect(result.success).toBe(true);
        expect(result.processed).toBeGreaterThan(0);
        expect(sgMailMock.send).toHaveBeenCalled();
    });

    test('No debería procesar alertas dentro del horario laboral', async () => {
        // Configurar notificationController.isWithinWorkingHours para que devuelva true (dentro de horario)
        notificationController.isWithinWorkingHours.mockReturnValue(true);

        // Agregar una alerta a la cola
        emailService.addAlertToQueue({
            type: 'temperature',
            data: {
                location: 'Cámara Test',
                temperature: -25,
                minThreshold: -20,
                maxThreshold: -10,
                timestamp: new Date().toISOString()
            },
            recipients: ['test@example.com'],
            priority: 'high'
        });

        // Procesar la cola de alertas (sin forzar)
        const result = await emailService.processAlertQueue(false);

        // Verificar que no se haya procesado
        expect(result.success).toBe(false);
        expect(result.reason).toBe('working_hours');
        expect(sgMailMock.send).not.toHaveBeenCalled();
    });
});

// Test de integración con UbibotCollector
describe('UbibotCollector - Integración con EmailService', () => {
    let ubibotCollector;
    let sgMailMock;

    beforeEach(() => {
        // Configurar sgMailMock
        sgMailMock = require('@sendgrid/mail');
        jest.clearAllMocks();

        // Crear una instancia de UbibotCollector
        ubibotCollector = new UbibotCollector();

        // Mock para las funciones que no queremos ejecutar realmente
        ubibotCollector.getChannels = jest.fn().mockResolvedValue([
            {
                channel_id: '12345',
                name: 'Test Channel'
            }
        ]);

        ubibotCollector.getChannelData = jest.fn().mockResolvedValue({
            channel: {
                channel_id: '12345',
                name: 'Test Channel',
                last_entry_date: new Date().toISOString(),
                last_values: JSON.stringify({
                    field1: { value: -20, created_at: new Date().toISOString() },
                    field8: { value: -25, created_at: new Date().toISOString() }
                })
            }
        });

        // Mock para ubibotService
        jest.mock('../../../src/services/ubibotService', () => ({
            processChannelData: jest.fn().mockResolvedValue(true),
            processSensorReadings: jest.fn().mockResolvedValue(true),
            checkParametersAndNotify: jest.fn().mockResolvedValue(true),
            getLastSensorReading: jest.fn().mockResolvedValue({
                external_temperature_timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000) // Un día atrás
            })
        }));
    });

    test('Debería enviar alertas de temperatura detectadas por UbibotCollector', async () => {
        // Simular datos para procesamiento de temperatura
        const channelId = '12345';
        const channelName = 'Cámara Test';
        const temperature = -25;
        const timestamp = new Date().toISOString();
        const minThreshold = -20;
        const maxThreshold = -10;

        // Simular que notificationController procesa una lectura de temperatura
        await notificationController.processTemperatureReading(
            channelId,
            channelName,
            temperature,
            timestamp,
            minThreshold,
            maxThreshold,
            true // isOperational
        );

        // Simular que se han acumulado 3 alertas
        for (let i = 0; i < 2; i++) {
            await notificationController.processTemperatureReading(
                channelId,
                channelName,
                temperature,
                timestamp,
                minThreshold,
                maxThreshold,
                true
            );
        }

        // Forzar procesamiento de alertas
        const hourKey = notificationController.getHourKey();
        await notificationController.processHourlyTemperatureAlerts(hourKey);

        // Verificar que se haya enviado la alerta por email
        expect(sgMailMock.send).toHaveBeenCalled();
    });

    test('Debería enviar alertas de desconexión detectadas por UbibotCollector', async () => {
        // Simular un evento de desconexión
        const channelId = '12345';
        const channelName = 'Cámara Test';

        // Simular que está offline
        await notificationController.processConnectionStatusChange(
            channelId,
            channelName,
            false, // isOnline
            false, // wasOffline
            new Date(Date.now() - 2 * 60 * 60 * 1000), // outOfRangeSince (2 horas atrás)
            null, // lastAlertSent
            true // isOperational
        );

        // Forzar procesamiento de alertas
        const hourKey = notificationController.getHourKey();
        await notificationController.processHourlyDisconnectionAlerts(hourKey);

        // Verificar que se haya enviado la alerta por email
        expect(sgMailMock.send).toHaveBeenCalled();
    });
});
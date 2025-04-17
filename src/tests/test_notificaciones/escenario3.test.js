// src/tests/test_notificaciones/escenario3.test.js

const notificationController = require('../../controllers/notificationController');
const emailService = require('../../services/email/emailService');
const { setOutsideWorkingHours, advanceToNextHour } = require('../reconexión/helpers/timeHelpers');
const { getChannelState, updateChannelState } = require('../reconexión/helpers/dbHelpers');

// ID del canal operativo
const TEST_CHANNEL_ID = '9999';
const TEST_CHANNEL_NAME = 'Canal de integración';

describe('Escenario 3: Fuera del Horario Laboral', () => {
    // Espías para los métodos del emailService
    let sendDisconnectedSensorsEmailSpy;
    let sendTemperatureRangeAlertsEmailSpy;

    beforeEach(() => {
        // Configurar espías para los métodos de emailService
        sendDisconnectedSensorsEmailSpy = jest.spyOn(emailService, 'sendDisconnectedSensorsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío

        sendTemperatureRangeAlertsEmailSpy = jest.spyOn(emailService, 'sendTemperatureRangeAlertsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío
    });

    afterEach(() => {
        // Restaurar todos los mocks después de cada prueba
        jest.restoreAllMocks();
    });

    test('3.1: Desconexión Canal Operativo fuera de horario laboral envía alerta', async () => {
        // Verificar que el canal existe y está marcado como operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(1); // Debe estar marcado como operativo

        // Configurar tiempo fuera del horario laboral (domingo)
        const testTime = setOutsideWorkingHours({ sunday: true });

        // Simular evento de desconexión (isOnline = false)
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            false, // isOnline = false
            false, // wasOffline = false (no estaba offline antes)
            null,  // outOfRangeSince
            null,  // lastAlertSent
            true   // isOperational = true (SÍ operativo)
        );

        // Verificar que se creó un evento en el buffer para la hora actual
        const currentHourKey = notificationController.getHourKey(testTime);
        expect(notificationController.disconnectionAlertsByHour[currentHourKey]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID].length).toBe(1);
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID][0].event).toBe('disconnected');

        // Avanzar a la siguiente hora para simular el procesamiento
        const nextHourTime = advanceToNextHour(testTime);

        // Simular procesamiento horario
        await notificationController.processHourlyAlerts();

        // Verificar que SÍ se llamó al método de envío de correo
        expect(sendDisconnectedSensorsEmailSpy).toHaveBeenCalled();

        // Verificar argumentos de la llamada
        const emailArgs = sendDisconnectedSensorsEmailSpy.mock.calls[0][0];
        expect(emailArgs).toBeInstanceOf(Array);
        expect(emailArgs.length).toBeGreaterThan(0);

        // Verificar que el canal correcto está en los argumentos
        const channelInEmail = emailArgs.find(alert => alert.channelId === TEST_CHANNEL_ID);
        expect(channelInEmail).toBeDefined();
        expect(channelInEmail.name).toBe(TEST_CHANNEL_NAME);
        expect(channelInEmail.finalStatus).toBe('DESCONECTADO');

        // Verificar que se actualizó la BD para last_alert_sent
        const updatedState = await getChannelState(TEST_CHANNEL_ID);
        expect(updatedState.last_alert_sent).not.toBeNull();
    });

    test('3.2: Temperatura Fuera de Rango Canal Operativo fuera de horario laboral envía alerta', async () => {
        // Verificar que el canal existe y está marcado como operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(1); // Debe estar marcado como operativo

        // Configurar tiempo fuera del horario laboral
        const testTime = setOutsideWorkingHours({ sunday: true });

        // Temperatura claramente fuera de rango (usaremos -25°C, umbral mínimo es -21°C)
        const temperature = -25;

        // Definimos valores esperados para este canal basados en la documentación
        const minThreshold = -21.00;
        const maxThreshold = 15.00;

        // Simular 3 lecturas de temperatura fuera de rango
        for (let i = 0; i < 3; i++) {
            await notificationController.processTemperatureReading(
                TEST_CHANNEL_ID,           // channelId
                TEST_CHANNEL_NAME,         // channelName
                temperature,               // temperatura
                testTime.toISOString(),    // timestamp
                minThreshold,              // minThreshold
                maxThreshold,              // maxThreshold
                true                       // isOperational = true
            );
        }

        // Verificar que se incrementó el contador para este canal
        // NOTA: El contador debe haberse reseteado después de alcanzar 3 y generar una alerta
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID].count).toBe(0);

        // Verificar que se creó alerta en el buffer
        const currentHourKey = notificationController.getHourKey(testTime);
        expect(notificationController.temperatureAlertsByHour[currentHourKey]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID].length).toBe(1);

        // Avanzar a la siguiente hora para simular el procesamiento
        const nextHourTime = advanceToNextHour(testTime);

        // Simular procesamiento horario fuera del horario laboral
        await notificationController.processHourlyAlerts();

        // Verificar que SÍ se llamó al método de envío de correo para temperatura
        expect(sendTemperatureRangeAlertsEmailSpy).toHaveBeenCalled();

        // Verificar argumentos de la llamada
        const emailArgs = sendTemperatureRangeAlertsEmailSpy.mock.calls[0][0];
        expect(emailArgs).toBeInstanceOf(Array);
        expect(emailArgs.length).toBeGreaterThan(0);

        // Verificar que el canal correcto está en los argumentos
        const channelInEmail = emailArgs.find(alert => alert.channelId === TEST_CHANNEL_ID);
        expect(channelInEmail).toBeDefined();
        expect(channelInEmail.name).toBe(TEST_CHANNEL_NAME);
        expect(channelInEmail.temperature).toBe(temperature);

        // Verificar que se eliminó del buffer después de procesar
        expect(notificationController.temperatureAlertsByHour[currentHourKey]).toBeUndefined();
    });
});
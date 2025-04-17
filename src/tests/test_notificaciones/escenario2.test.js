// src/tests/test_notificaciones/escenario2.test.js

const notificationController = require('../../controllers/notificationController');
const emailService = require('../../services/email/emailService');
const { setWithinWorkingHours, setOutsideWorkingHours } = require('../reconexión/helpers/timeHelpers');
const { getChannelState, updateChannelState } = require('../reconexión/helpers/dbHelpers');

// ID del canal NO operativo
const TEST_CHANNEL_ID = '694209';
const TEST_CHANNEL_NAME = 'Canal de prueba no operativo';

describe('Escenario 2: Estado Operativo', () => {
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

    test('2.1: Desconexión Canal NO Operativo no genera eventos ni alertas', async () => {
        // Verificar que el canal existe y está marcado como NO operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(0); // Debe estar marcado como no operativo

        // Configurar tiempo fuera del horario laboral para asegurar que las alertas podrían procesarse
        const testTime = setOutsideWorkingHours({ sunday: true });

        // Simular evento de desconexión (isOnline = false)
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            false, // isOnline = false
            false, // wasOffline = false
            null,  // outOfRangeSince
            null,  // lastAlertSent
            false  // isOperational = false (NO operativo)
        );

        // Verificar que NO se creó ningún evento en el buffer para la hora actual
        const currentHourKey = notificationController.getHourKey(testTime);
        expect(notificationController.disconnectionAlertsByHour[currentHourKey]).toBeUndefined();
        // O si existe, no debe contener el canal no operativo
        if (notificationController.disconnectionAlertsByHour[currentHourKey]) {
            expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeUndefined();
        }

        // Simular procesamiento horario
        await notificationController.processHourlyAlerts();

        // Verificar que NO se llamó al método de envío de correo
        expect(sendDisconnectedSensorsEmailSpy).not.toHaveBeenCalled();

        // Verificar que no hay cambios en la BD para last_alert_sent
        const updatedState = await getChannelState(TEST_CHANNEL_ID);
        expect(updatedState.last_alert_sent).toBeNull();
    });

    test('2.2: Temperatura Fuera de Rango Canal NO Operativo no genera alertas', async () => {
        // Verificar que el canal existe y está marcado como NO operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(0); // Debe estar marcado como no operativo

        // Configurar tiempo fuera del horario laboral
        const testTime = setOutsideWorkingHours({ sunday: true });

        // Temperatura claramente fuera de rango (usaremos -25°C, umbral mínimo es -1°C)
        const temperature = -25;

        // Obtener umbrales de temperatura (para verificación)
        // Definimos valores esperados para este canal basados en la documentación
        const minThreshold = -1.00;
        const maxThreshold = 5.00;

        // Simular 3 lecturas de temperatura fuera de rango
        for (let i = 0; i < 3; i++) {
            await notificationController.processTemperatureReading(
                TEST_CHANNEL_ID,           // channelId
                TEST_CHANNEL_NAME,         // channelName
                temperature,               // temperatura
                testTime.toISOString(),    // timestamp
                minThreshold,              // minThreshold
                maxThreshold,              // maxThreshold
                false                      // isOperational = false
            );
        }

        // Verificar que NO se incrementó el contador para este canal
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID]).toBeUndefined();

        // Verificar que NO se creó alerta en el buffer
        const currentHourKey = notificationController.getHourKey(testTime);
        expect(notificationController.temperatureAlertsByHour[currentHourKey]).toBeUndefined();
        // O si existe, no debe contener el canal no operativo
        if (notificationController.temperatureAlertsByHour[currentHourKey]) {
            expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeUndefined();
        }

        // Simular procesamiento horario
        await notificationController.processHourlyAlerts();

        // Verificar que NO se llamó al método de envío de correo para temperatura
        expect(sendTemperatureRangeAlertsEmailSpy).not.toHaveBeenCalled();
    });
});
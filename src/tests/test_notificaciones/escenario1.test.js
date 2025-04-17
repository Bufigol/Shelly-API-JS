// src/tests/test_notificaciones/escenario1.test.js

const notificationController = require('../../controllers/notificationController');
const emailService = require('../../services/email/emailService');
// Ensure helpers are imported from the correct relative path if needed,
// assuming they are now in a shared 'helpers' directory relative to 'test_notificaciones'
// or adjust the path as necessary.
const { setWithinWorkingHours, advanceToNextHour, advanceTimeByMinutes } = require('../reconexión/helpers/timeHelpers');
const { getChannelState, updateChannelState, resetDatabaseState } = require('../reconexión/helpers/dbHelpers'); 


// ID del canal operativo
const TEST_CHANNEL_ID = '9999';
const TEST_CHANNEL_NAME = 'Canal de integración';

describe('Escenario 1: Dentro del Horario Laboral', () => {
    // Espías para los métodos del emailService
    let sendDisconnectedSensorsEmailSpy;
    let sendTemperatureRangeAlertsEmailSpy;

    beforeEach(async () => { // Make beforeEach async if DB reset is needed here too
        // Reset DB state specifically for these tests if not handled globally
        await resetDatabaseState();

        // Configurar espías para los métodos de emailService
        sendDisconnectedSensorsEmailSpy = jest.spyOn(emailService, 'sendDisconnectedSensorsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío

        sendTemperatureRangeAlertsEmailSpy = jest.spyOn(emailService, 'sendTemperatureRangeAlertsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío

         // Limpiar buffers del controlador antes de cada test para aislamiento
         notificationController.temperatureAlertsByHour = {};
         notificationController.disconnectionAlertsByHour = {};
         notificationController.tempAlertCounters = {};
    });

    afterEach(() => {
        // Restaurar todos los mocks después de cada prueba
        jest.restoreAllMocks();
        // Restore Date.now() mocked by timeHelpers
        jest.useRealTimers(); // Or mockNow.restore() if using jest-mock-now directly
    });

    test('1.1: Desconexión Canal Operativo dentro del horario laboral envía alerta', async () => {
        // Verificar que el canal existe y está marcado como operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(1); // Debe estar marcado como operativo

        // Configurar tiempo dentro del horario laboral (ej: miércoles 11:00 AM)
        const testTime = setWithinWorkingHours();

        // Simular evento de desconexión (isOnline = false)
        // **MODIFIED:** Pass testTime as the event timestamp
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            false, // isOnline = false
            false, // wasOffline = false (no estaba offline antes)
            null,  // outOfRangeSince
            null,  // lastAlertSent
            true,  // isOperational = true (SÍ operativo)
            testTime // <-- ADDED: Pass the mocked event time
        );

        // Verificar que se creó un evento en el buffer para la hora actual (mocked time)
        const currentHourKey = notificationController.getHourKey(testTime);
        // console.log(`Test 1.1: Checking buffer for key: ${currentHourKey}`); // Debug log
        // console.log('Test 1.1: Current disconnectionAlertsByHour:', JSON.stringify(notificationController.disconnectionAlertsByHour, null, 2)); // Debug log
        expect(notificationController.disconnectionAlertsByHour[currentHourKey]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID].length).toBe(1);
        expect(notificationController.disconnectionAlertsByHour[currentHourKey][TEST_CHANNEL_ID][0].event).toBe('disconnected');

        // Avanzar a la siguiente hora para simular el procesamiento
        // Use testTime as the base for advancing
        const nextHourTime = advanceToNextHour(testTime);

        // Simular procesamiento horario (ahora procesará prevHourKey, que es currentHourKey)
        await notificationController.processHourlyAlerts();

        // Verificar que SÍ se llamó al método de envío de correo INCLUSO EN HORARIO LABORAL
        // Las alertas de desconexión se envían siempre, independientemente del horario laboral
        expect(sendDisconnectedSensorsEmailSpy).toHaveBeenCalled();

        // Verificar argumentos de la llamada
        const emailArgs = sendDisconnectedSensorsEmailSpy.mock.calls[0][0];
        expect(emailArgs).toBeInstanceOf(Array);
        expect(emailArgs.length).toBeGreaterThan(0);

        // Verificar que el canal correcto está en los argumentos
        const channelInEmail = emailArgs.find(alert => alert.channelId === TEST_CHANNEL_ID);
        expect(channelInEmail).toBeDefined();
        expect(channelInEmail.name).toBe(TEST_CHANNEL_NAME);
        // *** IMPORTANTE: El estado final ahora se determina en processHourlyDisconnectionAlerts ***
        // Validar el estado final esperado basado en la lógica de processHourlyDisconnectionAlerts
        // Como solo hubo un evento 'disconnected', el estado final debe ser 'DESCONECTADO'
        expect(channelInEmail.finalStatus).toBe('DESCONECTADO');

        // Verificar que se actualizó la BD para last_alert_sent
        const updatedState = await getChannelState(TEST_CHANNEL_ID);
        // El timestamp de la BD se establece durante processHourlyAlerts, debería existir
        expect(updatedState.last_alert_sent).not.toBeNull();
    });

    test('1.2: Temperatura Fuera de Rango Canal Operativo dentro de horario laboral no envía alerta', async () => {
        // Verificar que el canal existe y está marcado como operativo
        const channelState = await getChannelState(TEST_CHANNEL_ID);
        expect(channelState.esOperativa).toBe(1); // Debe estar marcado como operativo

        // Configurar tiempo dentro del horario laboral (ej: miércoles 11:00 AM)
        const testTime = setWithinWorkingHours();

        // Temperatura claramente fuera de rango (usaremos -25°C, umbral mínimo es -21°C)
        const temperature = -25;

        // Definimos valores esperados para este canal basados en la documentación
        const minThreshold = -21.00;
        const maxThreshold = 15.00;

        // Simular 3 lecturas de temperatura fuera de rango
        for (let i = 0; i < 3; i++) {
            // **MODIFIED:** Pass testTime as the detection timestamp
            await notificationController.processTemperatureReading(
                TEST_CHANNEL_ID,           // channelId
                TEST_CHANNEL_NAME,         // channelName
                temperature,               // temperatura
                testTime.toISOString(),    // timestamp (reading time)
                minThreshold,              // minThreshold
                maxThreshold,              // maxThreshold
                true,                      // isOperational = true
                testTime                   // <-- ADDED: Pass the mocked detection/processing time
            );
            // Optional: Advance time slightly between readings if logic depends on it
            // testTime = advanceTimeByMinutes(1, testTime); // Example: Advance 1 min
        }

        // Verificar que se incrementó el contador para este canal
        // NOTA: El contador debe haberse reseteado después de alcanzar 3 y generar una alerta en buffer
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.tempAlertCounters[TEST_CHANNEL_ID].count).toBe(0); // Resets after buffering

        // Verificar que se creó alerta en el buffer para la hora actual (mocked time)
        const currentHourKey = notificationController.getHourKey(testTime);
        // console.log(`Test 1.2: Checking buffer for key: ${currentHourKey}`); // Debug log
        // console.log('Test 1.2: Current temperatureAlertsByHour:', JSON.stringify(notificationController.temperatureAlertsByHour, null, 2)); // Debug log
        expect(notificationController.temperatureAlertsByHour[currentHourKey]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[currentHourKey][TEST_CHANNEL_ID].length).toBe(1);

        // Avanzar a la siguiente hora para simular el procesamiento
        // Use the LATEST testTime (if advanced in loop) or the initial one
        const nextHourTime = advanceToNextHour(testTime); // Use the final time from the loop if advanced
        const nextHourKey = notificationController.getHourKey(nextHourTime);

        // Simular procesamiento horario dentro del horario laboral
        // processHourlyAlerts procesa la HORA ANTERIOR (currentHourKey)
        await notificationController.processHourlyAlerts();

        // Verificar que NO se llamó al método de envío de correo para temperatura (porque es horario laboral)
        expect(sendTemperatureRangeAlertsEmailSpy).not.toHaveBeenCalled();

        // Verificar que la alerta se movió al buffer de la siguiente hora (nextHourKey)
        // console.log('Test 1.2: After process, temperatureAlertsByHour:', JSON.stringify(notificationController.temperatureAlertsByHour, null, 2)); // Debug log
        expect(notificationController.temperatureAlertsByHour[currentHourKey]).toBeUndefined(); // Original hour buffer should be cleared/processed
        expect(notificationController.temperatureAlertsByHour[nextHourKey]).toBeDefined(); // Should have been moved here
        expect(notificationController.temperatureAlertsByHour[nextHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.temperatureAlertsByHour[nextHourKey][TEST_CHANNEL_ID].length).toBe(1);

        // Verificar detalles de la alerta movida
        const movedAlert = notificationController.temperatureAlertsByHour[nextHourKey][TEST_CHANNEL_ID][0];
        expect(movedAlert.temperature).toBe(temperature);
        expect(movedAlert.channelId).toBe(TEST_CHANNEL_ID);
        expect(movedAlert.channelName).toBe(TEST_CHANNEL_NAME);
    });
});
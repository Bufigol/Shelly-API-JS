// src/tests/test_notificaciones/escenario5.test.js

const notificationController = require('../../controllers/notificationController');
const emailService = require('../../services/email/emailService');
const { setWithinWorkingHours, advanceTimeByMinutes, advanceToNextHour } = require('../reconexión/helpers/timeHelpers');
const { getChannelState, updateChannelState } = require('../reconexión/helpers/dbHelpers');

// ID del canal operativo
const TEST_CHANNEL_ID = '9999';
const TEST_CHANNEL_NAME = 'Canal de integración';

describe('Escenario 5: Secuencia Desconexión-Reconexión', () => {
    // Espías para los métodos del emailService
    let sendDisconnectedSensorsEmailSpy;

    beforeEach(() => {
        // Configurar espías para los métodos de emailService
        sendDisconnectedSensorsEmailSpy = jest.spyOn(emailService, 'sendDisconnectedSensorsEmail')
            .mockResolvedValue(true); // Simular éxito en el envío
    });

    afterEach(() => {
        // Restaurar todos los mocks después de cada prueba
        jest.restoreAllMocks();
    });

    test('5.1: Desconexión y Reconexión Rápida genera alerta de reconexión', async () => {
        // Configurar en la BD: estado inicial limpio
        await updateChannelState(
            TEST_CHANNEL_ID,
            false,  // is_currently_out_of_range = 0
            null,   // out_of_range_since = null
            null    // last_alert_sent = null
        );

        // Verificar que la actualización se realizó correctamente
        const initialState = await getChannelState(TEST_CHANNEL_ID);
        expect(initialState.is_currently_out_of_range).toBe(0);
        expect(initialState.out_of_range_since).toBeNull();

        // Configurar tiempo inicial (14:15)
        const initialTime = setWithinWorkingHours({ hour: 14, minute: 15 });

        // Simular evento de desconexión a las 14:15
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            false, // isOnline = false
            false, // wasOffline = false
            null,  // outOfRangeSince = null
            null,  // lastAlertSent = null
            true   // isOperational = true
        );

        // Verificar que se registró en el buffer como "disconnected"
        const disconnectionHourKey = notificationController.getHourKey(initialTime);
        expect(notificationController.disconnectionAlertsByHour[disconnectionHourKey]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[disconnectionHourKey][TEST_CHANNEL_ID]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[disconnectionHourKey][TEST_CHANNEL_ID][0].event).toBe('disconnected');

        // Avanzar 30 minutos para simular reconexión (14:45)
        const reconnectionTime = advanceTimeByMinutes(30, initialTime);

        // Verificar que la BD se actualizó con el evento de desconexión
        const stateAfterDisconnection = await getChannelState(TEST_CHANNEL_ID);
        expect(stateAfterDisconnection.is_currently_out_of_range).toBe(1);
        expect(stateAfterDisconnection.out_of_range_since).not.toBeNull();

        // Simular evento de reconexión a las 14:45
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            true,  // isOnline = true (reconectado)
            true,  // wasOffline = true (estaba offline)
            stateAfterDisconnection.out_of_range_since, // out_of_range_since de la BD
            null,  // lastAlertSent = null (no se ha enviado alerta previa)
            true   // isOperational = true
        );

        // Verificar que se registró en el buffer como "connected"
        expect(notificationController.disconnectionAlertsByHour[disconnectionHourKey][TEST_CHANNEL_ID].length).toBe(2);
        expect(notificationController.disconnectionAlertsByHour[disconnectionHourKey][TEST_CHANNEL_ID][1].event).toBe('connected');

        // Avanzar a la siguiente hora para simular el procesamiento (15:00)
        const nextHourTime = advanceToNextHour(initialTime);

        // Simular procesamiento de la hora 14
        await notificationController.processHourlyAlerts();

        // Verificar que SÍ se llamó al método de envío de correo
        expect(sendDisconnectedSensorsEmailSpy).toHaveBeenCalled();

        // Verificar argumentos de la llamada
        const emailArgs = sendDisconnectedSensorsEmailSpy.mock.calls[0][0];
        expect(emailArgs).toBeInstanceOf(Array);
        expect(emailArgs.length).toBeGreaterThan(0);

        // Verificar que el canal correcto está en los argumentos con estado final CONECTADO
        const channelInEmail = emailArgs.find(alert => alert.channelId === TEST_CHANNEL_ID);
        expect(channelInEmail).toBeDefined();
        expect(channelInEmail.name).toBe(TEST_CHANNEL_NAME);
        expect(channelInEmail.finalStatus).toBe('CONECTADO');

        // Verificar que los timestamps se incluyen correctamente
        expect(channelInEmail.horaDesconexion).toBeDefined();
        expect(channelInEmail.horaReconexion).toBeDefined();
        expect(channelInEmail.horaReconexion).not.toBe('N/A en periodo');

        // Verificar que en la BD se resetea last_alert_sent a NULL tras notificar la reconexión
        const finalState = await getChannelState(TEST_CHANNEL_ID);
        expect(finalState.is_currently_out_of_range).toBe(0); // Ahora está conectado
        expect(finalState.last_alert_sent).toBeNull(); // Reseteado a NULL
    });
});
// src/tests/test_notificaciones/escenario4.test.js

const notificationController = require('../../controllers/notificationController');
const emailService = require('../../services/email/emailService');
const { setWithinWorkingHours, setOutsideWorkingHours, advanceTimeByMinutes, advanceToNextHour } = require('../reconexión/helpers/timeHelpers');
const { getChannelState, updateChannelState } = require('../reconexión/helpers/dbHelpers');

// ID del canal operativo
const TEST_CHANNEL_ID = '9999';
const TEST_CHANNEL_NAME = 'Canal de integración';

describe('Escenario 4: Evitar Repetición de Alertas', () => {
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

    test('4.1: Sensor Sigue Offline Tras Notificación no envía alerta duplicada', async () => {
        // Configurar tiempo inicial (9:30 AM)
        const initialTime = setWithinWorkingHours({ hour: 9, minute: 30 });

        // Configurar en la BD: canal 9999 con is_currently_out_of_range = 1, out_of_range_since = "09:30", last_alert_sent = "10:05"
        const outOfRangeSince = new Date(initialTime); // 9:30 AM

        // Avanzar para simular que una alerta ya fue enviada a las 10:05
        const alertTimestamp = advanceTimeByMinutes(35, initialTime); // 10:05 AM

        // Actualizar el estado en la BD
        await updateChannelState(
            TEST_CHANNEL_ID,
            true,               // is_currently_out_of_range = 1
            outOfRangeSince,    // out_of_range_since = 9:30
            alertTimestamp      // last_alert_sent = 10:05
        );

        // Verificar que la actualización se realizó correctamente
        const stateAfterUpdate = await getChannelState(TEST_CHANNEL_ID);
        expect(stateAfterUpdate.is_currently_out_of_range).toBe(1);

        // Avanzar a las 11:15 para simular nueva lectura
        const newEventTime = advanceTimeByMinutes(70, alertTimestamp); // 11:15 AM

        // Simular la recepción de otro evento isOnline = false
        await notificationController.processConnectionStatusChange(
            TEST_CHANNEL_ID,
            TEST_CHANNEL_NAME,
            false, // isOnline = false (sigue offline)
            true,  // wasOffline = true (ya estaba offline)
            outOfRangeSince, // out_of_range_since = 9:30
            alertTimestamp,  // last_alert_sent = 10:05
            true   // isOperational = true (SÍ operativo)
        );

        // Verificar que se añadió al buffer de la hora 11
        const hourKey = notificationController.getHourKey(newEventTime);
        expect(notificationController.disconnectionAlertsByHour[hourKey]).toBeDefined();
        expect(notificationController.disconnectionAlertsByHour[hourKey][TEST_CHANNEL_ID]).toBeDefined();

        // Avanzar a la siguiente hora para simular el procesamiento
        const nextHourTime = advanceToNextHour(newEventTime);

        // Simular procesamiento de la hora 11
        await notificationController.processHourlyAlerts();

        // Verificar que en processHourlyDisconnectionAlerts se detecta que last_alert_sent >= out_of_range_since
        // Verificar que NO se envía nuevo email para ese canal
        expect(sendDisconnectedSensorsEmailSpy).not.toHaveBeenCalled();

        // Verificar que NO se actualiza last_alert_sent en la BD
        const finalState = await getChannelState(TEST_CHANNEL_ID);
        expect(finalState.last_alert_sent.getTime()).toBe(alertTimestamp.getTime());
    });
});
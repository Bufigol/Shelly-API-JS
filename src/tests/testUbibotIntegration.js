// src/tests/testUbibotIntegration.js

const ubibotService = require('../services/ubibotService');
const notificationController = require('../controllers/notificationController');
const mysql = require('mysql2/promise');
const config = require('../config/js_files/config-loader');

/**
 * Script para probar la integración entre UbibotService y NotificationController
 */
async function runIntegrationTests() {
    console.log('=== Test de Integración UbibotService - NotificationController ===');
    console.log('Hora actual:', new Date().toLocaleString());

    // Crear conexión directa a la base de datos para las pruebas
    const pool = mysql.createPool({
        host: config.getConfig().database.host,
        user: config.getConfig().database.username,
        password: config.getConfig().database.password,
        database: config.getConfig().database.database,
        waitForConnections: true,
        connectionLimit: 2,
        queueLimit: 0,
    });

    try {
        // Prueba 1: Simular datos de un canal
        console.log('\n1. Simulando datos de un canal:');
        const mockChannelData = {
            channel_id: '9999',
            name: 'Canal de integración',
            product_id: 'WS1Pro',
            device_id: 'test-device',
            latitude: 0,
            longitude: 0,
            firmware: '1.0.0',
            mac_address: '00:00:00:00:00:00',
            last_entry_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
            net: '0' // Offline
        };

        // Verificar si el canal ya existe y eliminarlo para la prueba
        const [existingChannel] = await pool.query(
            'SELECT * FROM channels_ubibot WHERE channel_id = ?',
            [mockChannelData.channel_id]
        );

        if (existingChannel.length > 0) {
            console.log(`El canal de prueba ya existe, eliminándolo...`);
            await pool.query(
                'DELETE FROM channels_ubibot WHERE channel_id = ?',
                [mockChannelData.channel_id]
            );
        }

        // Insertar dato de prueba en la tabla de parametrizaciones si no existe
        const [existingParam] = await pool.query(
            'SELECT * FROM parametrizaciones WHERE param_id = 9999'
        );

        if (existingParam.length === 0) {
            console.log(`Insertando parámetro de prueba...`);
            await pool.query(
                'INSERT INTO parametrizaciones (param_id, nombre_parametro, minimo, maximo) VALUES (?, ?, ?, ?)',
                [9999, 'Test param', -20.0, -16.0]
            );
        }

        // Insertar canal de prueba con esOperativa = 1
        await pool.query(`
            INSERT INTO channels_ubibot (
                channel_id, name, product_id, device_id, latitude, longitude, 
                firmware, mac_address, last_entry_date, created_at,
                is_currently_out_of_range, esOperativa, id_parametrizacion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            mockChannelData.channel_id,
            mockChannelData.name,
            mockChannelData.product_id,
            mockChannelData.device_id,
            mockChannelData.latitude,
            mockChannelData.longitude,
            mockChannelData.firmware,
            mockChannelData.mac_address,
            new Date(mockChannelData.last_entry_date),
            new Date(mockChannelData.created_at),
            1, // is_currently_out_of_range
            1, // esOperativa
            9999 // id_parametrizacion
        ]);

        console.log(`Canal de prueba insertado.`);

        // Prueba 2: Procesar datos del canal
        console.log('\n2. Procesando datos del canal:');
        await ubibotService.processChannelData(mockChannelData);

        // Prueba 3: Simular lecturas del sensor
        console.log('\n3. Simulando lecturas del sensor:');
        const mockLastValues = {
            field1: {
                value: '25.0',
                created_at: new Date().toISOString()
            },
            field2: {
                value: '45.0',
                created_at: new Date().toISOString()
            },
            field3: {
                value: '1000',
                created_at: new Date().toISOString()
            },
            field4: {
                value: '3.3',
                created_at: new Date().toISOString()
            },
            field5: {
                value: '-65',
                created_at: new Date().toISOString()
            },
            field8: {
                value: '-15.0', // Temperatura fuera del rango
                created_at: new Date().toISOString()
            }
        };

        await ubibotService.processSensorReadings(mockChannelData.channel_id, mockLastValues);

        // Verificar contadores en el controlador de notificaciones
        console.log('\nContadores de temperatura:');
        console.log(notificationController.tempAlertCounters[mockChannelData.channel_id] || 'No hay contador para este canal');

        // Prueba 4: Simular más lecturas fuera de rango para alcanzar 3 ciclos
        console.log('\n4. Simulando 2 lecturas más fuera de rango:');

        for (let i = 0; i < 2; i++) {
            console.log(`\nLectura adicional ${i + 1}/2:`);
            mockLastValues.field8.created_at = new Date().toISOString();
            await ubibotService.processSensorReadings(mockChannelData.channel_id, mockLastValues);
        }

        // Verificar búfer de alertas
        console.log('\nBúfer de alertas de temperatura:');
        console.log(`- Alertas en búfer: ${notificationController.temperatureAlertBuffer.alerts.length}`);

        // Prueba 5: Limpiar después de la prueba
        console.log('\n5. Limpiando datos de prueba:');
        await pool.query(
            'DELETE FROM channels_ubibot WHERE channel_id = ?',
            [mockChannelData.channel_id]
        );

        console.log(`Canal de prueba eliminado.`);

    } catch (error) {
        console.error('Error durante las pruebas de integración:', error);
    } finally {
        // Cerrar conexión
        await pool.end();
    }

    console.log('\n=== Pruebas de integración completadas ===');
}

// Ejecutar pruebas
runIntegrationTests()
    .then(() => {
        console.log('Script de prueba finalizado correctamente.');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error durante las pruebas de integración:', error);
        process.exit(1);
    });
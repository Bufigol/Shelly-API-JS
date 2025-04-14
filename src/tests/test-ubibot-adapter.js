// test-ubibot-adapter.js
const ubibotServiceAdapter = require('../services/ubibot/ubibot-service-adapter');
const configLoader = require('../config/js_files/config-loader');

/**
 * Script para probar el adaptador de servicio Ubibot
 * Este script verifica la configuración y las funcionalidades básicas
 */
async function testUbibotAdapter() {
    console.log('>> INICIANDO PRUEBA DE ADAPTADOR UBIBOT');

    // 1. Verificar estado del adaptador
    console.log('\n1. ESTADO DEL ADAPTADOR UBIBOT');
    console.log(`Adaptador inicializado: ${ubibotServiceAdapter.initialized ? '✓' : '✗'}`);
    console.log(`Configuración válida: ${ubibotServiceAdapter.isConfigured() ? '✓' : '✗'}`);

    if (!ubibotServiceAdapter.isConfigured()) {
        console.log('\n⚠️ El adaptador Ubibot no está correctamente configurado.');
        console.log('Comprobando configuración en archivo unificado...');

        const config = configLoader.getConfig();
        console.log(`- Configuración Ubibot presente: ${config.ubibot ? '✓' : '✗'}`);
        console.log(`- Account Key: ${config.ubibot ? (config.ubibot.accountKey ? '✓' : '✗') : '✗'}`);
        console.log(`- Token File: ${config.ubibot ? (config.ubibot.tokenFile ? '✓' : '✗') : '✗'}`);

        return false;
    }

    // 2. Mostrar configuración
    console.log('\n2. CONFIGURACIÓN UBIBOT');
    console.log(`Account Key: ${ubibotServiceAdapter.config.accountKey.substring(0, 10)}...`);
    console.log(`Token File: ${ubibotServiceAdapter.config.tokenFile}`);
    console.log(`Intervalo de recolección: ${ubibotServiceAdapter.config.collectionInterval}ms`);
    console.log(`Zona horaria: ${ubibotServiceAdapter.timeZone}`);
    console.log('Canales excluidos:');
    if (ubibotServiceAdapter.config.excludedChannels.length > 0) {
        ubibotServiceAdapter.config.excludedChannels.forEach((channel, i) => {
            console.log(`- #${i + 1}: ${channel}`);
        });
    } else {
        console.log('- No hay canales excluidos');
    }

    // 3. Probar funcionalidad de zona horaria
    console.log('\n3. PRUEBA DE CONVERSIÓN DE ZONA HORARIA');
    const testUtcDate = new Date();
    console.log(`UTC: ${testUtcDate.toISOString()}`);
    const localTime = ubibotServiceAdapter.getLocalTime(testUtcDate);
    console.log(`${ubibotServiceAdapter.timeZone}: ${localTime.format()}`);

    // 4. Probar consulta a la base de datos
    console.log('\n4. PRUEBA DE CONEXIÓN A LA BASE DE DATOS');
    try {
        // Intentar obtener la última lectura de un canal (solo prueba de conexión)
        const result = await ubibotServiceAdapter.pool.query('SELECT 1 as test');
        console.log(`Conexión a la base de datos: ✓`);

        // Intentar obtener algunos canales para prueba
        try {
            const [channelsResult] = await ubibotServiceAdapter.pool.query(
                'SELECT channel_id, name FROM channels_ubibot LIMIT 5'
            );

            if (channelsResult.length > 0) {
                console.log('\nCanales disponibles para prueba:');
                channelsResult.forEach((channel, i) => {
                    console.log(`- ${channel.channel_id}: ${channel.name}`);
                });

                // Si hay canales, seleccionar uno para pruebas adicionales
                const testChannelId = channelsResult[0].channel_id;
                const testChannelName = channelsResult[0].name;

                console.log(`\nUsando canal para pruebas: ${testChannelName} (${testChannelId})`);

                // Obtener última lectura
                const lastReading = await ubibotServiceAdapter.getLastSensorReading(testChannelId);
                if (lastReading) {
                    console.log(`Última lectura: ${new Date(lastReading.external_temperature_timestamp).toLocaleString()}`);
                } else {
                    console.log('No se encontraron lecturas para este canal');
                }
            } else {
                console.log('No se encontraron canales para pruebas');
            }
        } catch (error) {
            console.error('Error al consultar canales:', error.message);
        }
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error.message);
        console.log('⚠️ Sin conexión a la base de datos, no se pueden realizar pruebas adicionales');
        return false;
    }

    // 5. Probar funcionalidad de procesamiento
    console.log('\n5. PRUEBA DE PROCESAMIENTO (SIMULADA)');
    // Crear datos de prueba
    const mockChannelData = {
        channel_id: 'test-channel-id',
        name: 'Canal de Prueba',
        product_id: 'WS1Pro',
        device_id: 'test-device',
        latitude: 0,
        longitude: 0,
        firmware: '1.0.0',
        mac_address: '00:00:00:00:00:00',
        last_entry_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        net: '1' // Online
    };

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
            value: '-15.0',
            created_at: new Date().toISOString()
        }
    };

    console.log('Simulando procesamiento de datos de canal...');
    console.log('Nota: Solo se muestran logs, no se realizan operaciones en BD');
    console.log(`Datos procesados para: ${mockChannelData.name} (${mockChannelData.channel_id})`);
    console.log(`Estado de conexión: ${mockChannelData.net === '1' ? 'En línea' : 'Fuera de línea'}`);
    console.log(`Temperatura (field8): ${mockLastValues.field8.value}°C`);
    console.log(`Timestamp: ${mockLastValues.field8.created_at}`);

    // 6. Cerrar conexiones
    console.log('\n6. CERRANDO CONEXIONES');
    await ubibotServiceAdapter.close();
    console.log('Conexiones cerradas');

    console.log('\n>> PRUEBA DE ADAPTADOR UBIBOT COMPLETADA');
    return true;
}

// Ejecutar la prueba si este script se ejecuta directamente
if (require.main === module) {
    testUbibotAdapter().catch(error => {
        console.error('Error en la prueba del adaptador Ubibot:', error);
        process.exit(1);
    });
}

module.exports = testUbibotAdapter;
// test-api-adapters.js
const shellyApiAdapter = require('../services/api/shelly-api-adapter');
const mapboxApiAdapter = require('../services/api/mapbox-api-adapter');
const configLoader = require('../config/js_files/config-loader');

// Función para probar el adaptador de Shelly API
function testShellyAdapter() {
    console.log('\n======= TEST SHELLY API ADAPTER =======');

    try {
        // Verificar inicialización
        console.log('Configuración del adaptador:');
        console.log(`- URL Base: ${shellyApiAdapter.config.baseUrl}`);
        console.log(`- Device ID: ${shellyApiAdapter.config.deviceId}`);
        console.log(`- Auth Key: ${shellyApiAdapter.config.authKey.substring(0, 10)}...`);

        // Probar construcción de URL
        const testUrl = shellyApiAdapter.getApiUrl('/test');
        console.log(`\nURL de prueba: ${testUrl}`);

        console.log('✅ Adaptador de Shelly API inicializado correctamente');
    } catch (error) {
        console.error('❌ Error en prueba de adaptador de Shelly API:', error.message);
    }
}

// Función para probar el adaptador de MapBox API
function testMapboxAdapter() {
    console.log('\n======= TEST MAPBOX API ADAPTER =======');

    try {
        // Verificar inicialización
        console.log('Configuración del adaptador:');
        const accessToken = mapboxApiAdapter.getAccessToken();
        console.log(`- Access Token: ${accessToken ? accessToken.substring(0, 15) + '...' : 'No configurado'}`);

        // Probar generación de URL de mapa estático
        try {
            const staticMapUrl = mapboxApiAdapter.getStaticMapUrl(-70.6693, -33.4489);
            console.log(`\nURL de mapa estático: ${staticMapUrl.substring(0, 60)}...`);
        } catch (error) {
            console.warn(`⚠️ No se pudo generar URL de mapa estático: ${error.message}`);
        }

        // Obtener configuración para el cliente
        try {
            const clientConfig = mapboxApiAdapter.getClientConfig();
            console.log('\nConfiguración para cliente:');
            console.log(`- Access Token: ${clientConfig.accessToken ? '✓ Configurado' : '✗ No configurado'}`);
            console.log(`- Map Style: ${clientConfig.mapStyle}`);
            console.log(`- Default Zoom: ${clientConfig.defaultZoom}`);
        } catch (error) {
            console.warn(`⚠️ No se pudo obtener configuración para cliente: ${error.message}`);
        }

        console.log('✅ Adaptador de MapBox API inicializado correctamente');
    } catch (error) {
        console.error('❌ Error en prueba de adaptador de MapBox API:', error.message);
    }
}

// Función para probar el comportamiento con cambio de entorno
async function testEnvironmentSwitch() {
    console.log('\n======= TEST CAMBIO DE ENTORNO =======');

    // Guardar el entorno actual
    const originalEnv = configLoader.getCurrentEnvironment().index;
    console.log(`Entorno original: ${configLoader.getCurrentEnvironment().name.toUpperCase()}`);

    try {
        // Cambiar de entorno
        const newEnvIndex = originalEnv === 0 ? 1 : 0;
        await configLoader.changeEnvironment(newEnvIndex);
        console.log(`Entorno cambiado a: ${configLoader.getCurrentEnvironment().name.toUpperCase()}`);

        // Recargar adaptadores
        shellyApiAdapter.reloadConfig();
        mapboxApiAdapter.reloadConfig();

        // Verificar configuración actualizada
        console.log('\nConfiguración actualizada de Shelly API:');
        console.log(`- URL Base: ${shellyApiAdapter.config.baseUrl}`);
        console.log(`- Device ID: ${shellyApiAdapter.config.deviceId}`);

        console.log('\nConfiguración actualizada de MapBox API:');
        const accessToken = mapboxApiAdapter.getAccessToken();
        console.log(`- Access Token: ${accessToken ? accessToken.substring(0, 15) + '...' : 'No configurado'}`);

        // Restaurar entorno original
        await configLoader.changeEnvironment(originalEnv);
        console.log(`\nEntorno restaurado a: ${configLoader.getCurrentEnvironment().name.toUpperCase()}`);
    } catch (error) {
        console.error('❌ Error en prueba de cambio de entorno:', error.message);

        // Asegurar restauración del entorno original
        await configLoader.changeEnvironment(originalEnv);
        console.log(`Entorno restaurado a: ${configLoader.getCurrentEnvironment().name.toUpperCase()}`);
    }
}

// Función principal
async function runTests() {
    console.log('>> INICIANDO PRUEBAS DE ADAPTADORES DE API');

    // Probar adaptador de Shelly API
    testShellyAdapter();

    // Probar adaptador de MapBox API
    testMapboxAdapter();

    // Probar cambio de entorno
    await testEnvironmentSwitch();

    console.log('\n>> PRUEBAS DE ADAPTADORES DE API COMPLETADAS');
}

// Ejecutar pruebas
runTests();
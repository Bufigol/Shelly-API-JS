// test-api-config.js
const configLoader = require('../config/js_files/config-loader');

// Función para mostrar la configuración de API
function printApiConfig() {
    const config = configLoader.getConfig();
    const env = config.environment.name;

    console.log('\n======= CONFIGURACIÓN DE API =======');
    console.log(`Entorno actual: ${env.toUpperCase()}`);
    console.log('---------------------------------------------');

    // Shelly Cloud API
    console.log('SHELLY CLOUD API:');
    console.log(`URL: ${config.api.url}`);
    console.log(`Device ID: ${config.api.device_id}`);
    console.log(`Auth Key: ${config.api.auth_key.substring(0, 10)}...`);
    console.log(`Intervalo de recolección: ${config.collection.interval}ms`);

    // MapBox API (si existe)
    if (config.api.mapbox_access_token) {
        console.log('\nMAPBOX API:');
        console.log(`Access Token: ${config.api.mapbox_access_token.substring(0, 15)}...`);
    }

    console.log('=============================================\n');
}

// Verificar que las rutas específicas funcionan correctamente
function testApiPaths() {
    console.log('Probando rutas específicas de configuración API:');

    // Probar acceso con getValue
    const apiUrl = configLoader.getValue('api.url');
    console.log(`- api.url: ${apiUrl ? '✓' : '✗'}`);

    const deviceId = configLoader.getValue('api.device_id');
    console.log(`- api.device_id: ${deviceId ? '✓' : '✗'}`);

    const authKey = configLoader.getValue('api.auth_key');
    console.log(`- api.auth_key: ${authKey ? '✓' : '✗'}`);

    const collectionInterval = configLoader.getValue('collection.interval');
    console.log(`- collection.interval: ${collectionInterval ? '✓' : '✗'}`);

    // Verificar compatibilidad con código existente
    console.log('\nVerificando compatibilidad con código existente que usa paths de configuración:');

    // Simular código que accede a la configuración con rutas antiguas
    try {
        const apiConfig = {
            url: configLoader.getValue('api.url'),
            deviceId: configLoader.getValue('api.device_id'),
            authKey: configLoader.getValue('api.auth_key')
        };

        console.log(`- Configuración API accesible: ${Object.values(apiConfig).every(v => v) ? '✓' : '✗'}`);
    } catch (error) {
        console.error(`- Error accediendo a configuración API: ${error.message}`);
    }
}

// Función principal
async function runTests() {
    console.log('>> PRUEBA DE CONFIGURACIÓN DE API');

    // Mostrar configuración actual
    printApiConfig();

    // Probar rutas específicas
    testApiPaths();

    console.log('\nPrueba de configuración de API completada.');
}

// Ejecutar pruebas
runTests();
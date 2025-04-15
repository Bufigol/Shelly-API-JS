// tests/setup.js
const path = require('path');
const fs = require('fs');

// Configurar variables de entorno para testing
process.env.NODE_ENV = 'test';

// Crear archivo de configuración temporal para pruebas si no existe
const testConfigFile = path.join(__dirname, '../unified-config.test.json');

// Cargar configuración original
let originalConfig;
try {
    originalConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../unified-config.json'), 'utf8'));
} catch (error) {
    console.error('Error al cargar la configuración original:', error);
    process.exit(1);
}

// Crear una copia modificada para pruebas
const testConfig = JSON.parse(JSON.stringify(originalConfig));
testConfig.email.sendgrid_api_key = 'SG.test-api-key-for-integration-tests';

// Guardar configuración de prueba
fs.writeFileSync(testConfigFile, JSON.stringify(testConfig, null, 2), 'utf8');

// Función para limpiar archivos temporales después de las pruebas
afterAll(() => {
    // Eliminar archivo de configuración temporal
    try {
        fs.unlinkSync(testConfigFile);
        console.log('Archivo de configuración temporal eliminado correctamente');
    } catch (error) {
        console.error('Error al eliminar archivo de configuración temporal:', error);
    }
});

// Mock para config-loader para que use el archivo de prueba
jest.mock('../../src/config/js_files/config-loader', () => {
    const actual = jest.requireActual('../src/config/js_files/config-loader');

    // Sobreescribir getConfig para usar la configuración de prueba
    actual.getConfig = jest.fn().mockImplementation(() => {
        try {
            return JSON.parse(fs.readFileSync(testConfigFile, 'utf8'));
        } catch (error) {
            console.error('Error al cargar la configuración de prueba:', error);
            return actual.getConfig.mockRestore()();
        }
    });

    // Mantener las demás funciones sin cambios
    return actual;
});
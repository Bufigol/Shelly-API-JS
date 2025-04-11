// test-db-config.js
const configLoader = require("../config/js_files/config-loader");

// Función para mostrar la configuración de base de datos actual
function printDatabaseConfig() {
    const config = configLoader.getConfig();
    const env = config.environment.name;

    console.log('\n======= CONFIGURACIÓN DE BASE DE DATOS =======');
    console.log(`Entorno actual: ${env.toUpperCase()}`);
    console.log('---------------------------------------------');
    console.log(`Host: ${config.database.host}`);
    console.log(`Puerto: ${config.database.port}`);
    console.log(`Base de datos: ${config.database.database}`);
    console.log(`Usuario: ${config.database.username}`);
    console.log(`Contraseña: ${'*'.repeat(config.database.password.length)}`);
    console.log(`Tamaño del pool: ${config.database.pool.max_size}`);
    console.log('=============================================\n');

    // Verificar que los objetos 'database' y 'databases.main' son idénticos
    const identical = JSON.stringify(config.database) === JSON.stringify(config.databases.main);
    console.log(`Compatibilidad con código existente (database === databases.main): ${identical ? '✓ OK' : '✗ ERROR'}`);
}

// Probar configuración de desarrollo
console.log('\n>> PRUEBA DE CONFIGURACIÓN DE DESARROLLO');
configLoader.changeEnvironment(0);
printDatabaseConfig();

// Probar configuración de producción
console.log('\n>> PRUEBA DE CONFIGURACIÓN DE PRODUCCIÓN');
configLoader.changeEnvironment(1);
printDatabaseConfig();

// Volver a desarrollo para dejar el sistema en estado inicial
console.log('\n>> VOLVIENDO A CONFIGURACIÓN DE DESARROLLO');
configLoader.changeEnvironment(0);
printDatabaseConfig();

console.log('\nPrueba de configuración de base de datos completada.');
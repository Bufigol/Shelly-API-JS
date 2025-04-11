// test-database-service.js
const databaseService = require('../services/database-service');
const config = require('../config/js_files/config-loader');

// Función para mostrar información del entorno actual
function printEnvironmentInfo() {
  const env = config.getCurrentEnvironment();
  const dbConfig = config.getConfig().database;
  
  console.log('\n======= ENTORNO ACTUAL =======');
  console.log(`Entorno: ${env.name.toUpperCase()} (${env.index})`);
  console.log(`Base de datos: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log('==============================\n');
}

// Función para probar la conexión a la base de datos
async function testDatabaseConnection() {
  console.log('Probando conexión a la base de datos...');
  
  try {
    // Inicializar servicio
    await databaseService.initialize();
    
    // Probar conexión
    const connected = await databaseService.testConnection();
    
    if (connected) {
      console.log('✅ Conexión exitosa a la base de datos');
      
      // Ejecutar una consulta de prueba
      console.log('Ejecutando consulta de prueba...');
      try {
        // Intenta obtener la versión de MySQL
        const results = await databaseService.query('SELECT VERSION() as version');
        console.log(`✅ Versión de MySQL: ${results[0].version}`);
        
        // Intenta contar algunas tablas (puede fallar si las tablas no existen, pero es informativo)
        try {
          const tables = await databaseService.query('SHOW TABLES');
          console.log(`✅ Número de tablas: ${tables.length}`);
          
          if (tables.length > 0) {
            console.log('Primeras 5 tablas:');
            tables.slice(0, 5).forEach(table => {
              const tableName = Object.values(table)[0];
              console.log(`  - ${tableName}`);
            });
          }
        } catch (error) {
          console.warn('⚠️ No se pudieron listar las tablas:', error.message);
        }
      } catch (error) {
        console.error('❌ Error en consulta de prueba:', error.message);
      }
    } else {
      console.error('❌ No se pudo conectar a la base de datos');
    }
    
    // Cerrar conexión
    await databaseService.close();
    console.log('Conexión cerrada');
    
  } catch (error) {
    console.error('❌ Error en la prueba de base de datos:', error.message);
  }
}

// Función principal asíncrona
async function runTests() {
  try {
    // 1. Probar entorno de desarrollo
    console.log('\n>> PRUEBA CON ENTORNO DE DESARROLLO');
    await config.changeEnvironment(0);
    printEnvironmentInfo();
    await testDatabaseConnection();
    
    // 2. Probar entorno de producción
    console.log('\n>> PRUEBA CON ENTORNO DE PRODUCCIÓN');
    await config.changeEnvironment(1);
    printEnvironmentInfo();
    await testDatabaseConnection();
    
    // 3. Probar el cambio de entorno desde el servicio de base de datos
    console.log('\n>> PRUEBA DE CAMBIO DE ENTORNO DESDE EL SERVICIO');
    console.log('Cambiando a entorno de desarrollo mediante databaseService.switchEnvironment(0)');
    await databaseService.switchEnvironment(0);
    printEnvironmentInfo();
    
    console.log('\nPruebas completadas');
  } catch (error) {
    console.error('Error durante las pruebas:', error);
  }
}

// Ejecutar pruebas
runTests();
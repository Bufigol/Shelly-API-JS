// test-jwt.js
const jwtConfigLoader = require('../config/js_files/jwt-config-loader');
const jwtService = require('../services/jwt-service');
const configLoader = require('../config/js_files/config-loader');

// Función para mostrar información de la configuración JWT
function printJwtConfig() {
  const config = jwtConfigLoader.getJwtConfig();
  
  console.log('\n======= CONFIGURACIÓN JWT =======');
  console.log(`Secret: ${config.secret.substring(0, 15)}...`);
  console.log(`Legacy Secret: ${config.legacy_secret ? config.legacy_secret.substring(0, 15) + '...' : 'No configurado'}`);
  console.log(`Issuer: ${config.issuer}`);
  console.log(`Expiration: ${config.expires_in}`);
  console.log('==================================\n');
}

// Función para probar la generación y verificación de tokens
function testTokenOperations() {
  console.log('\n======= PRUEBA DE OPERACIONES JWT =======');
  
  // Crear payload de prueba
  const testPayload = {
    userId: 12345,
    username: 'usuario_prueba',
    roles: ['admin', 'user'],
    createdAt: new Date().toISOString()
  };
  
  console.log('Payload de prueba:');
  console.log(JSON.stringify(testPayload, null, 2));
  
  try {
    // Generar token
    console.log('\nGenerando token JWT...');
    const token = jwtService.generateToken(testPayload);
    console.log(`Token generado: ${token.substring(0, 20)}...`);
    
    // Decodificar token
    console.log('\nDecodificando token (sin verificar)...');
    const decodedComplete = jwtService.decodeToken(token);
    const decodedHeader = decodedComplete.header || {};
    const decodedPayload = decodedComplete.payload || decodedComplete;
    
    console.log('Header:');
    console.log(JSON.stringify(decodedHeader, null, 2));
    
    console.log('Payload decodificado:');
    // Extraer timestamps para mostrarlos separadamente
    const { exp, iat, ...payloadWithoutTimestamps } = decodedPayload;
    console.log(JSON.stringify(payloadWithoutTimestamps, null, 2));
    
    // Mostrar timestamps como fechas si existen
    if (iat) {
      console.log(`Expedido el: ${new Date(iat * 1000).toLocaleString()}`);
    }
    if (exp) {
      console.log(`Expira el: ${new Date(exp * 1000).toLocaleString()}`);
    }
    
    // Verificar token
    console.log('\nVerificando token...');
    const verified = jwtService.verifyToken(token);
    console.log('Token verificado correctamente');
    
    // Verificar expiración
    const isExpiringSoon = jwtService.isTokenExpiringSoon(token, 30);
    console.log(`\n¿El token expira pronto (en 30 min)?: ${isExpiringSoon ? 'Sí' : 'No'}`);
    
    // Renovar token
    console.log('\nRenovando token con datos adicionales...');
    const additionalData = { lastRenewal: new Date().toISOString() };
    const renewedToken = jwtService.renewToken(token, additionalData);
    console.log(`Nuevo token: ${renewedToken.substring(0, 20)}...`);
    
    // Verificar token renovado
    const renewedDecoded = jwtService.decodeToken(renewedToken);
    const renewedPayload = renewedDecoded.payload || renewedDecoded;
    
    console.log('\nDatos del token renovado:');
    console.log(JSON.stringify(renewedPayload, null, 2));
    
    // Mostrar nueva fecha de expiración si existe
    if (renewedPayload.exp) {
      console.log(`Nueva fecha de expiración: ${new Date(renewedPayload.exp * 1000).toLocaleString()}`);
    }
    
    console.log('\n✅ Todas las operaciones JWT completadas correctamente');
  } catch (error) {
    console.error(`\n❌ Error en operaciones JWT: ${error.message}`);
  }
}

// Función para probar cambio de entorno
async function testEnvironmentSwitch() {
  console.log('\n======= PRUEBA DE CAMBIO DE ENTORNO =======');
  
  // Guardar configuración original
  const originalEnv = configLoader.getCurrentEnvironment().index;
  
  try {
    // Generar token con configuración actual
    const testPayload = { test: 'dato de prueba', env: originalEnv };
    const originalToken = jwtService.generateToken(testPayload);
    console.log(`Token con entorno ${originalEnv}: ${originalToken.substring(0, 20)}...`);
    
    // Cambiar de entorno
    const newEnvIndex = originalEnv === 0 ? 1 : 0;
    console.log(`\nCambiando a entorno ${newEnvIndex}...`);
    await configLoader.changeEnvironment(newEnvIndex);
    
    // Recargar configuración JWT
    jwtService.reloadConfig();
    
    // Generar nuevo token con la nueva configuración
    const newToken = jwtService.generateToken(testPayload);
    console.log(`Token con entorno ${newEnvIndex}: ${newToken.substring(0, 20)}...`);
    
    // Intentar verificar tokens con diferentes configuraciones
    console.log('\nVerificando tokens con diferentes configuraciones:');
    try {
      jwtService.verifyToken(originalToken);
      console.log('✅ Token original verificado con nueva configuración');
    } catch (error) {
      console.log(`❌ No se pudo verificar token original: ${error.message}`);
    }
    
    // Restaurar entorno original
    await configLoader.changeEnvironment(originalEnv);
    jwtService.reloadConfig();
    console.log(`\nEntorno restaurado a ${originalEnv}`);
    
  } catch (error) {
    console.error(`\n❌ Error en prueba de cambio de entorno: ${error.message}`);
    
    // Asegurar que se restaure el entorno original
    await configLoader.changeEnvironment(originalEnv);
  }
}

// Función principal
async function runTests() {
  console.log('>> INICIANDO PRUEBAS DE JWT');
  
  // Mostrar configuración JWT
  printJwtConfig();
  
  // Probar operaciones con tokens
  testTokenOperations();
  
  // Probar cambio de entorno
  await testEnvironmentSwitch();
  
  console.log('\n>> PRUEBAS DE JWT COMPLETADAS');
}

// Ejecutar pruebas
runTests();
// src/tests/emailServiceTest.js
const emailService = require('../services/emailService');
const moment = require('moment-timezone');

/**
 * Archivo de pruebas para el servicio de correo electrónico
 * Verifica todos los métodos y escenarios posibles
 */

// Configuración para las pruebas
const TEST_RECIPIENTS = ['f.vasquez.tort@gmail.com', 'felipev7450@gmail.com'];
const TEST_PREFIX = '[PRUEBA]'; // Para identificar fácilmente los correos de prueba

// Función para ejecutar todas las pruebas
async function runAllTests() {
  console.log('========================================');
  console.log('  INICIANDO PRUEBAS DE EMAIL SERVICE   ');
  console.log('========================================');
  
  try {
    // Pruebas de inicialización y configuración
    await testInitialization();
    
    // Pruebas de validación de horario laboral
    testWorkingHours();
    
    // Pruebas de envío de correos
    await testPasswordResetEmail();
    await testPasswordResetConfirmationEmail();
    await testTemperatureAlerts();
    await testDisconnectedSensors();
    await testIntrusionAlert();
    await testGenericEmail();
    
    console.log('\n✅ TODAS LAS PRUEBAS COMPLETADAS');
  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS:', error);
  }
  
  console.log('========================================');
}

// Prueba de inicialización del servicio
async function testInitialization() {
  console.log('\n📋 Prueba: Inicialización del servicio');
  
  try {
    // Verificar inicialización
    const initResult = emailService.initialize();
    console.log('Inicialización:', initResult ? '✅ Exitosa' : '❌ Fallida');
    
    // Verificar configuración
    const isConfigured = emailService.isConfigured();
    console.log('Configuración:', isConfigured ? '✅ Correcta' : '❌ Incorrecta');
    
    // Mostrar horarios laborales
    console.log(`Horarios laborales: ${emailService.getWorkingHoursDescription()}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de inicialización:', error);
    throw error;
  }
}

// Prueba de verificación de horario laboral
function testWorkingHours() {
  console.log('\n📋 Prueba: Verificación de horario laboral');
  
  const timezone = 'America/Santiago';
  const testCases = [
    // Días laborables dentro y fuera de horario
    { day: 1, hour: 8, min: 0, expected: false, desc: 'Lunes 08:00 (fuera de horario)' },
    { day: 1, hour: 8, min: 30, expected: true, desc: 'Lunes 08:30 (dentro de horario)' },
    { day: 1, hour: 12, min: 0, expected: true, desc: 'Lunes 12:00 (dentro de horario)' },
    { day: 1, hour: 18, min: 30, expected: true, desc: 'Lunes 18:30 (dentro de horario)' },
    { day: 1, hour: 18, min: 31, expected: false, desc: 'Lunes 18:31 (fuera de horario)' },
    { day: 5, hour: 9, min: 0, expected: true, desc: 'Viernes 09:00 (dentro de horario)' },
    
    // Sábado con horario especial
    { day: 6, hour: 8, min: 0, expected: false, desc: 'Sábado 08:00 (fuera de horario)' },
    { day: 6, hour: 8, min: 30, expected: true, desc: 'Sábado 08:30 (dentro de horario)' },
    { day: 6, hour: 12, min: 0, expected: true, desc: 'Sábado 12:00 (dentro de horario)' },
    { day: 6, hour: 14, min: 30, expected: true, desc: 'Sábado 14:30 (dentro de horario)' },
    { day: 6, hour: 14, min: 31, expected: false, desc: 'Sábado 14:31 (fuera de horario)' },
    
    // Domingo (siempre fuera de horario)
    { day: 0, hour: 10, min: 0, expected: false, desc: 'Domingo 10:00 (fuera de horario)' },
  ];
  
  for (const test of testCases) {
    // Crear fecha para prueba
    const testDate = moment().tz(timezone).day(test.day).hour(test.hour).minute(test.min).second(0);
    
    // Verificar si está dentro del horario laboral
    const result = emailService.isWithinWorkingHours(testDate);
    
    // Mostrar resultado
    const status = result === test.expected ? '✅' : '❌';
    console.log(`${status} ${test.desc} - Resultado: ${result}, Esperado: ${test.expected}`);
  }
}

// Prueba de envío de correo de restablecimiento de contraseña
async function testPasswordResetEmail() {
  console.log('\n📋 Prueba: Envío de correo de restablecimiento de contraseña');
  
  try {
    const email = TEST_RECIPIENTS[0];
    const resetToken = 'test-token-12345';
    const resetUrl = 'https://ejemplo.com/reset-password?token=test-token-12345';
    
    console.log(`Enviando correo de restablecimiento a: ${email}`);
    const result = await emailService.sendPasswordResetEmail(email, resetToken, resetUrl);
    
    console.log('Resultado:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    return result;
  } catch (error) {
    console.error('❌ Error en prueba de restablecimiento de contraseña:', error);
    throw error;
  }
}

// Prueba de envío de correo de confirmación de restablecimiento
async function testPasswordResetConfirmationEmail() {
  console.log('\n📋 Prueba: Envío de correo de confirmación de restablecimiento');
  
  try {
    const email = TEST_RECIPIENTS[0];
    
    console.log(`Enviando correo de confirmación a: ${email}`);
    const result = await emailService.sendPasswordResetConfirmationEmail(email);
    
    console.log('Resultado:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    return result;
  } catch (error) {
    console.error('❌ Error en prueba de confirmación de restablecimiento:', error);
    throw error;
  }
}

// Prueba de envío de alertas de temperatura
async function testTemperatureAlerts() {
  console.log('\n📋 Prueba: Envío de alertas de temperatura');
  
  try {
    // Datos de prueba
    const outOfRangeChannels = [
      { name: 'Cámara 1', temperature: -22.5, timestamp: new Date(), minThreshold: -20.0, maxThreshold: -16.0 },
      { name: 'Reefer A', temperature: -14.5, timestamp: new Date(), minThreshold: -18.0, maxThreshold: -15.0 },
      { name: 'Cámara 3', temperature: -9.8, timestamp: new Date(), minThreshold: -18.0, maxThreshold: -10.0 }
    ];
    
    // Prueba 1: Envío estándar en horario laboral
    console.log('1. Prueba de envío en horario laboral');
    
    // Crear una fecha dentro del horario laboral (lunes a las 10:00)
    const workingTimeDate = moment().day(1).hour(10).minute(0).second(0);
    
    let result = await emailService.sendTemperatureRangeAlertsEmail(
      outOfRangeChannels,
      workingTimeDate,
      TEST_RECIPIENTS,
      false // No forzar envío fuera de horario
    );
    
    console.log('Resultado en horario laboral:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    
    // Prueba 2: Envío fuera del horario laboral (sin forzar)
    console.log('\n2. Prueba de envío fuera de horario laboral (sin forzar)');
    
    // Crear una fecha fuera del horario laboral (domingo a las 10:00)
    const nonWorkingTimeDate = moment().day(0).hour(10).minute(0).second(0);
    
    result = await emailService.sendTemperatureRangeAlertsEmail(
      outOfRangeChannels,
      nonWorkingTimeDate,
      TEST_RECIPIENTS,
      false // No forzar envío fuera de horario
    );
    
    console.log('Resultado fuera de horario (sin forzar):', result ? '❌ Correo enviado (error)' : '✅ Correo no enviado (correcto)');
    
    // Prueba 3: Envío fuera del horario laboral (forzando)
    console.log('\n3. Prueba de envío fuera de horario laboral (forzando envío)');
    
    result = await emailService.sendTemperatureRangeAlertsEmail(
      outOfRangeChannels,
      nonWorkingTimeDate,
      TEST_RECIPIENTS,
      true // Forzar envío fuera de horario
    );
    
    console.log('Resultado fuera de horario (forzando):', result ? '✅ Correo enviado' : '❌ Error al enviar');
    
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de alertas de temperatura:', error);
    throw error;
  }
}

// Prueba de envío de alertas de sensores desconectados
async function testDisconnectedSensors() {
  console.log('\n📋 Prueba: Envío de alertas de sensores desconectados');
  
  try {
    // Crear datos de prueba con tiempos de desconexión diferentes
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    const disconnectedChannels = [
      { name: 'Cámara 2', lastConnectionTime: twoHoursAgo, disconnectionInterval: 60 },
      { name: 'Reefer B', lastConnectionTime: fourHoursAgo, disconnectionInterval: 90 }
    ];
    
    console.log(`Enviando alerta de ${disconnectedChannels.length} sensores desconectados a: ${TEST_RECIPIENTS.join(', ')}`);
    
    // Las alertas de sensores desconectados se envían independientemente del horario
    const result = await emailService.sendDisconnectedSensorsEmail(
      disconnectedChannels,
      TEST_RECIPIENTS
    );
    
    console.log('Resultado:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    return result;
  } catch (error) {
    console.error('❌ Error en prueba de sensores desconectados:', error);
    throw error;
  }
}

// Prueba de envío de alertas de intrusión
async function testIntrusionAlert() {
  console.log('\n📋 Prueba: Envío de alertas de intrusión');
  
  try {
    // Datos de prueba
    const sector = `${TEST_PREFIX} Zona de Prueba`;
    const intruderInfo = 'Beacon de prueba (ID: TEST-12345)';
    const timestamp = new Date();
    
    console.log(`Enviando alerta de intrusión a: ${TEST_RECIPIENTS.join(', ')}`);
    
    // Las alertas de intrusión se envían independientemente del horario
    const result = await emailService.sendIntrusionAlertEmail(
      sector,
      intruderInfo,
      timestamp,
      TEST_RECIPIENTS,
      true // Alta prioridad
    );
    
    console.log('Resultado:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    return result;
  } catch (error) {
    console.error('❌ Error en prueba de alerta de intrusión:', error);
    throw error;
  }
}

// Prueba de envío de correo genérico
async function testGenericEmail() {
  console.log('\n📋 Prueba: Envío de correo genérico');
  
  try {
    // Datos de prueba
    const subject = `${TEST_PREFIX} Correo de prueba`;
    const textContent = 'Este es un correo de prueba enviado desde el sistema de pruebas.';
    
    // Contenido HTML más elaborado
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e1e1e1; border-radius: 5px;">
        <h2 style="color: #333;">Correo HTML de Prueba</h2>
        <p>Este es un correo de prueba con formato <strong>HTML</strong>.</p>
        <ul>
          <li>Prueba 1: Envío básico</li>
          <li>Prueba 2: Verificación de formato</li>
          <li>Prueba 3: Prueba de firma automática</li>
        </ul>
        <p style="margin-top: 20px; font-style: italic;">Este mensaje es generado automáticamente por el sistema de pruebas.</p>
      </div>
    `;
    
    // Prueba 1: Correo de texto plano
    console.log('1. Prueba de correo de texto plano');
    let result = await emailService.sendGenericEmail(
      subject + ' (Texto Plano)',
      textContent,
      TEST_RECIPIENTS,
      false, // No es HTML
      { category: 'test' }
    );
    console.log('Resultado texto plano:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    
    // Prueba 2: Correo HTML
    console.log('\n2. Prueba de correo HTML');
    result = await emailService.sendGenericEmail(
      subject + ' (HTML)',
      htmlContent,
      TEST_RECIPIENTS,
      true, // Es HTML
      { 
        highPriority: true,
        category: 'test-html'
      }
    );
    console.log('Resultado HTML:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    
    // Prueba 3: Correo con un solo destinatario (string en lugar de array)
    console.log('\n3. Prueba de correo con un solo destinatario');
    result = await emailService.sendGenericEmail(
      subject + ' (Un solo destinatario)',
      textContent,
      TEST_RECIPIENTS[0], // Un solo destinatario
      false
    );
    console.log('Resultado un destinatario:', result ? '✅ Correo enviado' : '❌ Error al enviar');
    
    return true;
  } catch (error) {
    console.error('❌ Error en prueba de correo genérico:', error);
    throw error;
  }
}

// Ejecutar todas las pruebas
runAllTests().catch(error => {
  console.error('Error ejecutando las pruebas:', error);
  process.exit(1);
});
// jest.config.js
module.exports = {
    setupFilesAfterEnv: ['<rootDir>/src/tests/test_notificaciones/setup.js'],
    testEnvironment: 'node', // Ya es el default, pero para ser explícito
    clearMocks: true, // Puede ser útil para aislar mocks entre tests
  };
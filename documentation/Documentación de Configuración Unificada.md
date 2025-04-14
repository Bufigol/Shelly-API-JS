# Documentación de Configuración Unificada

## Introducción

Este documento describe el sistema de configuración unificada implementado para centralizar y simplificar la administración de la configuración en diferentes entornos (desarrollo y producción).

## Estructura del Archivo de Configuración

La configuración está centralizada en un único archivo JSON llamado `unified-config.json` ubicado en la carpeta `src/config/jsons/`. Este archivo contiene todas las configuraciones necesarias para el sistema, organizadas jerárquicamente por categoría funcional.

### Estructura Principal

```json
{
  "environment": {
    "current": 0,
    "labels": ["development", "production"]
  },
  "database": { ... },
  "api": { ... },
  "jwt": { ... },
  "email": { ... },
  "sms": { ... },
  "twilio": { ... },
  "ubibot": { ... },
  "precios_energia": { ... },
  "alertSystem": { ... },
  "appInfo": { ... }
}
```

### Secciones Principales

#### Environment

Esta sección controla qué entorno está actualmente activo:

```json
"environment": {
  "current": 0,  // 0 = desarrollo, 1 = producción
  "labels": ["development", "production"]
}
```

#### Database

Contiene la configuración de base de datos para ambos entornos:

```json
"database": {
  "development": {
    "host": "localhost",
    "port": 3306,
    "database": "testingshelly",
    "username": "root",
    "password": "admin",
    "driver": "com.mysql.cj.jdbc.Driver",
    "pool": {
      "max_size": 10,
      "timeout": 30
    }
  },
  "production": {
    "host": "192.168.1.119",
    "port": 3306,
    "database": "teltonika",
    "username": "root",
    "password": "Clev2.Thenext1",
    "driver": "com.mysql.cj.jdbc.Driver",
    "pool": {
      "max_size": 10,
      "timeout": 30
    }
  }
}
```

#### API

Configuración para las APIs del sistema:

```json
"api": {
  "shelly_cloud": {
    "url": "https://shelly-141-eu.shelly.cloud/device/status",
    "device_id": "fce8c0d82d08",
    "auth_key": "MmFiZjhhdWlk034B5775CD00678BED88307AC12C6AC61723EFAF4CAAA56938B9C142DED8A06FF450DDDB07437418",
    "collection_interval": 10000
  },
  "mapbox": {
    "access_token": "pk.eyJ1IjoidGhlbmV4dHNlY3VyaXR5IiwiYSI6ImNsd3YxdmhkeDBqZDgybHB2OTh4dmo3Z2EifQ.bpZlTBTa56pF4cPhE3aSzg"
  }
}
```

#### JWT

Configuración para autenticación JWT:

```json
"jwt": {
  "secret": "89119f44efa937e2b7004497cb854a7073a2af48f77736a6e2d0d76bf80a2981",
  "issuer": "TNS_TRACK",
  "expires_in": "1h",
  "legacy_secret": "Shelly-API-JS-Pao-Secret-Key"
}
```

#### Email

Configuración del servicio de correo electrónico:

```json
"email": {
  "sendgrid_api_key": "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",
  "email_contacto": {
    "from_verificado": "f.vasquez.tort@proton.me",
    "destinatarios": [
      "felipev7450@gmail.com",
      "f.vasquez.tort@gmail.com"
    ]
  }
}
```

#### SMS

Configuración del servicio de SMS:

```json
"sms": {
  "modem": {
    "url": "http://192.168.1.140",
    "apiPath": "/api",
    "host": "192.168.8.1",
    "timeout": 15000,
    "retry": {
      "maxRetries": 2,
      "retryDelays": [10000, 7000],
      "timeBetweenRecipients": 8000
    }
  },
  "workingHours": {
    "weekdays": {
      "start": 8.5,
      "end": 18.5
    },
    "saturday": {
      "start": 8.5,
      "end": 14.5
    }
  },
  "timeZone": "America/Santiago",
  "queue": {
    "maxAgeHours": 24,
    "maxSizePerBatch": 3
  },
  "recipients": {
    "disconnectionAlerts": ["+56985202590"],
    "default": [
      "+56967684626",
      "+56985202590",
      "+56933761877"
    ]
  }
}
```

#### Ubibot

Configuración del servicio Ubibot:

```json
"ubibot": {
  "account_key": "2bb378b1b4e0b210b3974a02b9d5b4d0",
  "token_file": "./src/config/token_id.txt",
  "excluded_channels": ["80005"],
  "collection_interval": 300000
}
```

#### Alert System

Configuración del sistema de alertas:

```json
"alertSystem": {
  "timeZone": "America/Santiago",
  "workingHours": {
    "weekdays": { 
      "start": 8.5, 
      "end": 18.5 
    },
    "saturday": { 
      "start": 8.5, 
      "end": 14.5 
    }
  },
  "intervals": {
    "processing": 3600000,
    "cleanup": 43200000,
    "temperature": {
      "initialDelay": 60,
      "betweenAlerts": 60
    },
    "disconnection": {
      "initialDelay": 60,
      "betweenAlerts": 60
    }
  },
  "retention": {
    "maxAgeHours": 24
  }
}
```

## Cargador de Configuración

La configuración se carga y gestiona mediante la clase `ConfigLoader` ubicada en `src/config/js_files/config-loader.js`. Esta clase proporciona métodos para:

1. Cargar la configuración: `getConfig()`
2. Recargar la configuración: `reloadConfig()`
3. Cambiar entre entornos: `changeEnvironment(envIndex)`
4. Obtener valores específicos: `getValue(path)`
5. Verificar si existe una configuración: `hasConfig(path)`
6. Obtener información del entorno actual: `getCurrentEnvironment()`
7. Actualizar valores específicos: `updateConfigValue(path, value)`

### Ejemplos de Uso

#### Cargar Configuración

```javascript
const config = require('./src/config/js_files/config-loader');
const appConfig = config.getConfig();

// Acceder a configuración de base de datos
const dbHost = appConfig.database.host;
```

#### Cambiar Entre Entornos

```javascript
// Cambiar a entorno de producción
config.changeEnvironment(1);

// Cambiar a entorno de desarrollo
config.changeEnvironment(0);
```

#### Acceder a Valores Específicos

```javascript
// Acceder a la URL de la API
const apiUrl = config.getValue('api.url');

// Verificar si existe una configuración
const hasSendgridKey = config.hasConfig('email.sendgrid_api_key');
```

#### Actualizar Valores

```javascript
// Actualizar un valor específico
config.updateConfigValue('email.sendgrid_api_key', 'nueva-api-key');
```

## Adaptadores de Servicio

Para facilitar el uso de la configuración, se han implementado adaptadores específicos para cada servicio. Estos adaptadores proporcionan una interfaz simplificada para interactuar con los diferentes servicios utilizando la configuración unificada.

### Email Service Adapter

Ubicación: `src/services/email/email-service-adapter.js`

Proporciona métodos para enviar diferentes tipos de correos electrónicos:

```javascript
const emailAdapter = require('./src/services/email/email-service-adapter');

// Enviar correo genérico
await emailAdapter.sendGenericEmail(
  'Asunto',
  'Contenido',
  ['destinatario@ejemplo.com'],
  false, // No es HTML
  { categories: ['test'] }
);

// Enviar alerta de temperatura
await emailAdapter.sendTemperatureAlert(outOfRangeChannels);
```

### SMS Service Adapter

Ubicación: `src/services/sms/sms-service-adapter.js`

Proporciona métodos para enviar SMS y gestionar colas de mensajes:

```javascript
const smsAdapter = require('./src/services/sms/sms-service-adapter');

// Enviar SMS simple
await smsAdapter.sendSMS(
  'Mensaje de prueba',
  ['+1234567890'],
  true // Forzar envío fuera de horario laboral
);

// Agregar alerta a la cola
smsAdapter.addTemperatureAlertToQueue(
  'Cámara 1',
  -22.5,
  new Date().toISOString(),
  -20.0,
  -16.0
);

// Procesar cola de alertas
await smsAdapter.processTemperatureAlertQueue(true);
```

### Ubibot Service Adapter

Ubicación: `src/services/ubibot/ubibot-service-adapter.js`

Proporciona métodos para procesar datos de Ubibot:

```javascript
const ubibotAdapter = require('./src/services/ubibot/ubibot-service-adapter');

// Procesar datos de un canal
await ubibotAdapter.processChannelData(channelData);

// Procesar lecturas de sensor
await ubibotAdapter.processSensorReadings(channelId, lastValues);
```

### JWT Service

Ubicación: `src/services/jwt-service.js`

Proporciona métodos para gestionar tokens JWT:

```javascript
const jwtService = require('./src/services/jwt-service');

// Generar token
const token = jwtService.generateToken({ userId: 123 });

// Verificar token
const decoded = jwtService.verifyToken(token);

// Renovar token
const newToken = jwtService.renewToken(token, { additionalData: 'value' });
```

## Scripts de Prueba

Se han implementado diversos scripts para probar el sistema de configuración y los adaptadores:

1. **Test Config-Email Integration**: `test-config-email-integration.js`
2. **Test Database Configuration**: `test-db-config.js` 
3. **Test Database Service**: `test-database-service.js`
4. **Test JWT**: `test-jwt.js`
5. **Test SMS Adapter**: `test-sms-adapter.js`
6. **Test Ubibot Adapter**: `test-ubibot-adapter.js`

Estos scripts proporcionan ejemplos de cómo utilizar los diferentes componentes del sistema y verificar su correcto funcionamiento.

## Migración desde Configuración Antigua

Si tienes código que utiliza configuraciones antiguas, deberás migrar a la nueva estructura. Aquí hay algunas guías:

### Para Configuración de Base de Datos

Antiguo:
```javascript
const db = require('../config/database');
```

Nuevo:
```javascript
const config = require('../config/js_files/config-loader');
const dbConfig = config.getConfig().database;
```

### Para Configuración de Correo

Antiguo:
```javascript
const sgConfig = require('../config/sgMailConfig');
```

Nuevo:
```javascript
const emailAdapter = require('../services/email/email-service-adapter');
```

### Para Configuración de SMS

Antiguo:
```javascript
const smsConfig = require('../config/smsConfig');
```

Nuevo:
```javascript
const smsAdapter = require('../services/sms/sms-service-adapter');
```

## Consideraciones Adicionales

- **Entorno Activo**: Recuerda que la configuración depende del entorno activo (desarrollo o producción). Asegúrate de configurar el entorno correcto antes de desplegar en producción.
- **Valores Sensibles**: Aunque las credenciales están centralizadas en un único archivo, se recomienda no incluir este archivo en el control de versiones y utilizar archivos de ejemplo o variables de entorno para valores sensibles.
- **Backups**: Realiza backups del archivo de configuración antes de hacer cambios importantes.

## Solución de Problemas

### Problemas de Conexión a Base de Datos

Si hay problemas conectando a la base de datos:

1. Verifica el entorno activo: `config.getCurrentEnvironment()`
2. Verifica la configuración de la base de datos: `config.getValue('database')`
3. Prueba la conexión: `databaseService.testConnection()`

### Problemas de Envío de Correos

Si hay problemas enviando correos:

1. Verifica la API key de SendGrid: `config.getValue('email.sendgrid_api_key')`
2. Comprueba si el adaptador está configurado: `emailAdapter.isConfigured()`
3. Prueba con el script: `node src/tests/test-config-email-integration.js`

### Problemas de Envío de SMS

Si hay problemas enviando SMS:

1. Verifica la conexión al módem: `smsAdapter.checkModemConnection()`
2. Comprueba si el adaptador está configurado: `smsAdapter.isConfigured()`
3. Prueba con el script: `node src/tests/test-sms-adapter.js`
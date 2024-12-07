# Shelly Energy Monitor

## 📊 Descripción
Shelly Energy Monitor es una aplicación web diseñada para monitorear y analizar el consumo de energía eléctrica utilizando dispositivos Shelly Pro 3 EM. La aplicación proporciona una solución completa para la recolección, análisis y visualización de datos de consumo energético, permitiendo a los usuarios realizar un seguimiento detallado de su consumo eléctrico y los costos asociados.

## ✨ Características Principales

### Monitoreo en Tiempo Real
- 📈 Captura de mediciones eléctricas en tiempo real
- 💾 Almacenamiento automático en base de datos MySQL
- 🔄 Actualización continua de datos

### Análisis de Datos
- 📊 Cálculo de promedios de consumo
- 💰 Seguimiento de costos monetarios
- 📈 Estadísticas detalladas de consumo
- 📑 Generación de informes

### Interfaz de Usuario
- 🖥️ Dashboard interactivo
- 📱 Diseño responsive
- 📊 Gráficos y tablas dinámicas
- 🎨 Interfaz moderna y amigable

## 🛠️ Tecnologías Utilizadas

- **Backend:**
  - Node.js
  - Express
  - MySQL
  - node-schedule

- **Frontend:**
  - HTML5
  - CSS3
  - JavaScript
  - Gráficos interactivos

- **Hardware:**
  - Shelly Pro 3 EM

## 🚀 Instalación

1. **Clonar el repositorio**
   ```bash
   git clone [URL_del_repositorio]
   cd shelly-energy-monitor
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar la base de datos**
   - Ejecutar los scripts SQL en el directorio `/SQL`
   - Configurar credenciales en `/config/database.json`

4. **Configurar el dispositivo Shelly**
   - Actualizar credenciales en `/config/api-credentials.json`

5. **Iniciar la aplicación**
   ```bash
   npm start
   ```

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- MySQL (v8.0 o superior)
- Dispositivo Shelly Pro 3 EM configurado y conectado a la red
- Navegador web moderno

## 🔧 Configuración

### Base de Datos
La configuración de la base de datos se realiza en `/config/database.json`:
```json
{
  "host": "localhost",
  "user": "tu_usuario",
  "password": "tu_contraseña",
  "database": "shelly_monitor"
}
```

### API Shelly
Configura las credenciales del dispositivo en `/config/api-credentials.json`:
```json
{
  "device_ip": "192.168.1.x",
  "username": "admin",
  "password": "tu_contraseña"
}
```

## 📖 Documentación

- [Guía de Contribución](./CONTRIBUTING.md)
- [Código de Conducta](./CODE_OF_CONDUCT.md)
- [Guía de Implementación](./docs/CONTRIBUTING_CHEATSHEET.md)
- [Documentación de la API](./docs/API.md)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor, lee nuestra [Guía de Contribución](./CONTRIBUTING.md) y nuestro [Código de Conducta](./CODE_OF_CONDUCT.md) antes de enviar un pull request.

## 🔒 Seguridad

Si descubres algún problema de seguridad, por favor sigue nuestra [Política de Seguridad](./SECURITY.md) para reportarlo.

## 📄 Licencia

Este proyecto está bajo la Licencia GNU General Public License v3.0 - ver el archivo [LICENSE](./LICENSE) para más detalles.

## 👥 Autores

- Equipo de desarrollo inicial

## 📞 Soporte

Para soporte y preguntas, por favor:
1. Revisa la [documentación](./docs)
2. Crea un [issue](../../issues)
3. Contacta al equipo de desarrollo

## 🙏 Agradecimientos

- A todos los contribuidores del proyecto
- A la comunidad de Shelly por su excelente hardware
- A los usuarios por su retroalimentación y sugerencias

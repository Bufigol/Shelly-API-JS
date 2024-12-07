# Guía de Contribución

¡Gracias por tu interés en contribuir a Shelly Energy Monitor! Este documento proporciona las pautas y mejores prácticas para contribuir al proyecto.

## 📋 Tabla de Contenidos

1. [Código de Conducta](#código-de-conducta)
2. [¿Cómo puedo contribuir?](#cómo-puedo-contribuir)
3. [Proceso de Desarrollo](#proceso-de-desarrollo)
4. [Guías de Estilo](#guías-de-estilo)
5. [Reporte de Bugs](#reporte-de-bugs)
6. [Sugerencias de Mejoras](#sugerencias-de-mejoras)

## 📜 Código de Conducta

Este proyecto y todos sus participantes están gobernados por nuestro [Código de Conducta](CODE_OF_CONDUCT.md). Al participar, se espera que respetes este código.

## 🤝 ¿Cómo puedo contribuir?

### 🐛 Reportando Bugs
- Usa la plantilla de [reporte de bugs](.github/ISSUE_TEMPLATE/bug_report.md)
- Verifica que el bug no haya sido reportado anteriormente
- Incluye todos los detalles posibles
- Proporciona pasos claros para reproducir el problema

### 💡 Sugiriendo Mejoras
- Usa la plantilla de [solicitud de características](.github/ISSUE_TEMPLATE/feature_request.md)
- Explica el problema que tu mejora resolvería
- Describe la solución que te gustaría ver
- Considera las alternativas que has pensado

### 📚 Mejorando la Documentación
- Usa la plantilla de [mejora de documentación](.github/ISSUE_TEMPLATE/documentation.md)
- Asegúrate de que los cambios sean claros y concisos
- Verifica la ortografía y gramática
- Mantén el estilo consistente con la documentación existente

## 🔄 Proceso de Desarrollo

### 🌿 Flujo de Trabajo con Git

1. Fork el repositorio
2. Crea una rama para tu contribución:
   ```bash
   git checkout -b feature/nombre-caracteristica
   ```
   o
   ```bash
   git checkout -b fix/nombre-bug
   ```

3. Realiza tus cambios siguiendo las guías de estilo
4. Commit tus cambios:
   ```bash
   git commit -m "tipo: descripción breve"
   ```
   Tipos de commit:
   - feat: Nueva característica
   - fix: Corrección de bug
   - docs: Cambios en documentación
   - style: Cambios de formato
   - refactor: Refactorización de código
   - test: Añadir o modificar tests
   - chore: Cambios en el proceso de build o herramientas

5. Push a tu fork:
   ```bash
   git push origin feature/nombre-caracteristica
   ```

6. Crea un Pull Request usando la [plantilla de PR](.github/pull_request_template.md)

### 🔍 Proceso de Review

1. Los maintainers revisarán tu PR
2. Se pueden solicitar cambios o mejoras
3. Una vez aprobado, se fusionará a la rama principal

## 🎨 Guías de Estilo

### JavaScript

- Usa ES6+ features cuando sea posible
- Sigue el estilo de código existente
- Documenta las funciones y métodos
- Usa nombres descriptivos para variables y funciones
- Mantén las funciones pequeñas y enfocadas

### SQL

- Usa nombres de tablas en plural
- Nombres de columnas en camelCase
- Incluye comentarios para queries complejas
- Sigue las convenciones de naming existentes

### Commits

- Mensajes claros y descriptivos
- Usa el formato convencional de commits
- Referencias issues cuando sea relevante

### Documentación

- Mantén el README actualizado
- Documenta nuevas características
- Actualiza la documentación existente según sea necesario

## 🔒 Seguridad

Si descubres una vulnerabilidad de seguridad, por favor sigue nuestra [Política de Seguridad](SECURITY.md).

## 💬 Comunicación

- Issues de GitHub para bugs y features
- Pull Requests para contribuciones de código
- Discusiones de GitHub para preguntas generales

## ✨ Reconocimiento

Las contribuciones de cualquier tipo son bienvenidas y serán reconocidas apropiadamente en nuestro archivo CONTRIBUTORS.md.

---

¡Gracias por contribuir a Shelly Energy Monitor!

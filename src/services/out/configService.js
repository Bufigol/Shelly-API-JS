// src/services/out/configService.js
const databaseService = require("../database-service");

/**
 * Servicio para gestionar la configuración del sistema
 */
class ConfigService {
  /**
   * Obtiene todos los parámetros de configuración del sistema
   * @returns {Array} Lista de parámetros de configuración
   */
  async obtenerConfiguracion() {
    try {
      const [configuraciones] = await databaseService.pool.query(`
        SELECT 
          id_api_configuracion,
          nombre_parametro,
          tipo_de_dato,
          valor
        FROM api_configuracion
        ORDER BY id_api_configuracion
      `);
      
      // Convertir valores según el tipo de dato
      const configuracionesFormateadas = configuraciones.map(config => {
        let valorFormateado = config.valor;
        
        if (config.tipo_de_dato === 'DOUBLE') {
          valorFormateado = parseFloat(config.valor);
        }
        
        return {
          id: config.id_api_configuracion,
          nombre: config.nombre_parametro,
          tipo: config.tipo_de_dato,
          valor: valorFormateado
        };
      });
      
      // Agrupar configuraciones por categorías
      const configPorCategoria = this.agruparConfiguracionesPorCategoria(configuracionesFormateadas);
      
      return configPorCategoria;
    } catch (error) {
      console.error("Error al obtener configuración:", error);
      throw error;
    }
  }

  /**
   * Agrupa las configuraciones por categorías basándose en prefijos comunes
   * @param {Array} configuraciones - Lista de parámetros de configuración
   * @returns {Object} Configuraciones agrupadas por categoría
   */
  agruparConfiguracionesPorCategoria(configuraciones) {
    const categorias = {
      rangos_temperatura: [],
      umbrales_faena: [],
      parametros_sistema: []
    };
    
    for (const config of configuraciones) {
      // Determinar categoría según el ID o nombre
      if ([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16].includes(config.id)) {
        categorias.rangos_temperatura.push(config);
      } else if ([1, 14, 15].includes(config.id)) {
        categorias.umbrales_faena.push(config);
      } else {
        categorias.parametros_sistema.push(config);
      }
    }
    
    return {
      rangos_temperatura: categorias.rangos_temperatura,
      umbrales_faena: categorias.umbrales_faena,
      parametros_sistema: categorias.parametros_sistema,
      todos: configuraciones
    };
  }

  /**
   * Actualiza uno o varios parámetros de configuración
   * @param {Object} parametros - Objeto con los parámetros a actualizar
   * @returns {Object} Resultado de la operación
   */
  async actualizarConfiguracion(parametros) {
    const connection = await databaseService.pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      const resultados = [];
      const errores = [];
      
      // Procesar cada parámetro
      for (const [idParametro, nuevoValor] of Object.entries(parametros)) {
        try {
          // Validar que el parámetro existe
          const [parametro] = await connection.query(
            "SELECT id_api_configuracion, nombre_parametro, tipo_de_dato FROM api_configuracion WHERE id_api_configuracion = ?",
            [idParametro]
          );
          
          if (parametro.length === 0) {
            errores.push({
              id: idParametro,
              mensaje: "Parámetro no encontrado"
            });
            continue;
          }
          
          // Validar el valor según el tipo de dato
          const esValido = this.validarValorSegunTipo(nuevoValor.valor, parametro[0].tipo_de_dato);
          
          if (!esValido) {
            errores.push({
              id: idParametro,
              nombre: parametro[0].nombre_parametro,
              mensaje: `Valor inválido para el tipo ${parametro[0].tipo_de_dato}`
            });
            continue;
          }
          
          // Actualizar el valor
          await connection.query(
            "UPDATE api_configuracion SET valor = ? WHERE id_api_configuracion = ?",
            [nuevoValor.valor.toString(), idParametro]
          );
          
          resultados.push({
            id: parseInt(idParametro),
            nombre: parametro[0].nombre_parametro,
            actualizado: true
          });
        } catch (error) {
          console.error(`Error al actualizar parámetro ${idParametro}:`, error);
          errores.push({
            id: idParametro,
            mensaje: "Error al actualizar"
          });
        }
      }
      
      // Si hay errores, hacemos rollback
      if (errores.length > 0) {
        await connection.rollback();
        return {
          success: false,
          message: "Error al actualizar algunos parámetros",
          errors: errores
        };
      }
      
      await connection.commit();
      
      return {
        success: true,
        message: "Configuración actualizada correctamente",
        actualizados: resultados
      };
    } catch (error) {
      await connection.rollback();
      console.error("Error al actualizar configuración:", error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Valida si un valor es compatible con el tipo de dato especificado
   * @param {any} valor - Valor a validar
   * @param {string} tipo - Tipo de dato esperado
   * @returns {boolean} true si el valor es válido para el tipo especificado
   */
  validarValorSegunTipo(valor, tipo) {
    try {
      switch (tipo) {
        case 'DOUBLE':
          // Validar que sea un número
          const numero = parseFloat(valor);
          return !isNaN(numero);
          
        case 'VARCHAR':
          // Para VARCHAR, cualquier string es válido
          return typeof valor === 'string' || typeof valor === 'number';
          
        default:
          // Para tipos no especificados, aceptamos cualquier valor
          return true;
      }
    } catch (error) {
      console.error("Error validando valor:", error);
      return false;
    }
  }

  /**
   * Obtiene un parámetro específico de la configuración
   * @param {number} idParametro - ID del parámetro a obtener
   * @returns {Object|null} Parámetro solicitado o null si no existe
   */
  async obtenerParametro(idParametro) {
    try {
      const [parametros] = await databaseService.pool.query(
        "SELECT id_api_configuracion, nombre_parametro, tipo_de_dato, valor FROM api_configuracion WHERE id_api_configuracion = ?",
        [idParametro]
      );
      
      if (parametros.length === 0) {
        return null;
      }
      
      const parametro = parametros[0];
      let valorFormateado = parametro.valor;
      
      if (parametro.tipo_de_dato === 'DOUBLE') {
        valorFormateado = parseFloat(parametro.valor);
      }
      
      return {
        id: parametro.id_api_configuracion,
        nombre: parametro.nombre_parametro,
        tipo: parametro.tipo_de_dato,
        valor: valorFormateado
      };
    } catch (error) {
      console.error("Error al obtener parámetro:", error);
      throw error;
    }
  }

  /**
   * Obtiene los umbrales de temperatura para determinar el estado del semáforo
   * @returns {Object|null} Objeto con los umbrales de temperatura
   */
  async obtenerUmbralesTemperatura() {
    try {
      const [umbrales] = await databaseService.pool.query(`
        SELECT 
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 2) AS rojo_bajo,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 4) AS amarillo_bajo,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 8) AS amarillo_alto,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 10) AS rojo_alto,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 16) AS maximo_rojo_alto
      `);
      
      if (umbrales.length === 0) {
        return null;
      }
      
      return {
        rojo_bajo: parseFloat(umbrales[0].rojo_bajo),
        amarillo_bajo: parseFloat(umbrales[0].amarillo_bajo),
        amarillo_alto: parseFloat(umbrales[0].amarillo_alto),
        rojo_alto: parseFloat(umbrales[0].rojo_alto),
        maximo_rojo_alto: parseFloat(umbrales[0].maximo_rojo_alto || umbrales[0].rojo_alto)
      };
    } catch (error) {
      console.error("Error al obtener umbrales de temperatura:", error);
      return null;
    }
  }

  /**
   * Obtiene los parámetros para la detección de inicio y fin de faenas
   * @returns {Object|null} Parámetros de faenas
   */
  async obtenerParametrosFaena() {
    try {
      const [parametros] = await databaseService.pool.query(`
        SELECT 
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 1) AS temp_inicio_faena,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 14) AS temp_fin_faena,
          (SELECT valor FROM api_configuracion WHERE id_api_configuracion = 15) AS tiempo_fin_faena
      `);
      
      if (parametros.length === 0) {
        return null;
      }
      
      return {
        temp_inicio_faena: parseFloat(parametros[0].temp_inicio_faena),
        temp_fin_faena: parseFloat(parametros[0].temp_fin_faena),
        tiempo_fin_faena: parseInt(parametros[0].tiempo_fin_faena)
      };
    } catch (error) {
      console.error("Error al obtener parámetros de faena:", error);
      return null;
    }
  }
}

module.exports = new ConfigService();
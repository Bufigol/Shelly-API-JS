// src/services/database-service.js
const mysql = require('mysql2/promise');
const config = require('../config/js_files/config-loader');

class DatabaseService {
  constructor() {
    this.pool = null;
    this.connected = false;
    this.config = null;
  }

  /**
   * Inicializa el servicio de base de datos creando el pool de conexiones
   * @returns {Promise<boolean>} - true si la inicialización fue exitosa
   */
  async initialize() {
    try {
      // Cargar configuración
      this.config = config.getConfig().database;
      console.log(`Inicializando conexión a base de datos: ${this.config.host}:${this.config.port}/${this.config.database}`);

      // Crear pool de conexiones
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.username,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: this.config.pool.max_size || 10,
        queueLimit: 0
      });

      // Probar conexión
      const connection = await this.pool.getConnection();
      connection.release();

      this.connected = true;
      console.log('✅ Conexión a base de datos establecida correctamente');
      return true;
    } catch (error) {
      this.connected = false;
      console.error('❌ Error al inicializar conexión a base de datos:', error.message);
      return false;
    }
  }

  /**
   * Prueba la conexión a la base de datos
   * @returns {Promise<boolean>} - true si la conexión es exitosa
   */
  async testConnection() {
    if (!this.pool) {
      console.warn('⚠️ El pool de conexiones no ha sido inicializado');
      return false;
    }

    try {
      const connection = await this.pool.getConnection();
      connection.release();
      return true;
    } catch (error) {
      console.error('❌ Error al probar conexión a base de datos:', error.message);
      return false;
    }
  }

  /**
   * Cierra el pool de conexiones a la base de datos
   * @returns {Promise<boolean>} - true si se cerró correctamente
   */
  async close() {
    if (!this.pool) {
      return true; // No hay nada que cerrar
    }

    try {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
      console.log('✅ Conexión a base de datos cerrada correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error al cerrar conexión a base de datos:', error.message);
      return false;
    }
  }

  /**
   * Ejecuta una consulta SQL
   * @param {string} sql - Consulta SQL
   * @param {Array} params - Parámetros para la consulta
   * @returns {Promise<Array>} - Resultados de la consulta
   */
  async query(sql, params = []) {
    if (!this.pool) {
      throw new Error('El pool de conexiones no ha sido inicializado');
    }

    try {
      const [rows] = await this.pool.query(sql, params);
      return rows;
    } catch (error) {
      console.error('Error en consulta SQL:', error.message);
      throw error;
    }
  }

  /**
   * Ejecuta una consulta SQL en una transacción
   * @param {Function} callback - Función que recibe la conexión y ejecuta operaciones
   * @returns {Promise<any>} - Resultado de la transacción
   */
  async transaction(callback) {
    if (!this.pool) {
      throw new Error('El pool de conexiones no ha sido inicializado');
    }

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Recarga la configuración y reinicia la conexión a la base de datos
   * @returns {Promise<boolean>} - true si la reinicialización fue exitosa
   */
  async reloadConfig() {
    try {
      // Cerrar conexión actual si existe
      if (this.pool) {
        await this.close();
      }

      // Recargar configuración
      config.reloadConfig();

      // Reinicializar con nueva configuración
      return await this.initialize();
    } catch (error) {
      console.error('❌ Error al recargar configuración de base de datos:', error.message);
      return false;
    }
  }

  /**
   * Cambia el entorno de la base de datos (desarrollo/producción) y reinicia la conexión
   * @param {number} envIndex - 0 para desarrollo, 1 para producción
   * @returns {Promise<boolean>} - true si el cambio fue exitoso
   */
  async switchEnvironment(envIndex) {
    try {
      // Cerrar conexión actual si existe
      if (this.pool) {
        await this.close();
      }

      // Cambiar entorno
      config.changeEnvironment(envIndex);

      // Reinicializar con nueva configuración
      return await this.initialize();
    } catch (error) {
      console.error(`❌ Error al cambiar a entorno ${envIndex}:`, error.message);
      return false;
    }
  }
}

module.exports = new DatabaseService();
const { procesarDatosGPS_GPS_DATA } = require('./nuevo_dato_GPS_data_table');
const { triggerGPSRegistroTemperatura } = require('./trigger_GPS_registro_temperatura');
const { GPS_DATa_To_Door_Status } = require('./GPSDATAaDoorStatus');
const mysql = require('mysql2/promise');
const ddbb_data = require('../../config/database.json');

const pool = mysql.createPool({
  host: ddbb_data.host,
  user: ddbb_data.user,
  password: ddbb_data.password,
  database: ddbb_data.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
async function obtenerUltimoDatoGPS() {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM gps_data ORDER BY id DESC LIMIT 1'
    );
    return rows[0];
  } catch (error) {
    console.error('Error al obtener el último dato GPS:', error);
    throw error;
  }
}

async function procesarDatosGPS() {
  try {
    // Obtener el último dato insertado en gps_data
    const newData = await obtenerUltimoDatoGPS();

    if (!newData) {
      console.log('No se encontraron datos GPS recientes para procesar');
      return;
    }

    
    // Paso 1: Procesar los datos GPS principales
    await procesarDatosGPS_GPS_DATA(newData);

    // Paso 2: Registrar temperaturas
    await triggerGPSRegistroTemperatura(newData);

    // Paso 3: Actualizar estado de puertas solo si event_enum es 11317
    if (newData.event_enum === 11317) {
      let bleBeacons;
      try {
        bleBeacons = JSON.parse(newData.ble_beacons);
      } catch (error) {
        console.error('Error al parsear ble_beacons:', error);
        console.log('ble_beacons raw:', newData.ble_beacons);
        bleBeacons = [];
      }

      if (Array.isArray(bleBeacons)) {
        await GPS_DATa_To_Door_Status(bleBeacons, newData.timestamp);
        console.log('Actualización de estado de puertas completada');
      } else {
        console.error('ble_beacons no es un array después de parsear');
      }
    } else {
      console.log('Saltando actualización de estado de puertas (event_enum no es 11317)');
    }

    console.log('Procesamiento de datos GPS completado con éxito');
  } catch (error) {
    console.error('Error en el procesamiento de datos GPS:', error);
  }
}

module.exports = { procesarDatosGPS };
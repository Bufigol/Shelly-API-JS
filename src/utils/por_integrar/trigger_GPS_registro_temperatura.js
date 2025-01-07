const mysql = require('mysql2/promise');
const ddbb_data = require('../../config/database.json');

// Configuración de la conexión a la base de datos
const pool = mysql.createPool({
  host: ddbb_data.host,
  user: ddbb_data.user,
  password: ddbb_data.password,
  database: ddbb_data.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function triggerGPSRegistroTemperatura(newData) {
  let connection;
  try {
    connection = await pool.getConnection();

    if (!newData || typeof newData.ble_beacons !== 'string') {
      console.error('Datos de entrada inválidos para triggerGPSRegistroTemperatura:', newData);
      return;
    }

    let jsonData;
    try {
      jsonData = JSON.parse(newData.ble_beacons);
    } catch (error) {
      console.error('Error al parsear ble_beacons en triggerGPSRegistroTemperatura:', error);
      console.log('ble_beacons raw:', newData.ble_beacons);
      return;
    }

    if (!Array.isArray(jsonData)) {
      console.error('ble_beacons no es un array en triggerGPSRegistroTemperatura:', jsonData);
      return;
    }

    console.log('Procesando', jsonData.length, 'beacons');

    for (let jsonElement of jsonData) {
      const temperatura = jsonElement.temperature;

      if (temperatura !== null && temperatura !== undefined) {
        await connection.execute('INSERT INTO process_log(message) VALUES(?)', [`Temperatura encontrada: ${temperatura}`]);

        let macAddress = jsonElement['mac.address'];
        let beaconId, esTemperatura;

        if (macAddress) {
          const [rows] = await connection.execute(
            'SELECT id, esTemperatura FROM beacons WHERE mac LIKE ?',
            [`%${macAddress}%`]
          );
          if (rows.length > 0) {
            beaconId = rows[0].id;
            esTemperatura = rows[0].esTemperatura;
          }
          await connection.execute('INSERT INTO process_log(message) VALUES(?)', 
            [`Beacon encontrado: ${macAddress}, esTemperatura: ${esTemperatura}`]);
        } else {
          beaconId = jsonElement.id;
          if (beaconId) {
            const [rows] = await connection.execute(
              'SELECT esTemperatura FROM beacons WHERE id LIKE ?',
              [`%${beaconId}%`]
            );
            if (rows.length > 0) {
              esTemperatura = rows[0].esTemperatura;
            }
            await connection.execute('INSERT INTO process_log(message) VALUES(?)', 
              [`Beacon encontrado por ID: ${beaconId}, esTemperatura: ${esTemperatura}`]);
          } else {
            console.warn('Beacon sin ID ni MAC address encontrado:', jsonElement);
            continue;
          }
        }

        if (esTemperatura === 1) {
          const timestamp = new Date(newData.timestamp * 1000).toISOString().slice(0, 19).replace('T', ' ');
          await connection.execute(
            'INSERT INTO registro_temperaturas(beacon_id, timestamp, temperatura) VALUES (?, ?, ?)',
            [beaconId, timestamp, temperatura]
          );
          await connection.execute('INSERT INTO process_log(message) VALUES(?)', 
            [`Temperatura registrada: beacon_id=${beaconId}, timestamp=${timestamp}, temperatura=${temperatura}`]);
        }
      }
    }

    await connection.execute('INSERT INTO process_log(message) VALUES(?)', 
      ['Proceso de registro de temperaturas completado']);

  } catch (error) {
    console.error('Error en triggerGPSRegistroTemperatura:', error);
    await connection.execute('INSERT INTO process_log(message) VALUES(?)', 
      [`Error en triggerGPSRegistroTemperatura: ${error.message}`]);
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

module.exports = { triggerGPSRegistroTemperatura };
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

const EVENTS = {
  KTK: 385,
  EYE: 11317
};

const TABLE_NAMES = {
  '352592573522828': 'gh_5200_data_352592573522828',
  '353201350896384': 'magic_box_tmt_210_data_353201350896384',
  '352592576164230': 'fmb204_data_352592576164230'
};

async function queryDatabase(query, params = []) {
  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.query(query, params);
    return rows;
  } catch (error) {
    console.error(`Error en la consulta: ${query}`, error);
    throw error;
  } finally {
    if (connection) await connection.release();
  }
}

async function obtenerMacsDeBaseDeDatos() {
  const rows = await queryDatabase('SELECT mac FROM beacons');
  return rows.map(row => row.mac);
}

async function buscarMacEnTexto(texto, macs) {
  if (typeof texto !== 'string') {
    console.warn('buscarMacEnTexto: texto no es una cadena', texto);
    return null;
  }
  return macs.find(mac => texto.includes(mac)) || null;
}

async function obtenerIdPorMac(mac) {
  const rows = await queryDatabase('SELECT id FROM beacons WHERE mac = ?', [mac]);
  return rows.length > 0 ? rows[0].id : null;
}

async function esTemperatura(mac) {
  const rows = await queryDatabase('SELECT esTemperatura FROM beacons WHERE mac = ?', [mac]);
  return rows.length > 0 ? rows[0].esTemperatura === 1 : false;
}

function getTableName(ident) {
  if (!(ident in TABLE_NAMES)) {
    throw new Error(`Ident no reconocido: ${ident}`);
  }
  return TABLE_NAMES[ident];
}

async function insertarDatosSegunIdent(ident, newData, bleBeacons) {
  const tableName = getTableName(ident);
  const baseColumns = 'id_dispo, device_id_gps_data, event_enum, altitude, latitude, longitude, timestamp, beacon_id';
  const baseValues = '?, ?, ?, ?, ?, ?, ?, ?';

  let query, values;

  if (newData.event_enum === EVENTS.KTK) {
    query = `INSERT INTO teltonika.${tableName} 
             (${baseColumns}, rsi_beacon, battery_level, ble_sensor_humidity, 
              ble_sensor_magnet_status, ble_sensor_temperature, ID_GPS_DATA) 
             VALUES (${baseValues}, ?, ?, ?, ?, ?, ?)`;
    
    const ktkData = await extraerDatosKTK(bleBeacons);
    
    values = [
      ident, newData.device_id, newData.event_enum, newData.altitude, newData.latitude, newData.longitude,
      newData.timestamp, ktkData.KTK_ID ?? null, ktkData.KTK_RSSI ?? null, newData.battery_level ?? null, 
      newData.ble_sensor_humidity_1 ?? null, newData.ble_sensor_magnet_status_1 ?? null, ktkData.KTK_TEMPERATURE ?? null, 
      newData.id ?? null
    ];
  } else if (newData.event_enum === EVENTS.EYE) {
    query = `INSERT INTO teltonika.${tableName} 
             (${baseColumns}, battery_level, ble_sensor_humidity, ble_sensor_magnet_status, 
              ble_sensor_temperature, \`EYE_battery.low\`, EYE_humidity, EYE_id, 
              \`EYE_mac.address\`, EYE_magnet, \`EYE_magnet.count\`, EYE_movement, 
              \`EYE_movement.count\`, EYE_temperature, EYE_type, ID_GPS_DATA) 
             VALUES (${baseValues}, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const eyeData = await extraerDatosEYE(bleBeacons);
    
    values = [
      ident, newData.device_id, newData.event_enum, newData.altitude, newData.latitude, newData.longitude,
      newData.timestamp, eyeData.EYE_id, newData.battery_level ?? null, newData.ble_sensor_humidity_1 ?? null,
      newData.ble_sensor_magnet_status_1 ?? null, newData.ble_sensor_temperature_1 ?? null, 
      eyeData.EYE_battery_low ?? false, eyeData.EYE_humidity ?? null, eyeData.EYE_id, 
      eyeData.EYE_mac_address ?? null, eyeData.EYE_magnet ?? false, 
      eyeData.EYE_magnet_count ?? null, eyeData.EYE_movement ?? false, 
      eyeData.EYE_movement_count ?? null, eyeData.EYE_temperature ?? null, 
      eyeData.EYE_type ?? null, newData.id ?? null
    ];
  }

  try {
    console.log(`Insertando datos en tabla ${tableName}`);
    //console.log('Query:', query);
    //console.log('Valores:', values);
    await queryDatabase(query, values);
    console.log(`Datos insertados correctamente en tabla ${tableName}`);
  } catch (error) {
    console.error(`Error al insertar datos en tabla ${tableName}:`, error);
    throw error;
  }
}

async function encontrarBeaconConMayorRSSI(beacons, macs) {
  let highestRssi = -Infinity;
  let highestRssiElement = null;

  if (!Array.isArray(beacons)) {
    console.warn('encontrarBeaconConMayorRSSI: beacons no es un array', beacons);
    return null;
  }

  for (const beacon of beacons) {
    const beaconStr = typeof beacon === 'string' ? beacon : JSON.stringify(beacon);
    const mac = await buscarMacEnTexto(beaconStr, macs);
    if (mac) {
      const rssi = parseInt(beaconStr.match(/"rssi":(-?\d+)/)?.[1] || '-Infinity');
      const esPuerta = await esTemperatura(mac);
      if (rssi > highestRssi && !esPuerta) {
        highestRssi = rssi;
        highestRssiElement = { beacon: beaconStr, mac };
      }
    }
  }

  return highestRssiElement;
}

async function extraerDatosKTK(beacons) {
  const macs = await obtenerMacsDeBaseDeDatos();
  const highestRssiElement = await encontrarBeaconConMayorRSSI(beacons, macs);

  if (!highestRssiElement) return {};

  const id = await obtenerIdPorMac(highestRssiElement.mac);
  return {
    KTK_ID: id,
    KTK_battery_voltage: highestRssiElement.beacon.match(/"voltage":(\d+(\.\d+)?)/)?.[1],
    KTK_RSSI: parseInt(highestRssiElement.beacon.match(/"rssi":(-?\d+)/)?.[1] || '-Infinity'),
    KTK_TEMPERATURE: highestRssiElement.beacon.match(/"temperature":(-?\d+(\.\d+)?)/)?.[1]
  };
}

async function extraerDatosEYE(bleBeacons) {
  if (!Array.isArray(bleBeacons)) {
    console.warn('extraerDatosEYE: bleBeacons no es un array', bleBeacons);
    return {};
  }

  const macs = await obtenerMacsDeBaseDeDatos();
  const beaconsStr = JSON.stringify(bleBeacons);
  const mac = await buscarMacEnTexto(beaconsStr, macs);
  
  if (!mac) return {};

  const id = await obtenerIdPorMac(mac);
  return {
    EYE_mac_address: mac,
    EYE_battery_low: bleBeacons.some(b => b['battery.low'] === true),
    EYE_humidity: bleBeacons.find(b => b.humidity !== undefined)?.humidity,
    EYE_id: id,
    EYE_magnet: bleBeacons.some(b => b.magnet === true),
    EYE_magnet_count: bleBeacons.find(b => b['magnet.count'] !== undefined)?.['magnet.count'],
    EYE_movement: bleBeacons.some(b => b.movement === true),
    EYE_movement_count: bleBeacons.find(b => b['movement.count'] !== undefined)?.['movement.count'],
    EYE_temperature: bleBeacons.find(b => b.temperature !== undefined)?.temperature,
    EYE_type: bleBeacons.find(b => b.type !== undefined)?.type
  };
}

async function procesarDatosGPS_GPS_DATA(newData) {
  const macs = await obtenerMacsDeBaseDeDatos();

  if (newData.event_enum === EVENTS.KTK) {
    await procesarEventoKTK(newData, macs);
  } else if (newData.event_enum === EVENTS.EYE) {
    await procesarEventoEYE(newData, macs);
  }
}

async function procesarEventoKTK(newData, macs) {
  let beacons;
  try {
    beacons = Array.isArray(newData.ble_beacons) ? newData.ble_beacons : JSON.parse(newData.ble_beacons);
  } catch (error) {
    console.error('Error al parsear ble_beacons:', error);
    //console.log('newData.ble_beacons:', newData.ble_beacons);
    beacons = [];
  }
  const ktkData = await extraerDatosKTK(beacons);
  await insertarDatosSegunIdent(newData.ident, newData, beacons);
}

async function procesarEventoEYE(newData, macs) {
  let bleBeacons;
  try {
    bleBeacons = Array.isArray(newData.ble_beacons) ? newData.ble_beacons : JSON.parse(newData.ble_beacons);
  } catch (error) {
    console.error('Error al parsear ble_beacons:', error);
    //console.log('newData.ble_beacons:', newData.ble_beacons);
    bleBeacons = [];
  }
  const eyeData = await extraerDatosEYE(bleBeacons);
  await insertarDatosSegunIdent(newData.ident, newData, bleBeacons);
}

module.exports = { procesarDatosGPS_GPS_DATA, insertarDatosSegunIdent };
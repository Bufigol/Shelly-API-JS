const mysql = require("mysql2/promise");
const ddbb_data = require('../../config/database.json');

const pool = mysql.createPool({
  host: ddbb_data.host,
  user: ddbb_data.user,
  password: ddbb_data.password,
  database: ddbb_data.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function obtenerMacAddressesDeBaseDeDatos() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query("SELECT mac FROM beacons");
    return rows.map(row => row.mac);
  } catch (error) {
    console.error('Error al obtener MAC addresses de la base de datos:', error);
    return [];
  } finally {
    connection.release();
  }
}

async function obtenerMacAddress(input_mac) {
  if (!input_mac || typeof input_mac !== 'string') {
    console.warn('Datos inválidos para obtener MAC address:', input_mac);
    return null;
  }

  const macAddresses = await obtenerMacAddressesDeBaseDeDatos();

  for (let mac of macAddresses) {
    if (input_mac.includes(mac)) {
      return mac;
    }
  }

  console.warn('No se encontró una MAC address válida en:', input_mac);
  return null;
}

async function GPS_DATa_To_Door_Status(ble_beacons, timestamp) {
  if (!Array.isArray(ble_beacons) || ble_beacons.length === 0) {
    console.warn('ble_beacons is not an array or is empty:', ble_beacons);
    return;
  }

  let mac_address = await obtenerMacAddress(JSON.stringify(ble_beacons));
  if (!mac_address) {
    console.warn('No se pudo obtener mac_address');
    return;
  }

  let esPuerta = await obtenerEsPuerta(mac_address);
  if (esPuerta) {
    let temperatura = await obtenerTemperatura(ble_beacons);
    let statusMagnetico = await obtenerStatusMagnetico(ble_beacons);
    let ubicacion = await obtenerUbicacion(mac_address);
    let tiempo_formateado = await fromUnixTime(timestamp);
    await insertarRegistro(
      ubicacion,
      statusMagnetico,
      temperatura,
      tiempo_formateado
    );
  }
}

async function insertarRegistro(
  ubicacion,
  statusMagnetico,
  temperatura,
  tiempo_formateado
) {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      "INSERT INTO door_status (sector, magnet_status, temperature, timestamp) VALUES (?, ?, ?, ?)",
      [ubicacion, statusMagnetico, temperatura, tiempo_formateado]
    );
  } catch (error) {
    console.error('Error al insertar registro:', error);
  } finally {
    connection.release();
  }
}

async function obtenerUbicacion(mac) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT ubicacion FROM beacons WHERE mac = ?",
      [mac]
    );
    return rows.length > 0 ? rows[0].ubicacion : null;
  } catch (error) {
    console.error('Error al obtener ubicación:', error);
    return null;
  } finally {
    connection.release();
  }
}

async function obtenerStatusMagnetico(input) {
  if (!input || input.length === 0 || !input[0].hasOwnProperty('magnet')) {
    console.warn('Datos inválidos para obtener status magnético:', input);
    return null;
  }
  return input[0].magnet;
}

async function obtenerTemperatura(inputs) {
  if (!inputs || inputs.length === 0 || !inputs[0].hasOwnProperty('temperature')) {
    console.warn('Datos inválidos para obtener temperatura:', inputs);
    return null;
  }
  return inputs[0].temperature;
}

async function obtenerEsPuerta(mac_address) {
  if (!mac_address) {
    console.warn('MAC address inválida para obtener esPuerta');
    return false;
  }

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT esPuerta FROM beacons WHERE mac = ?",
      [mac_address]
    );
    return rows.length > 0 ? rows[0].esPuerta === 1 : false;
  } catch (error) {
    console.error('Error al obtener esPuerta:', error);
    return false;
  } finally {
    connection.release();
  }
}

async function fromUnixTime(tiempo) {
  const date = new Date(tiempo * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

module.exports = { GPS_DATa_To_Door_Status };
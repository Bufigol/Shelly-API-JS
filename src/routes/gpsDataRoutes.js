/* routes/gpsDataRoutes.js */

const express = require("express");
const router = express.Router();
const Joi = require("joi"); // Import Joi
const { procesarPosibleIncidencia } = require("../utils/control_incidencias.js");

const schemas = {
  303: {
    // FBM204
    typeA: Joi.object({
      "ble.beacons": Joi.array().items(Joi.object()),
      "channel.id": Joi.number().integer(),
      "codec.id": Joi.number().integer(),
      "device.id": Joi.number().integer(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number().integer(),
      "event.enum": Joi.number().integer(),
      "event.priority.enum": Joi.number().integer(),
      ident: Joi.string(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.latitude": Joi.number(),
      "position.longitude": Joi.number(),
      "position.satellites": Joi.number().integer(),
      "position.speed": Joi.number(),
      "protocol.id": Joi.number().integer(),
      "server.timestamp": Joi.number(),
      timestamp: Joi.number(),
      "battery.current": Joi.number(),
      "battery.voltage": Joi.number(),
      "ble.sensor.humidity.1": Joi.number().integer(),
      "ble.sensor.magnet.status.1": Joi.boolean(),
      "ble.sensor.temperature.1": Joi.number(),
      "channel.id": Joi.number().integer(),
      "codec.id": Joi.number().integer(),
      "device.id": Joi.number().integer(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number().integer(),
      "engine.ignition.status": Joi.boolean(),
      "event.priority.enum": Joi.number().integer(),
      "external.powersource.voltage": Joi.number(),
      "gnss.state.enum": Joi.number().integer(),
      "gnss.status": Joi.boolean(),
      "gsm.mcc": Joi.number().integer(),
      "gsm.mnc": Joi.number().integer(),
      "gsm.operator.code": Joi.string(),
      "gsm.signal.level": Joi.number().integer(),
      ident: Joi.string(),
      "movement.status": Joi.boolean(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.hdop": Joi.number(),
      "position.latitude": Joi.number(),
      "position.longitude": Joi.number(),
      "position.pdop": Joi.number(),
      "position.satellites": Joi.number().integer(),
      "position.speed": Joi.number(),
      "position.valid": Joi.boolean(),
      "protocol.id": Joi.number().integer(),
      "server.timestamp": Joi.number(),
      "sleep.mode.enum": Joi.number().integer(),
      timestamp: Joi.number(),
      "vehicle.mileage": Joi.number(),
    }).unknown(true),
  },
  2313: {
    typeA: Joi.object({
      "battery.voltage": Joi.number(),
      "channel.id": Joi.number(),
      "codec.id": Joi.number(),
      "custom.param.25015": Joi.number().optional(),
      "custom.param.25016": Joi.number().optional(),
      "custom.param.25017": Joi.number().optional(),
      "device.id": Joi.number(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number(),
      "event.enum": Joi.number().optional(),
      "event.priority.enum": Joi.number(),
      "gnss.state.enum": Joi.number(),
      "gnss.status": Joi.boolean(),
      "gsm.mcc": Joi.number(),
      "gsm.mnc": Joi.number(),
      "gsm.operator.code": Joi.string(),
      "gsm.signal.level": Joi.number(),
      "gsm.signal.quality": Joi.number().optional(),
      ident: Joi.string(),
      "modem.uptime": Joi.number().optional(),
      "movement.status": Joi.boolean(),
      "network.signal.rsrp": Joi.number().optional(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.hdop": Joi.number(),
      "position.latitude": Joi.number(),
      "position.longitude": Joi.number(),
      "position.pdop": Joi.number(),
      "position.satellites": Joi.number(),
      "position.speed": Joi.number(),
      "position.valid": Joi.boolean(),
      "protocol.id": Joi.number(),
      "recovery.alarm": Joi.boolean().optional(),
      "server.timestamp": Joi.number(),
      timestamp: Joi.number(),
    }).unknown(true),
  },
  507: {
    // GH5200
    typeA: Joi.object({
      "ble.beacons": Joi.array().items(Joi.object()),
      "channel.id": Joi.number().integer(),
      "codec.id": Joi.number().integer(),
      "device.id": Joi.number().integer(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number().integer().valid(507),
      "event.enum": Joi.number().integer(),
      "event.priority.enum": Joi.number().integer(),
      ident: Joi.string(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.satellites": Joi.number().integer(),
      "position.speed": Joi.number(),
      "protocol.id": Joi.number().integer(),
      "server.timestamp": Joi.number(),
      timestamp: Joi.number(),
      "battery.level": Joi.number().integer(),
      "battery.voltage": Joi.number(),
      "ble.sensor.humidity.1": Joi.number().integer(),
      "ble.sensor.humidity.2": Joi.number().integer(),
      "ble.sensor.humidity.3": Joi.number().integer(),
      "ble.sensor.humidity.4": Joi.number().integer(),
      "ble.sensor.low.battery.status.1": Joi.boolean(),
      "ble.sensor.magnet.count.1": Joi.number().integer(),
      "ble.sensor.magnet.status.1": Joi.boolean(),
      "ble.sensor.temperature.1": Joi.number(),
      "ble.sensor.temperature.2": Joi.number(),
      "ble.sensor.temperature.3": Joi.number(),
      "ble.sensor.temperature.4": Joi.number(),
      "bluetooth.state.enum": Joi.number().integer(),
      "channel.id": Joi.number().integer(),
      "codec.id": Joi.number().integer(),
      "custom.param.116": Joi.number().integer(),
      "device.id": Joi.number().integer(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number().integer().valid(507),
      "event.priority.enum": Joi.number().integer(),
      "gnss.sleep.mode.status": Joi.boolean(),
      "gnss.state.enum": Joi.number().integer(),
      "gsm.mcc": Joi.number().integer(),
      "gsm.mnc": Joi.number().integer(),
      "gsm.operator.code": Joi.string(),
      "gsm.signal.level": Joi.number().integer(),
      ident: Joi.string(),
      "movement.status": Joi.boolean(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.fix.age": Joi.number().integer(),
      "position.hdop": Joi.number(),
      "position.latitude": Joi.number(),
      "position.longitude": Joi.number(),
      "position.pdop": Joi.number(),
      "position.satellites": Joi.number().integer(),
      "position.speed": Joi.number(),
      "protocol.id": Joi.number().integer(),
      "server.timestamp": Joi.number(),
      "sleep.mode.enum": Joi.number().integer(),
      timestamp: Joi.number(),
    }).unknown(true),
  },

  508: {
    // TMT250
    typeA: Joi.object({
      "ble.beacons": Joi.array().items(Joi.object()),
      "channel.id": Joi.number().integer(),
      "codec.id": Joi.number().integer(),
      "device.id": Joi.number().integer(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number().integer().valid(508),
      "event.enum": Joi.number().integer(),
      "event.priority.enum": Joi.number().integer(),
      ident: Joi.string(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.satellites": Joi.number().integer(),
      "position.speed": Joi.number(),
      "protocol.id": Joi.number().integer(),
      "server.timestamp": Joi.number(),
      timestamp: Joi.number(),
      "battery.level": Joi.number().integer(),
      "battery.voltage": Joi.number(),
      "ble.sensor.humidity.1": Joi.number().integer(),
      "ble.sensor.low.battery.status.1": Joi.boolean(),
      "ble.sensor.magnet.count.1": Joi.number().integer(),
      "ble.sensor.magnet.status.1": Joi.boolean(),
      "ble.sensor.temperature.1": Joi.number(),
      "channel.id": Joi.number().integer(),
      "codec.id": Joi.number().integer(),
      "custom.param.116": Joi.number().integer(),
      "device.id": Joi.number().integer(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number().integer().valid(508),
      "event.priority.enum": Joi.number().integer(),
      "gnss.sleep.mode.status": Joi.boolean(),
      "gnss.state.enum": Joi.number().integer(),
      "gsm.mcc": Joi.number().integer(),
      "gsm.mnc": Joi.number().integer(),
      "gsm.operator.code": Joi.string(),
      "gsm.signal.level": Joi.number().integer(),
      ident: Joi.string(),
      "movement.status": Joi.boolean(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.hdop": Joi.number(),
      "position.pdop": Joi.number(),
      "position.satellites": Joi.number().integer(),
      "position.speed": Joi.number(),
      "protocol.id": Joi.number().integer(),
      "server.timestamp": Joi.number(),
      "sleep.mode.enum": Joi.number().integer(),
      timestamp: Joi.number(),
    }).unknown(true),
  },

  1338: {
    typeA: Joi.object({
      "ble.beacons": Joi.array()
        .items(
          Joi.object({
            id: Joi.string(),
            rssi: Joi.number(),
            //'battery.voltage': Joi.number().optional(),
            temperature: Joi.number().optional(),
            magnet: Joi.boolean().optional(), // Añadido
            type: Joi.string().optional(), // Añadido
            "mac.address": Joi.string().optional(),
          })
        )
        .optional(),
      "battery.current": Joi.number().optional(),
      "battery.voltage": Joi.number().optional(),
      "channel.id": Joi.number(),
      "codec.id": Joi.number(),
      "device.id": Joi.number(),
      "device.name": Joi.string(),
      "device.type.id": Joi.number(),
      "engine.ignition.status": Joi.boolean().optional(),
      "event.enum": Joi.number().optional(),
      "event.priority.enum": Joi.number(),
      "external.powersource.voltage": Joi.number().optional(),
      "gnss.state.enum": Joi.number().optional(),
      "gnss.status": Joi.boolean().optional(),
      "gsm.mcc": Joi.number().optional(),
      "gsm.mnc": Joi.number().optional(),
      "gsm.operator.code": Joi.string().optional(),
      "gsm.signal.level": Joi.number().optional(),
      ident: Joi.string(),
      "movement.status": Joi.boolean().optional(),
      peer: Joi.string(),
      "position.altitude": Joi.number(),
      "position.direction": Joi.number(),
      "position.hdop": Joi.number().optional(),
      "position.latitude": Joi.number(),
      "position.longitude": Joi.number(),
      "position.pdop": Joi.number().optional(),
      "position.satellites": Joi.number(),
      "position.speed": Joi.number(),
      "position.valid": Joi.boolean().optional(),
      "protocol.id": Joi.number(),
      "server.timestamp": Joi.number(),
      "sleep.mode.enum": Joi.number().optional(),
      timestamp: Joi.any(),
      "vehicle.mileage": Joi.number().optional(),
    }).unknown(true),
  },
};

// Helper function to get sector name based on beacon ID
const getSector = (beaconId) => {
  switch (beaconId) {
    case "0C403019-61C7-55AA-B7EA-DAC30C720055":
      return "E/S Bodega"; // Return sector name for specific beacon ID
    case "E9EB8F18-61C7-55AA-9496-3AC30C720055":
      return "Farmacia"; // Return sector name for specific beacon ID
    case "F7826DA6-BC5B-71E0-893E-4B484D67696F":
      return "Zona L3"; // Return sector name for specific beacon ID
    case "F7826DA6-BC5B-71E0-893E-6D424369696F":
      return "CalleCentralNorte"; // Return sector name for specific beacon ID
    case "F7826DA6-BC5B-71E0-893E-54654370696F":
      return "Frío 1234";
    case "F7826DA6-BC5B-71E0-893E-5A4B6C31454D":
      return "Entrada Poeta";
    case "F7826DA6-BC5B-71E0-893E-6D424369696F":
      return "CalleCentralCentro"; // Return sector name for specific beacon ID // Return sector name for specific beacon ID
    case "F7826DA6-BC5B-71E0-893E-594C35615774":
      return "CalleCentralSur";
    default:
      return "Unknown"; // Return 'Unknown' if beacon ID does not match any case
  }
};

router.post("/", async (req, res) => {
  const gpsDatas = Array.isArray(req.body) ? req.body : [req.body];
  console.log("Llego datos a gps_data");
  try {
    for (const gpsData of gpsDatas) {
      await processGpsData(gpsData);
    }
    res.status(200).send("GPS Data processed successfully");
  } catch (error) {
    console.error("Error processing GPS data:", error);
    res.status(500).send("Server Error");
  }
});

async function processGpsData(gpsData) {
  let deviceTypeId;
  // Determinar el tipo de dispositivo
  if (gpsData["device.type.id"]) {
    deviceTypeId = gpsData["device.type.id"];
  } else {
    // Mapeo de ident a device.type.id
    const identToTypeMap = {
      869671071061129: 2313, // Para mensajes del dispositivo específico
      default: 1338, // Tipo por defecto
    };
    deviceTypeId = identToTypeMap[gpsData.ident] || identToTypeMap.default;
    // Añadir el device.type.id a los datos para validación
    gpsData["device.type.id"] = deviceTypeId;
  }

  const schema = schemas[deviceTypeId];
  if (!schema) {
    throw new Error(`Unknown device type: ${deviceTypeId}`);
  }

  console.log("Processing data for device type:", deviceTypeId);
  console.log("ble_beacons:", gpsData["ble.beacons"]);

  let validatedData;
  try {
    validatedData = await schema.typeA.validateAsync(gpsData);
  } catch (err) {
    console.error(`Validation failed for device type ${deviceTypeId}:`, err);
    throw err;
  }

  const columns = [
    "device_id",
    "device_name",
    "device_type_id",
    "event_enum",
    "event_priority_enum",
    "ident",
    "peer",
    "altitude",
    "direction",
    "latitude",
    "longitude",
    "satellites",
    "speed",
    "protocol_id",
    "server_timestamp",
    "timestamp",
    "ble_beacons",
    "channel_id",
    "codec_id",
    "battery_level",
    "battery_voltage",
    "battery_current",
    "ble_sensor_humidity_1",
    "ble_sensor_humidity_2",
    "ble_sensor_humidity_3",
    "ble_sensor_humidity_4",
    "ble_sensor_low_battery_status_1",
    "ble_sensor_low_battery_status_2",
    "ble_sensor_magnet_status_1",
    "ble_sensor_magnet_status_2",
    "ble_sensor_magnet_count_1",
    "ble_sensor_magnet_count_2",
    "ble_sensor_temperature_1",
    "ble_sensor_temperature_2",
    "ble_sensor_temperature_3",
    "ble_sensor_temperature_4",
    "bluetooth_state_enum",
    "gnss_state_enum",
    "gnss_status",
    "gsm_mcc",
    "gsm_mnc",
    "gsm_operator_code",
    "gsm_signal_level",
    "movement_status",
    "position_hdop",
    "position_pdop",
    "position_valid",
    "position_fix_age",
    "sleep_mode_enum",
    "custom_param_116",
    "vehicle_mileage",
  ];

  const query = `INSERT INTO gps_data (${columns.join(", ")}) VALUES (${columns
    .map(() => "?")
    .join(", ")})`;

  const timestamp =
    typeof validatedData.timestamp === "number"
      ? validatedData.timestamp
      : parseFloat(validatedData.timestamp);

  const params = [
    validatedData["device.id"],
    validatedData["device.name"] || validatedData.ident,
    deviceTypeId,
    validatedData["event.enum"] || null,
    validatedData["event.priority.enum"],
    validatedData.ident,
    validatedData.peer,
    validatedData["position.altitude"],
    validatedData["position.direction"],
    validatedData["position.latitude"],
    validatedData["position.longitude"],
    validatedData["position.satellites"],
    validatedData["position.speed"],
    validatedData["protocol.id"],
    Math.floor(validatedData["server.timestamp"]),
    Math.floor(timestamp),
    JSON.stringify(validatedData["ble.beacons"] || []),
    validatedData["channel.id"],
    validatedData["codec.id"],
    null, // battery_level
    validatedData["battery.voltage"] || null,
    validatedData["battery.current"] || null,
    validatedData["ble.sensor.humidity.1"] || null,
    validatedData["ble.sensor.humidity.2"] || null,
    validatedData["ble.sensor.humidity.3"] || null,
    validatedData["ble.sensor.humidity.4"] || null,
    false, // ble_sensor_low_battery_status_1
    false, // ble_sensor_low_battery_status_2
    false, // ble_sensor_magnet_status_1
    false, // ble_sensor_magnet_status_2
    null, // ble_sensor_magnet_count_1
    null, // ble_sensor_magnet_count_2
    null, // ble_sensor_temperature_1
    null, // ble_sensor_temperature_2
    null, // ble_sensor_temperature_3
    null, // ble_sensor_temperature_4
    null, // bluetooth_state_enum
    validatedData["gnss.state.enum"] || null,
    validatedData["gnss.status"] || false,
    validatedData["gsm.mcc"] || null,
    validatedData["gsm.mnc"] || null,
    validatedData["gsm.operator.code"] || null,
    validatedData["gsm.signal.level"] || null,
    validatedData["movement.status"] || false,
    validatedData["position.hdop"] || null,
    validatedData["position.pdop"] || null,
    validatedData["position.valid"] || false,
    null, // position_fix_age
    validatedData["sleep.mode.enum"] || null,
    null, // custom_param_116
    validatedData["vehicle.mileage"] || null,
  ];

  try {
    await require("../services/database-service").query(query, params);
    console.log("Datos insertados en gps_data");

    if (
      validatedData["ble.beacons"] &&
      validatedData["ble.beacons"].length > 0
    ) {
      await procesarPosibleIncidencia(
        validatedData["device.name"] || validatedData.ident,
        validatedData["ble.beacons"],
        Math.floor(timestamp),
        validatedData["event.enum"]
      );
    }
  } catch (error) {
    console.error("SQL Error:", error);
    console.error("Query:", query);
    console.error("Params:", params);
    throw error;
  }
}
module.exports = router;

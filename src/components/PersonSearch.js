import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../assets/css/PersonSearch.css";
import Header from "./Header";

// Importa las imágenes
import personal1Icon from "./assets/images/general/forklift_orange_1.png";
import personal2Icon from "./assets/images/general/forklift_Blue_2.png";
import personal3Icon from "./assets/images/general/forklift_red_3.png";
import planoSectores from "./assets/images/planos/PLANO_STORAGE_Zonas.jpg";

function PersonSearch() {
  const [selectedDay, setSelectedDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [umbrales, setUmbrales] = useState({});
  const [devices, setDevices] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const today = useRef(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const response = await axios.get("/api/config/umbrales");
        setUmbrales(response.data);
      } catch (error) {
        console.error("Error fetching thresholds:", error);
      }
    };
    fetchThresholds();

    const fetchDevices = async () => {
      try {
        const response = await axios.get("/api/devices");
        setDevices(response.data);
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    };
    fetchDevices();

    const fetchPersonal = async () => {
      try {
        const response = await axios.get("/api/personal/personal");
        setPersonal(response.data);
      } catch (error) {
        console.error("Error fetching personal:", error);
      }
    };
    fetchPersonal();
  }, []);

  const fetchSearchResults = async () => {
    const startDateTime = `${selectedDay}T${startTime}:00`;
    const endDateTime = `${selectedDay}T${endTime}:00`;

    try {
      const response = await axios.get("/api/beacon-entries-exits", {
        params: {
          startDate: startDateTime,
          endDate: endDateTime,
          device_id: selectedDeviceId,
        },
      });
      console.log("Data received:", response.data);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  };

  const clearSearchResults = () => {
    setSearchResults([]);
  };

  const handleDeviceChange = (e) => {
    setSelectedDeviceId(e.target.value);
    clearSearchResults();
  };

  const handleSearch = () => {
    const startDateTime = new Date(`${selectedDay}T${startTime}`);
    const endDateTime = new Date(`${selectedDay}T${endTime}`);
    const currentDate = new Date();

    if (new Date(selectedDay) > currentDate) {
      alert("La fecha seleccionada no puede ser posterior a la fecha actual.");
      return;
    }

    if (endDateTime <= startDateTime) {
      alert("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    fetchSearchResults();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getSector = (beaconId) => {
    switch (beaconId) {
      case "0C403019-61C7-55AA-B7EA-DAC30C720055":
        return { text: "E/S Bodega", className: "sector-bodega" };
      case "E9EB8F18-61C7-55AA-9496-3AC30C720055":
        return { text: "Farmacia", className: "sector-farmacia" };
      case "F7826DA6-BC5B-71E0-893E-4B484D67696F":
        return { text: "Zona L3", className: "sector-entrada" };
      case "F7826DA6-BC5B-71E0-893E-6D424369696F":
        return { text: "Calle Central Norte", className: "sector-pasillo" };
      case "F7826DA6-BC5B-71E0-893E-54654370696F":
        return { text: "Frío 1234", className: "sector-electro" };
      case "F7826DA6-BC5B-71E0-893E-5A4B6C31454D":
        return { text: "Entrada Poeta", className: "sector-entradapoeta" };
      case "F7826DA6-BC5B-71E0-893E-594C35615774":
        return { text: "CalleCentralSur", className: "sector-callecentralsur" };
      case "F7826DA6-BC5B-71E0-893E-30334571386D":
        return {
          text: "CalleCentralCentro",
          className: "sector-callecentralsur",
        };
      default:
        return { text: "Unknown", className: "" };
    }
  };

  const calculatePermanence = (entrada, salida) => {
    const start = new Date(entrada);
    const end = salida ? new Date(salida) : new Date();
    const duration = end - start;

    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getSemaphoreClass = (permanenceMinutes) => {
    if (permanenceMinutes <= umbrales.umbral_verde) {
      return "green";
    } else if (
      permanenceMinutes > umbrales.umbral_verde &&
      permanenceMinutes <= umbrales.umbral_amarillo
    ) {
      return "yellow";
    } else if (permanenceMinutes > umbrales.umbral_amarillo) {
      return "red";
    }

    return "";
  };

  const getPersonalIcon = (imageName) => {
    switch (imageName) {
      case "Personal 1.png":
        return personal1Icon;
      case "Personal 2.png":
        return personal2Icon;
      case "Personal 3.png":
        return personal3Icon;
      default:
        return null;
    }
  };

  const getPersonalInfo = (deviceId) => {
    const person = personal.find((p) => p.id_dispositivo_asignado === deviceId);
    if (person) {
      return {
        name: person.Nombre_Personal,
        image: getPersonalIcon(person.imagen_asignado),
      };
    }
    return {
      name: "Unknown",
      image: null,
    };
  };

  return (
    <div className="person-search">
      <Header title="Busqueda Histórica Ubicación Interiores" />
      <div className="image-container">
        <img
          src={planoSectores}
          alt="Plano Sectores"
          className="plano-sectores"
        />
      </div>
      <div className="search-container">
        <div className="device-selection">
          <select onChange={handleDeviceChange}>
            <option value="">Seleccionar Dispositivo...</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.device_asignado}
              </option>
            ))}
          </select>
        </div>
        <div className="date-time-selection">
          <div className="date-time-inputs">
            <div className="date-time-input">
              <label>Seleccionar Día:</label>
              <input
                type="date"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                max={today.current}
              />
            </div>
            <div className="date-time-input">
              <label>Hora Inicio:</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="date-time-input">
              <label>Hora Fin:</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                min={startTime}
              />
            </div>
          </div>
        </div>
        <button onClick={handleSearch}>Buscar</button>
      </div>
      <table className="search-results-table">
        <thead>
          <tr>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Sector</th>
            <th>Desde Detección</th>
            <th>Permanencia</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {searchResults.map((result, index) => {
            const sector = getSector(result.beaconId);
            const permanence = calculatePermanence(
              result.entrada,
              result.salida
            );
            const permanenceMinutes =
              (new Date(result.salida ? result.salida : new Date()) -
                new Date(result.entrada)) /
              (1000 * 60);
            const semaphoreClass = getSemaphoreClass(permanenceMinutes);
            const personalInfo = getPersonalInfo(selectedDeviceId);
            return (
              <tr key={index}>
                <td className="image-cell">
                  {personalInfo.image && (
                    <img
                      src={personalInfo.image}
                      alt={personalInfo.name}
                      className="personal-image"
                    />
                  )}
                </td>
                <td>{personalInfo.name}</td>
                <td className={sector.className}>{sector.text}</td>
                <td>{formatDate(result.entrada)}</td>
                <td>{permanence}</td>
                <td className={semaphoreClass}>
                  {semaphoreClass
                    .replace("green", "On Time")
                    .replace("yellow", "Over Time")
                    .replace("red", "Past Deadline")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default PersonSearch;

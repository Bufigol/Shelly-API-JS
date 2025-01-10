//components/DataIntelligence.js

import React, { useState, useEffect } from "react";
import axios from "axios";
import "../assets/css/DataIntelligence.css";
import Header from "./Header";
import interiorSearchImage from "../assets/images/interior_search.png";
import exteriorSearchImage from "../assets/images/exterior_search.png";
import personal1Icon from "../assets/images/Personal 1.png";
import personal2Icon from "../assets/images/Personal 2.png";
import personal3Icon from "../assets/images/Personal 3.png";

const searchOptions = [
  {
    title: "Búsqueda de Datos de Interiores",
    image: interiorSearchImage,
    option: "interior",
  },
  {
    title: "Búsqueda de Datos de Exteriores",
    image: exteriorSearchImage,
    option: "exterior",
  },
];

function DataIntelligence() {
  const [selectedOption, setSelectedOption] = useState(null);
  const [selectedDay, setSelectedDay] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [umbrales, setUmbrales] = useState({});
  const [devices, setDevices] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

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
        const response = await axios.get("/api/devices/devices");
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
      const response = await axios.get("/api/beacons/beacon-entries-exits", {
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

  const fetchOutdoorResults = async () => {
    const startDateTime = `${selectedDay}T${startTime}:00`;
    const endDateTime = `${selectedDay}T${endTime}:00`;

    try {
      const response = await axios.get("/api/gps/historical-gps-data", {
        params: {
          device_id: selectedDeviceId,
          date: selectedDay,
          startHour: startTime,
          endHour: endTime,
        },
      });
      console.log("Data received:", response.data);
      setSearchResults(
        response.data.filter((d) => d.latitude !== null && d.longitude !== null)
      );
    } catch (error) {
      console.error("Error fetching outdoor search results:", error);
    }
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
        return { text: "Entrada", className: "sector-entrada" };
      case "F7826DA6-BC5B-71E0-893E-6D424369696F":
        return { text: "Pasillo Central", className: "sector-pasillo" };
      case "F7826DA6-BC5B-71E0-893E-54654370696F":
        return { text: "Electro", className: "sector-electro" };
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

  const downloadCSV = () => {
    const headers =
      selectedOption === "interior"
        ? ["Personal", "Sector", "Desde Detección", "Permanencia", "Estado"]
        : ["Hora", "Latitud", "Longitud"];

    const rows =
      selectedOption === "interior"
        ? searchResults.map((result) => {
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
            return [
              personalInfo.name,
              sector.text,
              formatDate(result.entrada),
              permanence,
              semaphoreClass,
            ];
          })
        : searchResults.map((result) => [
            result.timestamp,
            result.latitude,
            result.longitude,
          ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `historical_movements_${selectedDay}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="data-intelligence">
      <Header title="Inteligencia de Datos" />
      <div className="options-container">
        {searchOptions.map((option) => (
          <div
            key={option.option}
            className={`option-card ${
              selectedOption && selectedOption !== option.option
                ? "transparent"
                : "selected"
            }`}
            onClick={() => setSelectedOption(option.option)}
          >
            <img src={option.image} alt={option.title} />
            <h3>{option.title}</h3>
          </div>
        ))}
      </div>
      <br />
      <div className="separator">
        <span>Seleccione los argumentos de búsqueda</span>
      </div>
      {selectedOption && (
        <div className="person-search">
          {selectedOption === "interior" && (
            <>
              <div className="search-container">
                <div className="device-selection">
                  <select onChange={(e) => setSelectedDeviceId(e.target.value)}>
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
                      />
                    </div>
                  </div>
                </div>
                <button onClick={fetchSearchResults} className="button">
                  Buscar
                </button>
                <button
                  onClick={downloadCSV}
                  className={`button ${
                    searchResults.length > 0 ? "button-active" : ""
                  }`}
                  disabled={searchResults.length === 0}
                >
                  Descargar Resultados
                </button>
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
            </>
          )}
          {selectedOption === "exterior" && (
            <>
              <div className="search-container">
                <div className="device-selection">
                  <select onChange={(e) => setSelectedDeviceId(e.target.value)}>
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
                      />
                    </div>
                  </div>
                </div>
                <button onClick={fetchOutdoorResults} className="button">
                  Buscar
                </button>
                <button
                  onClick={downloadCSV}
                  className={`button ${
                    searchResults.length > 0 ? "button-active" : ""
                  }`}
                  disabled={searchResults.length === 0}
                >
                  Descargar Resultados
                </button>
              </div>
              <table className="search-results-table">
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Latitud</th>
                    <th>Longitud</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((result, index) => (
                    <tr key={index}>
                      <td>{result.timestamp}</td>
                      <td>{result.latitude}</td>
                      <td>{result.longitude}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default DataIntelligence;

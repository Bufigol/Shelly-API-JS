/* components/HistoricalMovementsSearch.js */

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import mapboxgl from "mapbox-gl";
import '../assets/css/HistoricalMovementsSearch.css';
import markerIcon from "../assets/images/pinazul.png";
import Header from "./Header";
import "./utils/backButtonHandler.js";

//api keys
const config = require("../config/config.json");
mapboxgl.accessToken = config.maps.api_key;

const HistoricalMovementsSearch = () => {
  const [devices, setDevices] = useState([]);
  const [device, setDevice] = useState("");
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [data, setData] = useState([]);
  const [map, setMap] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const today = useRef(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const result = await axios.get("/api/devices/devices");
        console.log("Fetched devices:", result.data);
        setDevices(result.data);
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    };

    fetchDevices();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting form with values:", {
      device,
      date,
      startHour,
      endHour,
    });

    // Validación de fecha
    if (new Date(date) > new Date()) {
      setErrorMessage(
        "La fecha seleccionada no puede ser posterior a la fecha actual."
      );
      return;
    }

    // Validación de horas
    if (startHour >= endHour) {
      setErrorMessage("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }

    try {
      const result = await axios.get("/api/gps/historical-gps-data", {
        params: {
          device_id: device,
          date,
          startHour,
          endHour,
        },
      });
      console.log("Response data:", result.data);
      const validData = result.data.filter(
        (d) => d.latitude !== null && d.longitude !== null
      );
      setData(validData);
      if (validData.length > 0) {
        setErrorMessage("");
        plotRoute(validData);
      } else {
        setErrorMessage("Sin Datos para esa Búsqueda");
      }
    } catch (error) {
      console.error("Error fetching historical GPS data:", error);
      setErrorMessage("Error al buscar los datos GPS históricos");
    }
  };

  const plotRoute = (gpsData) => {
    console.log("Plotting route with GPS data:", gpsData);

    if (map) {
      map.remove();
    }

    const mapInstance = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-70.6693, -33.4489],
      zoom: 10,
    });

    const nav = new mapboxgl.NavigationControl();
    mapInstance.addControl(nav, "top-right");

    // Estilizar los controles de navegación
    const navElement = nav._container;
    navElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    navElement.querySelectorAll("button").forEach((button) => {
      button.style.color = "red";
      button.style.backgroundColor = "rgba(0, 0, 0, 0.10)";
      button.style.border = "white";
    });
    navElement.querySelectorAll("svg").forEach((svg) => {
      svg.style.fill = "white";
    });

    setMap(mapInstance);

    const coordinates = gpsData.map((data) => [
      parseFloat(data.longitude),
      parseFloat(data.latitude),
    ]);

    console.log("Coordinates:", coordinates);

    if (coordinates.length > 0) {
      mapInstance.on("load", () => {
        mapInstance.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates,
            },
          },
        });

        mapInstance.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#FF0000",
            "line-width": 6,
          },
        });

        coordinates.forEach((coord) => {
          new mapboxgl.Marker({ element: createCustomMarker() })
            .setLngLat(coord)
            .addTo(mapInstance);
        });

        // Adjust the map view to the bounds of the coordinates
        const bounds = coordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        mapInstance.fitBounds(bounds, { padding: 50 });
      });
    } else {
      console.log("No coordinates to plot.");
    }
  };

  const createCustomMarker = () => {
    const marker = document.createElement("div");
    marker.style.backgroundImage = `url(${markerIcon})`;
    marker.style.width = "20px";
    marker.style.height = "24px";
    marker.style.backgroundSize = "100%";
    return marker;
  };

  return (
    <div className="historical-movements-search">
      <Header title="Ubicación Exteriores Tiempo Real" />
      <form onSubmit={handleSubmit} className="search-container">
        <div className="device-selection">
          <select value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="">Seleccione un dispositivo</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.device_asignado}
              </option>
            ))}
          </select>
        </div>
        <div className="date-time-selection">
          <div className="date-input">
            <label htmlFor="date-picker">Fecha:</label>
            <input
              id="date-picker"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today.current}
            />
          </div>
          <div className="time-inputs">
            <div className="time-input">
              <label htmlFor="start-time">Hora de inicio:</label>
              <input
                id="start-time"
                type="time"
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
              />
            </div>
            <div className="time-input">
              <label htmlFor="end-time">Hora de fin:</label>
              <input
                id="end-time"
                type="time"
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
              />
            </div>
          </div>
        </div>
        <button type="submit">Buscar</button>
      </form>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
      <div id="map" className="map"></div>
      {data.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Hora</th>
              <th>Latitud</th>
              <th>Longitud</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.timestamp}</td>
                <td>{item.latitude}</td>
                <td>{item.longitude}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default HistoricalMovementsSearch;

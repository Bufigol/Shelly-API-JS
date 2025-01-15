/* components/LastKnownPosition.js */

import "mapbox-gl/dist/mapbox-gl.css";

import React, { useState, useEffect, useRef } from "react";
import MapboxGL from "mapbox-gl";
import axios from "axios";
import moment from "moment";
import Header from "./Header";
import "../assets/css/LastKnownPosition.css";

MapboxGL.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const defaultPosition = { lat: -33.4489, lng: -70.6693 };

function LastKnownPosition({ showHeader = true }) {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [positions, setPositions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const response = await axios.get("/api/devices/devices");
        console.log("Fetched devices:", response.data);
        setDevices(response.data);
      } catch (error) {
        console.error("Error fetching devices:", error);
      }
    };

    fetchDevices();
  }, []);

  const fetchLastKnownPosition = async () => {
    setIsLoading(true);
    setError(null);
    setShowTable(false);
    setSelectedPosition(null);
    try {
      const endpoint = "/api/gps/last-known-position";
      const params = { ident: selectedDeviceId };
      const response = await axios.get(endpoint, { params });

      if (response.data) {
        console.log("Response data:", response.data);

        const currentTime = moment().valueOf();
        const tenMinutesAgo = moment().subtract(10, "minutes").valueOf();
        const isRecent =
          response.data.unixTimestamp > tenMinutesAgo &&
          response.data.unixTimestamp <= currentTime;

        setPositions([
          {
            ...response.data,
            isRecent,
            latitude: response.data.latitude || defaultPosition.lat,
            longitude: response.data.longitude || defaultPosition.lng,
            timestamp: response.data.unixTimestamp,
          },
        ]);
      } else {
        setPositions([]);
      }
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log("Error: No data available");
        setError("No data available");
      } else {
        console.error("Failed to fetch last known position:", error);
        setError("Server Error");
      }
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDeviceId) {
      fetchLastKnownPosition();
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = new MapboxGL.Map({
        container: "map",
        style: "mapbox://styles/mapbox/streets-v11",
        center: [defaultPosition.lng, defaultPosition.lat],
        zoom: 15,
      });
    }
  }, []);

  useEffect(() => {
    Object.keys(markersRef.current).forEach((key) => {
      markersRef.current[key].remove();
      delete markersRef.current[key];
    });

    if (positions.length > 0 && mapRef.current) {
      positions.forEach((position) => {
        const lat = parseFloat(position.latitude);
        const lng = parseFloat(position.longitude);

        if (isNaN(lat) || isNaN(lng)) {
          console.error("Invalid coordinates:", { lat, lng });
          return;
        }

        if (!markersRef.current[position.ident]) {
          const el = document.createElement("div");
          el.className = "custom-marker";
          el.style.backgroundColor = position.isRecent ? "green" : "red";
          el.style.width = "20px";
          el.style.height = "20px";
          el.style.borderRadius = "50%";
          el.style.border = "2px solid white";
          markersRef.current[position.ident] = new MapboxGL.Marker(el);
        }

        const marker = markersRef.current[position.ident];
        marker.setLngLat([lng, lat]).addTo(mapRef.current);

        const formattedTime = moment(position.timestamp).format(
          "DD-MM-YYYY, HH:mm:ss"
        );
        const popup = new MapboxGL.Popup({ offset: 25 }).setHTML(
          `<div style="background-color: ${
            position.isRecent ? "lightgreen" : "lightcoral"
          }; padding: 10px;">
            <strong>Time:</strong> ${formattedTime}<br/>
            <strong>Lat:</strong> ${lat.toFixed(6)}<br/>
            <strong>Lng:</strong> ${lng.toFixed(6)}
           </div>`
        );

        marker.setPopup(popup).togglePopup();

        marker.getElement().addEventListener("click", () => {
          setSelectedPosition({
            time: formattedTime,
            lat,
            lng,
            isRecent: position.isRecent,
          });
          setShowTable(true);
        });

        mapRef.current.setCenter([lng, lat]);
      });
    }
  }, [positions, selectedDeviceId]);

  return (
    <div>
      {showHeader && <Header title="Ubicación Exteriores Tiempo Real" />}
      {error && <div className="error-message">Error: {error}</div>}

      <div className="device-selection-popup">
        <h3>Seleccionar Dispositivo</h3>
        <select
          onChange={(e) => {
            setSelectedDeviceId(e.target.value);
            setError(null);
            setShowTable(false);
          }}
        >
          <option value="">Seleccionar...</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.device_asignado}
            </option>
          ))}
        </select>
        <button
          onClick={fetchLastKnownPosition}
          disabled={!selectedDeviceId || isLoading}
        >
          {isLoading ? "Actualizando..." : "Actualizar Datos"}
        </button>
      </div>

      <div
        id="map"
        className="map-container"
        style={{ marginTop: showHeader ? "150px" : "0px" }}
      ></div>

      {selectedDeviceId && positions.length === 0 && !error && (
        <div className="no-data-message">
          Sin datos disponibles para el dispositivo seleccionado.
        </div>
      )}

      {showTable && selectedPosition && (
        <div className="last-known-info">
          <table className="info-table">
            <thead>
              <tr>
                <th>Información</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr
                style={{
                  backgroundColor: selectedPosition.isRecent
                    ? "lightgreen"
                    : "lightcoral",
                }}
              >
                <td>Última Actualización</td>
                <td>{selectedPosition.time}</td>
              </tr>
              <tr>
                <td>Latitud</td>
                <td>{selectedPosition.lat.toFixed(6)}</td>
              </tr>
              <tr>
                <td>Longitud</td>
                <td>{selectedPosition.lng.toFixed(6)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default LastKnownPosition;
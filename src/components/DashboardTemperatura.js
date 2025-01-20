// DashboardTemperatura.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import moment from "moment";
import "../assets/css/DashboardTemperatura.css";
import Header from "./Header";

const SevenSegmentDisplay = ({ value }) => {
  const formattedValue = value.toFixed(1).padStart(5, " ");
  return (
    <div className="seven-segment-display">
      {formattedValue.split("").map((char, index) => (
        <span key={index} className="segment">
          {char}
        </span>
      ))}
    </div>
  );
};

const DashboardTemperatura = () => {
  const [temperatureData, setTemperatureData] = useState([]);

  useEffect(() => {
    fetchTemperatureData();
    const intervalId = setInterval(fetchTemperatureData, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchTemperatureData = async () => {
    try {
      const response = await axios.get("/api/ubibot/temperature-dashboard-data");
      if (Array.isArray(response.data) && response.data.length > 0) {
        const formattedData = response.data.map((item) => ({
          ...item,
          external_temperature: parseFloat(item.external_temperature),
        }));
        setTemperatureData(formattedData);
      }
    } catch (error) {
      console.error("Error fetching temperature data:", error);
    }
  };

  return (
    <div className="dashboard-temperatura">
      <Header title="Temperatura Actual" />
      <div className="dashboard-content">
        <div className="temperature-grid">
          {temperatureData.map((item) => (
            <div key={item.channel_id} className="temperature-card">
              <SevenSegmentDisplay value={item.external_temperature} />
              <div className="temperature-info">
                <div className="temperature-name">{item.name}</div>
                <div className="temperature-date">
                  {item.external_temperature_timestamp && (
                    <span>
                      Actualizado:{" "}
                      {moment(item.external_temperature_timestamp).format(
                        "DD/MM/YYYY HH:mm"
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardTemperatura;
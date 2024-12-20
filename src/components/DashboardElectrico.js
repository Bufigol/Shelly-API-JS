import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';
import '../assets/css/DashboardElectrico.css';
import Header from './Header';


const PowerDisplay = ({ value }) => {
  const formattedValue = value.toFixed(1).padStart(5, ' ');
  return (
    <div className="seven-segment-display">
      {formattedValue.split('').map((char, index) => (
        <span key={index} className="segment">
          {char}
        </span>
      ))}
    </div>
  );
};

const DashboardElectrico = () => {
  const [deviceData, setDeviceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDeviceData();
    const intervalId = setInterval(fetchDeviceData, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchDeviceData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/devices/latest-measurements');
      
      if (response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
        setDeviceData(response.data.data);
        setError(null);
      } else {
        setError('No hay datos disponibles');
      }
    } catch (error) {
      setError('Error al cargar los datos');
      console.error('Error fetching device data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container">Cargando datos...</div>;
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  return (
    <div className="dashboard-electrico">
      <Header title="Potencia Activa" />
      <div className="dashboard-container">
        <div className="electric-display-grid">
          {deviceData.map((item) => (
            <div key={item.deviceId} className="electric-display">
            <PowerDisplay value={item.activePower} />
            <div className="electric-channel">
              {item.location}
            </div>
            <div className="electric-date">
              <span>Actualizado: {moment(item.lastUpdate).format('DD/MM/YYYY HH:mm')}</span>
            </div>
          </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardElectrico;
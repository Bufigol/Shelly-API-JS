import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';
import '../assets/css/DashboardElectrico.css';
import Header from './Header';

const PowerDisplay = ({ value }) => {
  return (
    <div className="seven-segment-display">
      <span className="segment">{value.toFixed(1).padStart(5, ' ')}</span>
    </div>
  );
};

const DashboardElectrico = () => {
  const [deviceData, setDeviceData] = useState([]);

  useEffect(() => {
    fetchDeviceData();
    const intervalId = setInterval(fetchDeviceData, 60000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchDeviceData = async () => {
    try {
      const response = await axios.get('/api/devices/latest-measurements');
      console.log('Raw device data:', response.data);
      
      if (response.data.success && Array.isArray(response.data.data) && response.data.data.length > 0) {
        setDeviceData(response.data.data);
      } else {
        console.error('Invalid data structure received from API');
      }
    } catch (error) {
      console.error('Error fetching device data:', error);
    }
  };

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
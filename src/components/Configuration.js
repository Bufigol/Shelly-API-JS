import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../assets/css/Configuration.css';
import Header from './Header';

const Configuration = () => {
  const [sectors, setSectors] = useState([]);
  const [config, setConfig] = useState({
    umbralVerde: '',
    umbralAmarillo: '',
    umbralRojo: '',
    umbralTemperaturaMinimo: '',
    umbralTemperaturaMaximo: '',
  });

  useEffect(() => {
    const fetchSectors = async () => {
      try {
        const response = await axios.get('/api/sectores/listar-sectores');
        setSectors(response.data);
      } catch (error) {
        console.error('Error fetching sectors:', error);
      }
    };

    const fetchConfiguration = async () => {
      try {
        const [configResponse, tempResponse] = await Promise.all([
          axios.get('/api/config/teltonica/parametros'),
          axios.get('/api/config/teltonica/temperatura-umbrales')
        ]);
        
        const configData = configResponse.data.reduce((acc, cur) => {
          acc[`beacon_${cur.beacon_id}_minTiempoPermanencia`] = cur.min_tiempo_permanencia;
          acc[`beacon_${cur.beacon_id}_maxTiempoPermanencia`] = cur.max_tiempo_permanencia;
          acc.umbralVerde = cur.umbral_verde;
          acc.umbralAmarillo = cur.umbral_amarillo;
          acc.umbralRojo = cur.umbral_rojo;
          return acc;
        }, {});

        const tempData = tempResponse.data;
        configData.umbralTemperaturaMinimo = tempData.minimo;
        configData.umbralTemperaturaMaximo = tempData.maximo;

        setConfig(configData);
      } catch (error) {
        console.error('Error fetching configuration:', error);
      }
    };

    fetchSectors();
    fetchConfiguration();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig({ ...config, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const configuraciones = sectors.map(sector => ({
      beacon_id: sector.id,
      min_tiempo_permanencia: config[`beacon_${sector.id}_minTiempoPermanencia`] || 0,
      max_tiempo_permanencia: config[`beacon_${sector.id}_maxTiempoPermanencia`] || 0,
      umbral_verde: config.umbralVerde || 0,
      umbral_amarillo: config.umbralAmarillo || 0,
      umbral_rojo: config.umbralRojo || 0,
    }));

    const temperaturaUmbrales = {
      minimo: config.umbralTemperaturaMinimo,
      maximo: config.umbralTemperaturaMaximo,
    };

    try {
      await Promise.all([
        axios.post('/api/config/teltonica/parametros', configuraciones),
        axios.post('/api/config/teltonica/temperatura-umbrales', temperaturaUmbrales)
      ]);
      alert('Configuración guardada exitosamente.');
    } catch (error) {
      console.error('Error saving configuration:', error);
      alert('Error guardando la configuración.');
    }
  };

  return (
    <div className="configuration">
      <Header title="Configuración" />
      <form onSubmit={handleSubmit} className="configuration-form">
        <h2>Parámetros de Sector</h2>
        {sectors.map((sector) => (
          <div key={sector.id}>
            <div className="form-group">
              <label>{sector.nombre} - Tiempo Mínimo de Permanencia (minutos)</label>
              <input 
                type="number"
                name={`beacon_${sector.id}_minTiempoPermanencia`}
                value={config[`beacon_${sector.id}_minTiempoPermanencia`] || ''}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label>{sector.nombre} - Tiempo Máximo de Permanencia (minutos)</label>
              <input 
                type="number"
                name={`beacon_${sector.id}_maxTiempoPermanencia`}
                value={config[`beacon_${sector.id}_maxTiempoPermanencia`] || ''}
                onChange={handleChange}
              />
            </div>
          </div>
        ))}
        
        <h2>Umbrales de Semáforo</h2>
        <div className="form-group">
          <label>Umbral Verde (minutos)</label>
          <input 
            type="number"
            name="umbralVerde"
            value={config.umbralVerde}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Umbral Amarillo (minutos)</label>
          <input 
            type="number"
            name="umbralAmarillo"
            value={config.umbralAmarillo}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Umbral Rojo (minutos)</label>
          <input 
            type="number"
            name="umbralRojo"
            value={config.umbralRojo}
            onChange={handleChange}
          />
        </div>

        <h2>Umbrales de Temperatura</h2>
        <div className="form-group">
          <label>Umbral Mínimo de Temperatura (°C)</label>
          <input 
            type="number"
            name="umbralTemperaturaMinimo"
            value={config.umbralTemperaturaMinimo}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label>Umbral Máximo de Temperatura (°C)</label>
          <input 
            type="number"
            name="umbralTemperaturaMaximo"
            value={config.umbralTemperaturaMaximo}
            onChange={handleChange}
          />
        </div>
        
        <button type="submit" className="save-button">Guardar Configuración</button>
      </form>
    </div>
  );
};

export default Configuration;
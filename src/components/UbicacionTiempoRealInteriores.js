import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import moment from 'moment';
import '../assets/css/UbicacionTiempoRealInteriores.css';
import Header from './Header';
import planoBase from '../assets/images/planos/PLANO_STORAGE.jpg';
import personal1Icon from '../assets/images/forklift_orange_1.png';
import personal2Icon from '../assets/images/forklift_Blue_2.png';
import personal3Icon from '../assets/images/forklift_red_3.png';

const UbicacionTiempoRealInteriores = () => {
  const [personal, setPersonal] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [devices, setDevices] = useState([]);
  const [latestSectors, setLatestSectors] = useState({});
  const [umbrales, setUmbrales] = useState(null);
  const [currentTime, setCurrentTime] = useState(moment());
  const [activeBeacons, setActiveBeacons] = useState([]); // Añadir estado para beacons activos

  useEffect(() => {
    fetchData();
    fetchActiveBeacons(); // Llamar a fetchActiveBeacons al cargar el componente
  }, []);

  const fetchData = async () => {
    try {
      const [mapInfo, sectorInfo, umbralesInfo] = await Promise.all([
        axios.get('/api/sectores/retrive_MapWithQuadrants_information'),
        axios.get('/api/beacons/latest-sectors'),
        axios.get('/api/config/teltonica/umbrales')
      ]);
  
      setPersonal(mapInfo.data.personal);
      setSectors(mapInfo.data.sectors);
      setDevices(mapInfo.data.devices);
      setUmbrales(umbralesInfo.data);
      
      const sectorMap = sectorInfo.data.sectors.reduce((acc, item) => {
        acc[item.device_id] = item;
        return acc;
      }, {});
      setLatestSectors(sectorMap);
      setCurrentTime(moment(sectorInfo.data.serverTime));
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchActiveBeacons = async () => {
    try {
      const response = await axios.get('/api/beacons/active-beacons');
      const activeBeaconIds = response.data.activeBeaconIds || [];
      console.log('Active Beacons:', activeBeaconIds);
      setActiveBeacons(activeBeaconIds);
    } catch (error) {
      console.error('Failed to fetch active beacons:', error);
    }
  };

  const handleRefresh = () => {
    fetchData();
    fetchActiveBeacons(); // Llamar a fetchActiveBeacons al actualizar
  };

  // Función para obtener la imagen correspondiente
  const getPersonalIcon = (imageName) => {
    switch(imageName) {
      case 'Personal 1.png':
        return personal1Icon;
      case 'Personal 2.png':
        return personal2Icon;
      case 'Personal 3.png':
        return personal3Icon;
      default:
        return null;
    }
  };

  // Función para calcular el tiempo de permanencia
  const calculatePermanencia = (timeSinceDetection) => {
    if (!timeSinceDetection) return '00:00';
    return timeSinceDetection;
  };

  // Función para obtener la clase del semáforo
  const getSemaphoreClass = useCallback((beacon_id, timestamp) => {
    if (!timestamp || !umbrales) return '';
    const start = moment(timestamp, 'YYYY-MM-DD HH:mm:ss');
    const duration = moment.duration(currentTime.diff(start)).asMinutes();
    const { umbral_verde, umbral_amarillo } = umbrales;
    if (duration <= umbral_verde) {
      return 'green';
    } else if (duration > umbral_verde && duration <= umbral_amarillo) {
      return 'yellow';
    } else if (duration > umbral_amarillo) {
      return 'red';
    }
    return '';
  }, [umbrales, currentTime]);

  // Función para obtener el texto del semáforo
  const getSemaphoreText = (semaphoreClass) => {
    const texts = {
      green: 'On Time',
      yellow: 'Over Time',
      red: 'Past Deadline',
      '': 'N/A'
    };
    return texts[semaphoreClass];
  };

  const sectorPositions = {
    'Zona L3': { bottom: '80%', right: '55%', width: '2%' },
    'Farmacia': { bottom: '25%', right: '55%', width: '2%' },
    'Entrada': { bottom: '10%', right: '64%', width: '2%' },
    'CalleCentralNorte': { bottom: '73%', right: '45%', width: '2%' },
    'Frío 1234': { bottom: '58%', right: '30%', width: '4%' },
    'Entrada Poeta': { bottom: '38%', right: '64%', width: '2%' },
    'CalleCentralCentro' :  { bottom: '50%', right: '46%', width: '2%' }

  };

  const getSectorPosition = (sectorName, index) => {
    const basePosition = sectorPositions[sectorName] || { bottom: '0%', right: '0%', width: '2%' };
    const offset = 5 * index; // Ajustar el valor de offset según sea necesario
    return {
      ...basePosition,
      bottom: `calc(${basePosition.bottom} - ${offset}px)`,
      right: `calc(${basePosition.right} - ${offset}px)`
    };
  };

  const renderPersonnelIcons = () => {
    const sectorCounts = {};

    return personal.map((persona, index) => {
      const sectorInfo = latestSectors[persona.id_dispositivo_asignado] || {};
      const sectorName = sectorInfo.sector;
      if (!sectorCounts[sectorName]) {
        sectorCounts[sectorName] = 0;
      }
      const sectorPosition = getSectorPosition(sectorName, sectorCounts[sectorName]);
      sectorCounts[sectorName] += 1;
      console.log('Rendering persona:', persona.Nombre_Personal, 'Sector:', sectorName, 'Position:', sectorPosition);
      return (
        <img
          key={persona.id_personal}
          src={getPersonalIcon(persona.imagen_asignado)}
          alt={persona.Nombre_Personal}
          className="personal-icon"
          style={{ position: 'absolute', ...sectorPosition }}
        />
      );
    });
  };

  return (
    <div className="ubicacion-tiempo-real-interiores">
      <Header title="Ubicación Tiempo Real Interiores" />
      <button onClick={handleRefresh} className="refresh-button">Actualizar Datos</button>
      <table className="personnel-table">
        <thead>
          <tr>
            <th>Personal</th>
            <th>Nombre</th>
            <th>Sector</th>
            <th>Hora Entrada</th>
            <th>Permanencia (hh:mm)</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {personal.map((persona) => {
            const sectorInfo = latestSectors[persona.id_dispositivo_asignado] || {};
            const horaEntrada = sectorInfo.timestamp ? moment(sectorInfo.timestamp, 'YYYY-MM-DD HH:mm:ss').format('HH:mm') : '-';
            const permanencia = calculatePermanencia(sectorInfo.timestamp);
            const semaphoreClass = getSemaphoreClass(sectorInfo.beacon_id, sectorInfo.timestamp);
            const semaphoreText = getSemaphoreText(semaphoreClass);
            return (
              <tr key={persona.id_personal}>
                <td>
                  <img 
                    src={getPersonalIcon(persona.imagen_asignado)}
                    alt={persona.Nombre_Personal} 
                    className="personal-image"
                  />
                </td>
                <td>{persona.Nombre_Personal}</td>
                <td>{sectorInfo.sector || 'Cargando...'}</td>
                <td>{horaEntrada}</td>
                <td>{sectorInfo.timeSinceDetection || '00:00'}</td>
                <td><span className={`semaphore ${semaphoreClass}`}>{semaphoreText}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="plano-container" style={{ position: 'relative', width: '100%', height: 'auto' }}>
        <img src={planoBase} alt="Plano de la Oficina" className="plano-oficina" />
        {renderPersonnelIcons()}
      </div>
    </div>
  );
};

export default UbicacionTiempoRealInteriores;

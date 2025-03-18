// SelectRoutine.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import jwt from "jsonwebtoken";
import "../assets/css/SelectRoutine.css";
import Header from "./Header";
import dashboardImage from "../assets/images/dashboard.png";
import temperaturaImage from "../assets/images/temperatura.png";
import ubicaciontiemporealinteriorImage from "../assets/images/ubicaciontiemporealinterior.png";
import personSearchImage from "../assets/images/person_search.png";
import interiorLocationsImage from "../assets/images/plano_super.png";
import historicalMovementsImage from "../assets/images/historical_movements1.png";
import dataIntelligenceImage from "../assets/images/data_intelligence.png";
import configurationImage from "../assets/images/configuration.png";
import presenciaImage from "../assets/images/presencia.png";
import smsDataImage from "../assets/images/sms_data.png";
import doorStatusImage from "../assets/images/door_status.png";
import userRegistrationImage from "../assets/images/user_registration.png";
import thermometerImage from "../assets/images/thermometer.png";
import detectionImage from "../assets/images/detection.png";
import dashboardTemperaturaImage from "../assets/images/dashboard_temperatura.png";
import descargadatostemp from "../assets/images/descargadatostemp.png";
import paramTempIcon from "../assets/images/param_temp.png";
import frostIcon from "../assets/images/frost.png";
import thermo_electricImage from "../assets/images/thermo_electric.png";
import dashboard_electricImage from "../assets/images/dashboarelectrcio.png";
import consumototaldiario_electricImage from "../assets/images/consumototaldiario.png";
import consumoelectrico_electricImage from "../assets/images/consumoelectrico.png";
import consumototalmes_electricImage from "../assets/images/consumototalmes.png";
import consumototalano_electricImage from "../assets/images/consumototalano.png";

const routines = [
  { title: "Dashboard", image: dashboardImage, route: "/dashboard", permission: "view_dashboard" },
  { title: "Intrusiones Blind Spot", image: detectionImage, route: "/blind-spot-intrusions", permission: "view_blind_spot_intrusions" },

  { title: "Sectores Presencia Personal", image: presenciaImage, route: "/presencia", permission: "view_presence" },
  { title: "Mensajes SOS Visualización por Ubicación", image: smsDataImage, route: "/sms-data", permission: "view_sms" },
  { title: "Temperatura", image: temperaturaImage, route: "/temperatura", permission: "view_temperature" },
  {
    title: "Dashboard de Temperatura",
    image: dashboardTemperaturaImage,
    route: "/dashboard-temperatura",
    permission: "view_temperature_dashboard",
  },
  {
    title: "Temperaturas Cámaras de Frío",
    image: thermometerImage,
    route: "/temperatura-camaras",
    permission: "view_temperature_camaras",
  },
  {
    title: "Inteligencia de Datos Temperatura",
    image: descargadatostemp,
    route: "/inteligencia-datos-temperatura",
    permission: "view_temperature_data_intelligence",
  },

  {
    title: "Puertas Status Cierre / Apertura",
    image: doorStatusImage,
    route: "/door-status-matrix",
    permission: "view_door_status",
  },
  { title: "Datos Análisis Forense", image: dataIntelligenceImage, route: "/inteligencia-de-datos", permission: "view_data_intelligence" },
  { title: "Parametrización", image: configurationImage, route: "/configuracion", permission: "view_configuration" },


  {
    title: "Interior Ubicación en Tiempo Real",
    image: ubicaciontiemporealinteriorImage,
    route: "/ubicaciones-interior",
    permission: "view_interior",
  },
  {
    title: "Interior Búsqueda Histórica Ubicación",
    image: personSearchImage,
    route: "/busqueda-entradas-persona",
    permission: "search_interior",
  },
  {
    title: "Exterior Ubicación Tiempo Real",
    image: interiorLocationsImage,
    route: "/last-known-position",
    permission: "view_exterior",
  },
  {
    title: "Exterior Búsqueda Histórica Ubicación",
    image: historicalMovementsImage,
    route: "/consulta-historica-movimientos",
    permission: "search_exterior",
  },

  {
    title: "Análisis de Deshielo",
    image: frostIcon,
    route: "/analisis-deshielo",
    permission: "view_defrost_analysis",
  },
  {
    title: "Dashboard Electrico",
    image: dashboard_electricImage,
    route: "/dashboard-electrico",
    permission: "view_temperature_data_intelligence",
  },
  {
    title: "Análisis de Temperatura y Potencia",
    image: thermo_electricImage,
    route: "/analisis-temperatura-potencia",
    permission: "view_temperature_data_intelligence",
  },
  {
    title: "Consumo Electrico",
    image: consumoelectrico_electricImage,
    route: "/consumo-electrico",
    permission: "view_temperature_data_intelligence",
  },
  {
    title: "Consumo Total por Dia",
    image: consumototaldiario_electricImage,
    route: "/consumo-total-diario",
    permission: "view_temperature_data_intelligence",
  },
  {
    title: "Consumo Total por Mes",
    image: consumototalmes_electricImage,
    route: "/consumo-total-mensual",
    permission: "view_temperature_data_intelligence",
  },
  {
    title: "Consumo Total por Año",
    image: consumototalano_electricImage,
    route: "/consumo-total-anual",
    permission: "view_temperature_data_intelligence",
  },
  {
    title: "Parámetros Temperatura Cámaras",
    image: paramTempIcon,
    route: "/parametro-temp-camaras",
    permission: "view_temp_params",
  },
  
  {
    title: "Registrar Usuario",
    image: userRegistrationImage,
    route: "/register-user",
    permission: "create_users",
  }
];

const SelectRoutine = () => {
  const navigate = useNavigate();
  const [userPermissions, setUserPermissions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decodedToken = jwt.decode(token);
      setUserPermissions(decodedToken.permissions.split(","));
    }

    // Detectar si es un dispositivo móvil
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Verificar inicialmente
    checkMobile();

    // Agregar listener para cambios de tamaño
    window.addEventListener('resize', checkMobile);

    // Limpiar el listener cuando el componente se desmonte
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const handleCardClick = (routine) => {
    if (userPermissions.includes(routine.permission)) {
      navigate(routine.route, {
        state: { title: routine.title, image: routine.image },
      });
    } else {
      alert("No tienes permiso para acceder a esta rutina");
    }
  };

  const formatTitle = (title) => {
    // Versiones abreviadas para móviles
    if (isMobile) {
      const shortTitles = {
        "Intrusiones Blind Spot": "Intrusiones",
        "Sectores Presencia Personal": "Presencia",
        "Mensajes SOS Visualización por Ubicación": "SOS",
        "Dashboard de Temperatura": "Dash Temp",
        "Temperaturas Cámaras de Frío": "Cámaras Frío",
        "Inteligencia de Datos Temperatura": "Intel. Datos",
        "Puertas Status Cierre / Apertura": "Puertas",
        "Datos Análisis Forense": "Análisis",
        "Interior Ubicación en Tiempo Real": "Ubicación Int.",
        "Interior Búsqueda Histórica Ubicación": "Búsqueda Int.",
        "Exterior Ubicación Tiempo Real": "Ubicación Ext.",
        "Exterior Búsqueda Histórica Ubicación": "Búsqueda Ext.",
        "Análisis de Temperatura y Potencia": "Temp/Potencia",
        "Consumo Total por Dia": "Consumo Día",
        "Consumo Total por Mes": "Consumo Mes",
        "Consumo Total por Año": "Consumo Año",
        "Parámetros Temperatura Cámaras": "Param. Temp",
        "Dashboard Electrico": "Dash Eléctrico",
        "Consumo Electrico": "Consumo Eléc."
      };
      
      return <span className="routine-title-part">{shortTitles[title] || title}</span>;
    }

    // Versión para escritorio (manteniendo el comportamiento original)
    const parts = title.split(":");
    if (parts.length > 1) {
      return (
        <>
          <span className="routine-title-part">{parts[0].trim()}</span>
          <span className="routine-title-part">{parts[1].trim()}</span>
        </>
      );
    }
    return <span className="routine-title-part">{title}</span>;
  };

  // Filtrar las rutinas según el término de búsqueda
  const filteredRoutines = routines.filter(routine => 
    routine.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
    userPermissions.includes(routine.permission)
  );

  return (
    <div className="select-routine">
      <Header title="Dashboard TNS Track" className="header-title" />
      
      {/* Barra de búsqueda */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Buscar aplicación..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>
      
      <div className="routine-cards">
        {filteredRoutines.map((routine, index) => (
          <div
            className="routine-card"
            key={index}
            onClick={() => handleCardClick(routine)}
          >
            <img
              src={routine.image}
              alt={routine.title}
              className="routine-image"
            />
            <div className="routine-content">
              <h3 className="routine-title">{formatTitle(routine.title)}</h3>
              <div className="routine-button-container">
                <button className="routine-button">Ir a la App</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="back-button" onClick={() => navigate("/")}>
        Volver a la Página Principal
      </button>
    </div>
  );
};

export default SelectRoutine;
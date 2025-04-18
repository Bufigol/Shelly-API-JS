import React, { useState, useEffect } from "react";
import { Route, Routes, Navigate, useLocation } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import DashboardElectrico from "./DashboardElectrico";
import ConsumoElectrico from "./ConsumoElectrico";
import ConsumoTotalDiario from "./ConsumoTotalDiario";
import ConsumoTotalMensual from "./ConsumoTotalMensual";
import ConsumoTotalAnual from "./ConsumoTotalAnual";
import DashboardTemperatura from "./DashboardTemperatura"; // Cambiado
import LastKnownPosition from "./LastKnownPosition"; // Cambiado
import UbicacionTiempoRealInteriores from "./UbicacionTiempoRealInteriores"; // Cambiado
import PersonSearch from "./PersonSearch"; // Cambiado
import LandingPage from "./LandingPage"; // Cambiado
import SelectRoutine from "./SelectRoutine"; // Cambiado
import HistoricalMovementsSearch from "./HistoricalMovementsSearch"; // Cambiado
import Configuration from "./Configuration"; // Cambiado
import DoorStatusMatrix from "./DoorStatusMatrix"; // Cambiado
import UserRegistration from "./UserRegistration"; // Cambiado
import ForgotPassword from "./ForgotPassword"; // Cambiado
import ResetPassword from "./ResetPassword"; // Cambiado
import TemperaturaCamaras from "./TemperaturaCamaras"; // Cambiado
import DefrostAnalysis from "./DefrostAnalysis"; // Cambiado
import IntelligenciaDatosTemperatura from "./IntelligenciaDatosTemperatura"; // Cambiado
import ParametroTempCamaras from "./ParametroTempCamaras"; // Cambiado
import TemperaturePowerAnalysis from "./TemperaturePowerAnalysis"; // Cambiado
import "core-js/stable";
import "regenerator-runtime/runtime";
import "../assets/css/AppContent.css";

const PrivateRoute = ({ children, userPermissions }) => {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return React.cloneElement(children, { userPermissions });
};

function AppContent() {
  const [userPermissions, setUserPermissions] = useState([]);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#E1E9F2");
  const location = useLocation(); // Importado desde 'react-router-dom'

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedToken = jwtDecode(token);
        if (decodedToken && decodedToken.permissions) {
          setUserPermissions(decodedToken.permissions.split(","));
        }
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }

    const savedColor = localStorage.getItem("appBackgroundColor");
    if (savedColor) {
      setBackgroundColor(savedColor);
    }
  }, []);

  const routesWithoutSideNav = ["/"];
  const shouldShowSideNav =
    !routesWithoutSideNav.includes(location.pathname) &&
    userPermissions.length > 0;

  const handleNavExpand = (expanded) => {
    setIsNavExpanded(expanded);
  };

  const changeBackgroundColor = (color) => {
    setBackgroundColor(color);
    localStorage.setItem("appBackgroundColor", color);
  };

  return (
    <div className="app-container" style={{ backgroundColor: backgroundColor }}>
      {" "}
      {/* Aplicar backgroundColor */}
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/dashboard-electrico" element={<DashboardElectrico />} />
        <Route path="/consumo-electrico" element={<ConsumoElectrico />} />
        <Route path="/consumo-total-diario" element={<ConsumoTotalDiario />} />
        <Route path="/consumo-total-mensual" element={<ConsumoTotalMensual />} />
        <Route path="/consumo-total-anual" element={<ConsumoTotalAnual />} />
        <Route
          path="/select-routine"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <SelectRoutine />
            </PrivateRoute>
          }
        />
        <Route
          path="/register-user"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <UserRegistration />
            </PrivateRoute>
          }
        />
        <Route
          path="/temperatura-camaras"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <TemperaturaCamaras />
            </PrivateRoute>
          }
        />
        <Route
          path="/parametro-temp-camaras"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <ParametroTempCamaras />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard-temperatura"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <DashboardTemperatura />
            </PrivateRoute>
          }
        />
        <Route
          path="/analisis-deshielo"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <DefrostAnalysis />
            </PrivateRoute>
          }
        />
        <Route
          path="/inteligencia-datos-temperatura"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <IntelligenciaDatosTemperatura />
            </PrivateRoute>
          }
        />

        <Route
          path="/busqueda-entradas-persona"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <PersonSearch />
            </PrivateRoute>
          }
        />
        <Route
          path="/consulta-historica-movimientos"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <HistoricalMovementsSearch />
            </PrivateRoute>
          }
        />
        <Route
          path="/last-known-position"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <LastKnownPosition />
            </PrivateRoute>
          }
        />
        

        <Route
          path="/door-status-matrix"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <DoorStatusMatrix />
            </PrivateRoute>
          }
        />
        <Route
          path="/analisis-temperatura-potencia"
          element={
            <PrivateRoute userPermissions={userPermissions}>
              <TemperaturePowerAnalysis />
            </PrivateRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default AppContent;

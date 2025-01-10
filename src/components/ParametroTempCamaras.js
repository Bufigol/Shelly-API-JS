/* components/ParametroTempCamaras.js*/

import React, { useState, useEffect } from "react";
import axios from "axios";
import "../assets/css/ParametroTempCamaras.css";
import Header from "./Header";
import paramTempIcon from "../assets/images/param_temp.png";

const ParametroTempCamaras = () => {
  const [params, setParams] = useState([]);
  const [channels, setChannels] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentParams();
    fetchChannels();
  }, []);

  const fetchCurrentParams = async () => {
    try {
      const response = await axios.get("/api/teltonica/temperatura-umbrales");
      setParams(response.data);
    } catch (error) {
      console.error("Error fetching temperature thresholds:", error);
      setMessage("Error al cargar los parámetros actuales");
    }
  };

  const fetchChannels = async () => {
    try {
      const response = await axios.get("/api/ubibot/channel-status");
      setChannels(response.data);
    } catch (error) {
      console.error("Error fetching channels:", error);
      setMessage("Error al cargar los canales");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post("/api/teltonica/temperatura-umbrales", params);
      setMessage("Parámetros actualizados exitosamente");
    } catch (error) {
      console.error("Error updating temperature thresholds:", error);
      setMessage("Error al actualizar los parámetros");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (index, field, value) => {
    const newParams = [...params];
    newParams[index][field] = parseFloat(value);
    setParams(newParams);
  };

  const handleChannelStatusChange = async (channelId, newStatus) => {
    try {
      await axios.post("/api/ubibot/update-channel-status", {
        channelId,
        esOperativa: newStatus ? 1 : 0,
      });
      setChannels(
        channels.map((channel) =>
          channel.channel_id === channelId
            ? { ...channel, esOperativa: newStatus ? 1 : 0 }
            : channel
        )
      );
      setMessage(`Estado del canal ${channelId} actualizado correctamente`);
    } catch (error) {
      console.error("Error updating channel status:", error);
      setMessage(`Error al actualizar el estado del canal ${channelId}`);
    }
  };

  if (loading) {
    return (
      <div className="parametro-temp-camaras">
        <Header
          title="Parámetros de Temperatura Cámaras"
          image={paramTempIcon}
        />
        <div className="content">
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="parametro-temp-camaras">
      <Header title="Parámetros de Temperatura Cámaras" image={paramTempIcon} />
      <div className="content">
        <form onSubmit={handleSubmit}>
          {params.map((param, index) => (
            <div key={param.param_id} className="form-group">
              <h3>{param.nombre_parametro}</h3>
              <div>
                <label htmlFor={`minTemp-${param.param_id}`}>
                  Temperatura Mínima (°C):
                </label>
                <input
                  type="number"
                  id={`minTemp-${param.param_id}`}
                  value={param.minimo}
                  onChange={(e) =>
                    handleChange(index, "minimo", e.target.value)
                  }
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label htmlFor={`maxTemp-${param.param_id}`}>
                  Temperatura Máxima (°C):
                </label>
                <input
                  type="number"
                  id={`maxTemp-${param.param_id}`}
                  value={param.maximo}
                  onChange={(e) =>
                    handleChange(index, "maximo", e.target.value)
                  }
                  step="0.01"
                  required
                />
              </div>
            </div>
          ))}
          <button type="submit" disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar Parámetros"}
          </button>
        </form>

        <h3>Estado de los Canales</h3>
        <div className="channels-list">
          {channels.map((channel) => (
            <div key={channel.channel_id} className="channel-item">
              <span>{channel.name}</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={channel.esOperativa === 1}
                  onChange={(e) =>
                    handleChannelStatusChange(
                      channel.channel_id,
                      e.target.checked
                    )
                  }
                />
                <span className="slider round"></span>
              </label>
            </div>
          ))}
        </div>

        {message && (
          <p
            className={`message ${
              message.includes("Error") ? "error" : "success"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default ParametroTempCamaras;

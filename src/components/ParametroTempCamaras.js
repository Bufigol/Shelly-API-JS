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
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        console.log("Token enviado:", token); // Log para debug

        const paramsResponse = await axios.get(
          "/api/config/teltonica/temperatura-umbrales",
          {
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (paramsResponse.data && Array.isArray(paramsResponse.data)) {
          setParams(paramsResponse.data);
        } else {
          console.error("Invalid response format:", paramsResponse);
          setMessage("Error: Formato de respuesta inválido");
        }

        const channelsResponse = await axios.get("/api/ubibot/channel-status", {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (channelsResponse.data && Array.isArray(channelsResponse.data)) {
          setChannels(channelsResponse.data);
        } else {
          console.error("Invalid channels response:", channelsResponse);
          setMessage("Error: Formato de respuesta de canales inválido");
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        if (error.response?.status === 401) {
          setMessage(
            "Error de autenticación. Por favor, inicie sesión nuevamente."
          );
        } else {
          setMessage(
            error.response?.data?.error || "Error al cargar los datos"
          );
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await axios.post("/api/config/teltonica/temperatura-umbrales", params);
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
          {Array.isArray(params) &&
            params.length > 0 &&
            params.map((param, index) => (
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
          {Array.isArray(channels) &&
            channels.map((channel) => (
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

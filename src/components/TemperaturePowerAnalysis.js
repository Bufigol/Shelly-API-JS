// TemperaturePowerAnalysis.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import moment from "moment-timezone";
import { toast } from "react-toastify";
import "react-datepicker/dist/react-datepicker.css";
import "react-toastify/dist/ReactToastify.css";
import Header from "./Header";
import "../assets/css/TemperaturePowerAnalysis.css";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;

  return (
    <div className="custom-tooltip">
      <p>
        <strong>Hora:</strong> {label}
      </p>
      <p style={{ color: "#8884d8" }}>
        <strong>Temperatura:</strong> {payload[0].value.toFixed(1)}°C
      </p>
      <p style={{ color: "#82ca9d" }}>
        <strong>Potencia:</strong> {payload[1].value.toFixed(2)} kW
      </p>
    </div>
  );
};

const chartConfig = {
  lineColors: {
    temperature: "#8884d8",
    power: "#82ca9d",
  },
  margins: { top: 10, right: 40, left: 40, bottom: 20 },
  gridConfig: { strokeDasharray: "3 3", stroke: "#e0e0e0" },
};

const TemperaturePowerAnalysis = () => {
  const [data, setData] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await axios.get(
          "/api/powerAnalysis/temperature-power-locations"
        );
        setLocations(response.data);
      } catch (error) {
        console.error("Error fetching locations:", error);
        toast.error("Error al cargar las ubicaciones");
      }
    };

    fetchLocations();
  }, []);

  const fetchData = async () => {
    if (!selectedLocation || !selectedDate) {
      toast.warning("Por favor seleccione una ubicación y fecha");
      return;
    }

    setLoading(true);
    try {
      const location = locations.find(
        (loc) => loc.id === parseInt(selectedLocation)
      );

      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");

      console.log("Enviando parámetros:", {
        date: formattedDate,
        ubicacion: selectedLocation,
        channelId: location?.channels[0]?.id,
      });

      const response = await axios.get(
        `/api/powerAnalysis/temperature-power-analysis/${formattedDate}`,
        {
          params: {
            ubicacion: selectedLocation,
            channelId: location?.channels[0]?.id,
          },
        }
      );

      const processedData = response.data.map((item) => ({
        ...item,
        time: moment(item.intervalo_tiempo).format("HH:mm"),
        promedio_temperatura_externa: parseFloat(
          item.promedio_temperatura_externa
        ),
        promedio_potencia_kw: parseFloat(item.promedio_potencia_kw),
      }));

      setData(processedData);
      setShowChart(true);
    } catch (error) {
      console.error("Error fetching data:", error);
      const errorMessage =
        error.response?.data?.error ||
        "Error al obtener los datos. Por favor intente nuevamente.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="temperature-power-analysis">
      <Header title="Análisis de Temperatura y Potencia" />
      <div className="content">
        <h1>Análisis de Temperatura y Potencia</h1>
        <div className="controls">
          <div className="select-container">
            <label>Ubicación:</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
            >
              <option value="">Seleccionar Ubicación</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="select-container">
            <label>Fecha:</label>
            <DatePicker
              selected={selectedDate}
              onChange={(date) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              maxDate={new Date()}
              placeholderText="Seleccionar fecha"
              className="date-picker"
            />
          </div>

          <button
            onClick={fetchData}
            disabled={loading || !selectedLocation || !selectedDate}
            className="fetch-button"
          >
            {loading ? "Cargando..." : "Obtener Datos"}
          </button>
        </div>

        {showChart && data.length > 0 && (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={data} margin={chartConfig.margins}>
                <CartesianGrid
                  strokeDasharray={chartConfig.gridConfig.strokeDasharray}
                  stroke={chartConfig.gridConfig.stroke}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Hora",
                    position: "bottom",
                    offset: 0,
                    fontSize: 14,
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Temperatura (°C)",
                    angle: -90,
                    position: "insideLeft",
                    offset: -5,
                    fontSize: 14,
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Potencia (kW)",
                    angle: 90,
                    position: "insideRight",
                    offset: 10,
                    fontSize: 14,
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{
                    paddingTop: "20px",
                    fontSize: "14px",
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="promedio_temperatura_externa"
                  stroke={chartConfig.lineColors.temperature}
                  name="Temperatura"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="promedio_potencia_kw"
                  stroke={chartConfig.lineColors.power}
                  name="Potencia"
                  dot={false}
                  strokeWidth={2}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemperaturePowerAnalysis;

/*components/IntelligenciaDatosTemperatura.js*/

import React, { useState, useEffect } from "react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { es } from "date-fns/locale";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../assets/css/IntelligenciaDatosTemperatura.css";
import Header from "./Header";
import moment from "moment";

registerLocale("es", es);
// Agregar esta constante para la fecha actual
const today = new Date();
// Calcular la fecha mínima permitida (45 días atrás desde hoy)
const minDate = new Date();
minDate.setDate(minDate.getDate() - 45);

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const LINE_COLORS = [
  "rgba(75,192,192,1)",
  "rgba(255,99,132,1)",
  "rgba(54, 162, 235, 1)",
  "rgba(255, 206, 86, 1)",
  "rgba(153, 102, 255, 1)",
  "rgba(255, 159, 64, 1)",
];

const IntelligenciaDatosTemperatura = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await axios.get("/api/ubibot/temperature-devices");
      setDevices(response.data);
    } catch (error) {
      console.error("Error fetching devices:", error);
      setError(
        "Error al cargar los dispositivos. Por favor, intente nuevamente."
      );
    }
  };

  const getDaysDifference = (date1, date2) => {
    const diffTime = Math.abs(date2 - date1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const fetchTemperatureData = async () => {
    if (!startDate || !endDate || !selectedDevice) {
      setError("Por favor, seleccione un dispositivo y un rango de fechas.");
      return;
    }

    const today = new Date();
    if (startDate > today || endDate > today) {
      setError("No se pueden seleccionar fechas futuras.");
      return;
    }

    // Agregar validación de 45 días
    const daysDifference = getDaysDifference(startDate, endDate);
    if (daysDifference > 45) {
      setError(
        "Si desea datos de mas de 45 días de antigüedad, contacte a The Next Security"
      );
      return;
    }

    // Validar que la fecha de inicio no sea más antigua que 45 días desde hoy
    const daysFromToday = getDaysDifference(startDate, today);
    if (daysFromToday > 45) {
      setError(
        "Si desea datos de mas de 45 días de antigüedad, contacte a The Next Security"
      );
      return;
    }

    try {
      setLoading(true);
      const startFormatted = moment(startDate).format("YYYY-MM-DD");
      const endFormatted = moment(endDate).format("YYYY-MM-DD");
      console.log(
        "Fetching data for dates:",
        startFormatted,
        endFormatted,
        "and device:",
        selectedDevice
      );
      const response = await axios.get("/api/ubibot/temperature-range-data", {
        params: {
          startDate: startFormatted,
          endDate: endFormatted,
          deviceId: selectedDevice,
        },
      });
      console.log("Datos recibidos:", response.data);
      const device = devices.find(
        (device) => device.channel_id == selectedDevice
      );
      setData([
        {
          channel_id: selectedDevice,
          name: device?.name,
          data: response.data.map((item) => ({
            timestamp: item.timestamp,
            external_temperature: item.external_temperature,
          })),
        },
      ]);
      setLoading(false);
      setError(null);
    } catch (error) {
      console.error("Error fetching temperature data:", error);
      setLoading(false);
      setError("Error al cargar los datos. Por favor, intente nuevamente.");
    }
  };

  const handleStartDateChange = (date) => {
    setStartDate(date);
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
  };

  const handleDeviceChange = (event) => {
    setSelectedDevice(event.target.value);
  };

  const generateCSV = (deviceData) => {
    const headers = "Device Name;Fecha;Hora;External Temperature\n";
    const rows = deviceData?.data
      ?.map((item) => {
        // Convertir el timestamp a los formatos requeridos
        const date = new Date(item?.timestamp);

        // Formato fecha: dd-mm-aa
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = String(date.getFullYear()).slice(-2);
        const formattedDate = `${day}-${month}-${year}`;

        // Formato hora: HH:MM
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const formattedTime = `${hours}:${minutes}`;

        // Convertir el separador decimal de punto a coma
        const temperature = item?.external_temperature
          ?.toString()
          .replace(".", ",");

        return `"${deviceData?.name}";${formattedDate};${formattedTime};${temperature}`;
      })
      .join("\n");

    return headers + rows;
  };

  const handleDownload = (channelId, deviceName) => {
    const deviceData = data?.find((item) => item?.channel_id === channelId);
    if (deviceData) {
      const csvContent = generateCSV(deviceData);
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute(
          "download",
          `${deviceName}_external_temperatures.csv`
        );
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,    // Reducir padding superior
        bottom: 15, // Reducir padding inferior
        left: 10,   // Reducir padding izquierdo
        right: 10   // Reducir padding derecho
      }
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "hour",
          stepSize: 3,
          displayFormats: {
            hour: "dd/MM/yyyy HH:mm",
          },
        },
        adapters: {
          date: {
            locale: es,
          },
        },
        title: {
          display: true,
          text: "Fecha y Hora",
        },
        ticks: {
          maxRotation: 45, // Rotar las etiquetas
          minRotation: 45  // Mantener rotación consistente
        }
      },
      y: {
        title: {
          display: true,
          text: "Temperatura Sonda (°C)",
        },
        ticks: {
          callback: function (value) {
            return value.toFixed(1);
          },
        },
      },
    },
    plugins: {
      legend: {
        position: "top",
        padding: 5 // Reducir el padding de la leyenda
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          title: function (tooltipItems) {
            return moment(tooltipItems[0].parsed.x).format(
              "DD/MM/YYYY HH:mm:ss"
            );
          },
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(2) + "°C";
            }
            return label;
          },
        },
      },
    },
  };

  return (
    <div className="inteligencia-datos-temperatura">
      <Header title="Inteligencia de Datos de Temperatura" />
      <div className="content">
        <h1>Inteligencia de Datos de Temperatura</h1>
        <div className="controls">
          <div className="device-select-container">
            <select
              value={selectedDevice}
              onChange={handleDeviceChange}
              className="device-select"
            >
              <option value="">Seleccione un dispositivo</option>
              {devices.map((device) => (
                <option key={device.channel_id} value={device.channel_id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
          <div className="date-pickers">
            <DatePicker
              selected={startDate}
              onChange={handleStartDateChange}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              dateFormat="dd-MM-yyyy"
              placeholderText="Fecha de inicio"
              className="date-picker"
              locale="es"
              maxDate={new Date()}
              minDate={minDate}
            />
            <DatePicker
              selected={endDate}
              onChange={handleEndDateChange}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={startDate}
              maxDate={new Date()}
              dateFormat="dd-MM-yyyy"
              placeholderText="Fecha de fin"
              className="date-picker"
              locale="es"
            />
          </div>
          <button onClick={fetchTemperatureData} className="fetch-btn">
            Buscar Datos
          </button>
        </div>
        {error && <div className="error-message">{error}</div>}
        {loading && <div>Cargando datos...</div>}
        {!loading && data && data.length > 0 && (
          <div className="charts-grid">
            {data?.map((deviceData, index) => {
              const chartData = {
                labels: deviceData?.data?.map(
                  (item) => new Date(item?.timestamp)
                ),
                datasets: [
                  {
                    label: deviceData?.name,
                    data: deviceData?.data?.map((item) => ({
                      x: new Date(item?.timestamp),
                      y: item?.external_temperature,
                    })),
                    fill: false,
                    borderColor: LINE_COLORS[index % LINE_COLORS.length],
                    tension: 0.1,
                  },
                ],
              };
              return (
                <div key={deviceData?.channel_id} className="chart-container">
                  <h3>
                    Cámara de Frío:{" "}
                    <span
                      style={{ color: LINE_COLORS[index % LINE_COLORS.length] }}
                    >
                      {deviceData?.name}
                    </span>
                  </h3>
                  <div className="chart-wrapper">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                  <button
                    onClick={() =>
                      handleDownload(deviceData?.channel_id, deviceData?.name)
                    }
                    className="download-button"
                  >
                    Descarga de Datos
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligenciaDatosTemperatura;

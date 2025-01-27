/* components/TemperaturaCamaras.js */

import React, { useState, useEffect, useRef } from "react";
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
import "../assets/css/TemperaturaCamaras.css";
import Header from "./Header";
import moment from "moment-timezone";

// Configurar moment para usar la zona horaria de Santiago
moment.tz.setDefault("America/Santiago");
registerLocale("es", es);

ChartJS.register(
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const LINE_COLOR = "rgba(75,192,192,1)";

const TemperaturaCamaras = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState(null);
  const today = useRef(moment().tz("America/Santiago").endOf("day").toDate());

  useEffect(() => {
    fetchTemperatureData(selectedDate);
  }, [selectedDate]);

  const fetchTemperatureData = async (date) => {
    try {
      const formattedDate = moment(date).format("YYYY-MM-DD");
      console.log("Fetching data for date:", formattedDate);
      const response = await axios.get("/api/ubibot/temperature-camaras-data", {
        params: { date: formattedDate },
      });
      console.log("Datos recibidos:", response.data);

      // Al procesar los datos recibidos, asumimos que ya vienen en hora de Santiago
      const formattedData = response.data.map((device) => ({
        ...device,
        data: device.data.map((item) => ({
          ...item,
          timestamp: moment(item.timestamp).toDate(),
        })),
      }));

      setData(formattedData);
      setLoading(false);
      setError(null);
    } catch (error) {
      console.error("Error fetching temperature data:", error);
      setLoading(false);
      setError("Error al cargar los datos. Por favor, intente nuevamente.");
    }
  };

  const handleDateChange = (date) => {
    if (moment(date).isSameOrBefore(moment(), "day")) {
      setSelectedDate(date);
      setLoading(true);
    } else {
      alert("No se puede seleccionar una fecha futura.");
    }
  };

  const generateCSV = (deviceData) => {
    const headers = "Device Name,Fecha,Hora,External Temperature\n";
    const rows = deviceData.data
      .map((item) => {
        const fecha = moment(item.timestamp).format("DD-MM-YY");
        const hora = moment(item.timestamp).format("HH:mm");
        const temperature = item.external_temperature
          .toString()
          .replace(".", ",");

        return `"${deviceData.name}",${fecha},${hora},${temperature}`;
      })
      .join("\n");

    return headers + rows;
  };

  const handleDownload = (channelId, deviceName) => {
    const deviceData = data.find((item) => item.channel_id === channelId);
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

  if (loading) {
    return <div>Cargando datos...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (data.length === 0) {
    return (
      <div className="temperatura-camaras">
        <Header />
        <h1>Temperaturas Cámaras de Frío</h1>
        <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          dateFormat="dd-MM-yyyy"
          className="date-picker"
          locale="es"
          maxDate={today.current}
        />
        <p>No hay datos disponibles para la fecha seleccionada.</p>
      </div>
    );
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: "time",
        time: {
          unit: "hour",
          stepSize: 3,
          displayFormats: {
            hour: "HH:mm",
          },
        },
        adapters: {
          date: {
            locale: es,
          },
        },
        title: {
          display: true,
          text: "Hora",
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
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
        display: false,
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
              label += context.parsed.y.toFixed(4) + "°C";
            }
            return label;
          },
        },
      },
    },
  };

  return (
    <div className="temperatura-camaras">
      <Header />
      <div className="main-content">
        <h1>Temperaturas Cámaras de Frío</h1>
        <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          dateFormat="dd-MM-yyyy"
          className="date-picker"
          locale="es"
          maxDate={today.current}
        />
        <div className="charts-grid">
          {data.map((deviceData) => {
            const chartData = {
              labels: deviceData.data.map((item) => item.timestamp),
              datasets: [
                {
                  label: "Temperatura Sonda",
                  data: deviceData.data.map((item) => ({
                    x: item.timestamp,
                    y: parseFloat(item.external_temperature),
                  })),
                  fill: false,
                  borderColor: LINE_COLOR,
                  tension: 0.1,
                },
              ],
            };

            return (
              <div key={deviceData.channel_id} className="chart-container">
                <h3>
                  Cámara de Frío:{" "}
                  <span style={{ color: LINE_COLOR }}>{deviceData.name}</span>
                </h3>
                <div className="chart-wrapper">
                  <Line data={chartData} options={chartOptions} />
                </div>
                <button
                  onClick={() =>
                    handleDownload(deviceData.channel_id, deviceData.name)
                  }
                  className="download-button"
                >
                  Descarga de Datos
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TemperaturaCamaras;

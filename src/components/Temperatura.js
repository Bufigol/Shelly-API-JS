// Temperatura.js
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
import "../assets/css/Temperatura.css";
import Header from "./Header";

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

const Temperatura = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [error, setError] = useState(null);
  const today = useRef(new Date());

  useEffect(() => {
    fetchTemperatureData(selectedDate);
  }, [selectedDate]);

  const fetchTemperatureData = async (date) => {
    try {
      const formattedDate = date.toISOString().split("T")[0];
      console.log("Fetching data for date:", formattedDate);
      const response = await axios.get("/api/beacons/temperature-data", {
        params: { date: formattedDate },
      });
      console.log("Datos recibidos:", response.data);
      setData(response.data);
      setLoading(false);
      setError(null);
    } catch (error) {
      console.error("Error fetching temperature data:", error);
      setLoading(false);
      setError("Error al cargar los datos. Por favor, intente nuevamente.");
    }
  };

  const handleDateChange = (date) => {
    if (date <= today.current) {
      setSelectedDate(date);
      setLoading(true);
    } else {
      alert("No se puede seleccionar una fecha futura.");
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return <div>Cargando datos...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (data.length === 0) {
    return (
      <div className="temperatura">
        <Header />
        <h1>Temperatura</h1>
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
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        ticks: {
          padding: 5,
        },
      },
      y: {
        min: -25,
        max: 35,
        title: {
          display: true,
          text: "Temperatura (°C)",
        },
        grid: {
          color: "rgba(0, 0, 0, 0.1)",
        },
        ticks: {
          padding: 5,
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
          title: (context) => {
            return new Date(context[0].parsed.x).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            });
          },
          label: (context) => {
            return `Temperatura: ${context.parsed.y.toFixed(1)}°C`;
          },
        },
      },
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2,
      },
      point: {
        radius: 0,
        hitRadius: 10,
        hoverRadius: 5,
      },
    },
    hover: {
      mode: "nearest",
      intersect: true,
    },
    layout: {
      padding: {
        left: 10,
        right: 10,
        top: 10,
        bottom: 10,
      },
    },
  };

  return (
    <div className="temperatura">
      <Header />
      <h1>Temperatura</h1>
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        dateFormat="dd-MM-yyyy"
        className="date-picker"
        locale="es"
        maxDate={today.current}
      />
      <div className="charts-grid">
        {data.map((beaconData) => {
          const validData = beaconData.temperatures
            .map((temp, index) => ({
              x: new Date(beaconData.timestamps[index]),
              y: temp !== null ? Number(temp) : null,
            }))
            .filter((point) => point.y !== null);

          const temperatures = validData.map((point) => point.y);
          const maxTemp = Math.max(...temperatures);
          const minTemp = Math.min(...temperatures);

          const chartData = {
            datasets: [
              {
                label: "Temperatura",
                data: validData,
                fill: false,
                borderColor: "rgba(75,192,192,1)",
                tension: 0.4,
              },
            ],
          };

          return (
            <div key={beaconData.beacon_id} className="chart-box">
              <div className="chart-container">
                <h3>{`Cámara de Frío: ${beaconData.location} - ${beaconData.ubicacion}`}</h3>
                <div className="temp-legend">
                  <span className="max-temp">Máx: {maxTemp.toFixed(1)}°C</span>
                  <span className="min-temp">Mín: {minTemp.toFixed(1)}°C</span>
                </div>
                <div className="chart-wrapper">
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Temperatura;

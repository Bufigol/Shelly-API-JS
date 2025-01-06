/* components/Presencia.js */

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../assets/css/Presencia.css";
import Header from "./Header";
import dayjs from "dayjs";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

const Presencia = () => {
  const [data, setData] = useState([]);
  const [beacons, setBeacons] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [pieChartData, setPieChartData] = useState({});
  const [summaryPieChartData, setSummaryPieChartData] = useState(null);
  const today = useRef(new Date());

  useEffect(() => {
    console.log("Fetching beacon data...");
    axios
      .get("/api/beacons/beacons")
      .then((response) => {
        console.log("Beacons data:", response.data);
        setBeacons(response.data);
      })
      .catch((error) => {
        console.error("Error fetching beacons:", error);
      });

    fetchDataForSelectedDate(selectedDate);
  }, [selectedDate]);

  const fetchDataForSelectedDate = (date) => {
    const startDate = dayjs(date)
      .set("hour", 8)
      .set("minute", 0)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");
    const endDate = dayjs(date)
      .set("hour", 23)
      .set("minute", 30)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");

    console.log(`Fetching data for date range: ${startDate} - ${endDate}`);

    axios
      .get("/api/beacons/beacons-detection-status", {
        params: {
          startDate: startDate,
          endDate: endDate,
        },
      })
      .then((response) => {
        console.log("Beacon detection status data:", response.data);
        setData(response.data);
        generatePieChartData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching beacons detection status:", error);
      });
  };

  const generatePieChartData = (data) => {
    const sectors = [
      "Sector_1",
      "Sector_2",
      "Sector_3",
      "Sector_4",
      "Sector_5",
    ];
    const colors = {
      Verde: "#4CAF50",
      Rojo: "#F44336",
      Amarillo: "#FFEB3B",
      Negro: "#212121",
    };
    const statusLabels = {
      Verde: "Presencia OK",
      Rojo: "Presencia menor al esperado",
      Amarillo: "Presencia baja",
      Negro: "No hubo presencia",
    };

    const pieData = {};
    const summaryData = {
      Verde: 0,
      Rojo: 0,
      Amarillo: 0,
      Negro: 0,
    };

    sectors.forEach((sector) => {
      const sectorData = data.map((entry) => entry[sector]);
      const counts = {
        Verde: 0,
        Rojo: 0,
        Amarillo: 0,
        Negro: 0,
      };

      sectorData.forEach((status) => {
        if (counts.hasOwnProperty(status)) {
          counts[status]++;
          summaryData[status]++;
        }
      });

      const total = Object.values(counts).reduce(
        (sum, count) => sum + count,
        0
      );
      const percentages = Object.entries(counts).map(([status, count]) => ({
        status,
        percentage: (count / total) * 100,
      }));

      pieData[sector] = {
        labels: percentages.map(
          (item) =>
            `${statusLabels[item.status]} (${item.percentage.toFixed(2)}%)`
        ),
        datasets: [
          {
            data: percentages.map((item) => item.percentage),
            backgroundColor: percentages.map((item) => colors[item.status]),
          },
        ],
      };
    });

    setPieChartData(pieData);

    const summaryTotal = Object.values(summaryData).reduce(
      (sum, count) => sum + count,
      0
    );
    const summaryPercentages = Object.entries(summaryData).map(
      ([status, count]) => ({
        status,
        percentage: (count / summaryTotal) * 100,
      })
    );

    setSummaryPieChartData({
      labels: summaryPercentages.map(
        (item) =>
          `${statusLabels[item.status]} (${item.percentage.toFixed(2)}%)`
      ),
      datasets: [
        {
          data: summaryPercentages.map((item) => item.percentage),
          backgroundColor: summaryPercentages.map(
            (item) => colors[item.status]
          ),
        },
      ],
    });
  };

  const handleDateChange = (date) => {
    console.log("Date selected:", date);
    if (date <= today.current) {
      setSelectedDate(date);
    } else {
      alert("No se puede seleccionar una fecha futura.");
    }
  };

  const getColorClass = (status) => {
    switch (status) {
      case "Verde":
        return "green";
      case "Rojo":
        return "red";
      case "Amarillo":
        return "yellow";
      case "Negro":
        return "black";
      default:
        return "transparent";
    }
  };

  const getChartTitle = (sector) => {
    const beacon = beacons.find((b) => b.lugar === sector.replace("_", " "));
    return beacon ? beacon.ubicacion : sector;
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          boxWidth: 12,
          font: {
            size: 10,
          },
        },
      },
      title: {
        display: true,
        font: {
          size: 16,
          weight: "bold",
        },
      },
    },
  };

  return (
    <div className="presencia">
      <Header />
      <h1>Status de Presencia</h1>
      <DatePicker
        selected={selectedDate}
        onChange={handleDateChange}
        dateFormat="yyyy-MM-dd"
        className="date-picker"
        maxDate={today.current}
      />
      {summaryPieChartData && (
        <div className="summary-pie-chart">
          <h2>Resumen General</h2>
          <div className="chart-container">
            <Pie
              data={summaryPieChartData}
              options={{
                ...chartOptions,
                plugins: {
                  ...chartOptions.plugins,
                  title: {
                    ...chartOptions.plugins.title,
                    text: "Resumen de todos los sectores",
                  },
                },
              }}
            />
          </div>
        </div>
      )}
      <div className="pie-charts-container">
        {Object.entries(pieChartData).map(([sector, chartData]) => (
          <div key={sector} className="pie-chart">
            <h2>{getChartTitle(sector)}</h2>
            <div className="chart-container">
              <Pie
                data={chartData}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    title: {
                      ...chartOptions.plugins.title,
                      text: getChartTitle(sector),
                    },
                  },
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="color-legend">
        <div>
          <span className="color-box black"></span> No hubo presencia
        </div>
        <div>
          <span className="color-box red"></span> Presencia menor al esperado
        </div>
        <div>
          <span className="color-box yellow"></span> Presencia baja
        </div>
        <div>
          <span className="color-box green"></span> Presencia OK
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="col-sector">Sector</th>
              {data.length > 0 &&
                data.map((entry, index) => (
                  <th key={index} className="col-width">
                    <span className="rotate">
                      {new Date(entry.status_timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {beacons.map((beacon) => (
              <tr key={beacon.id}>
                <td>{beacon.ubicacion}</td>
                {data.map((entry, index) => (
                  <td key={index}>
                    <div className="status-bar-wrapper">
                      <div
                        className={`status-bar ${getColorClass(
                          entry[`Sector_${beacon.lugar.split(" ")[1]}`]
                        )}`}
                      ></div>
                      <div className="tooltip">
                        <span className="tooltiptext">
                          {entry.status_timestamp}
                        </span>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Presencia;

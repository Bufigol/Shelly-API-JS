/* components/Dashboard.js */

import React, { useState, useEffect } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import dayjs from "dayjs";
import "react-datepicker/dist/react-datepicker.css";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LabelList,
} from "recharts";
import Header from "./Header";
import TemperatureGauge from "../utils/TemperatureGauge";
import "../assets/css/Dashboard.css";

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [presenceData, setPresenceData] = useState(null);
  const [doorStatusData, setDoorStatusData] = useState(null);
  const [doorChangeData, setDoorChangeData] = useState(null);
  const [currentDoorStatus, setCurrentDoorStatus] = useState(null);
  const [lastStatusTime, setLastStatusTime] = useState(null);
  const [temperatureData, setTemperatureData] = useState([]);

  useEffect(() => {
    fetchPresenceData(selectedDate);
    fetchDoorStatusData(selectedDate);
    fetchDoorChangeData(selectedDate);
    fetchTemperatureData(selectedDate);
  }, [selectedDate]);

  const fetchPresenceData = async (date) => {
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

    try {
      const response = await axios.get("/api/beacons/beacons-detection-status", {
        params: { startDate, endDate },
      });
      console.log("Presence Data Response:", response.data);
      generatePresencePieChartData(response.data);
    } catch (error) {
      console.error("Error fetching presence data:", error);
    }
  };

  const fetchDoorStatusData = async (date) => {
    const startDate = dayjs(date)
      .set("hour", 8)
      .set("minute", 0)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");
    const endDate = dayjs(date)
      .set("hour", 23)
      .set("minute", 0)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");

    try {
      const response = await axios.get("/api/beacons/door-status", {
        params: { startDate, endDate },
      });
      console.log("Door Status Data Response:", response.data);
      generateDoorStatusPieChartData(response.data);
    } catch (error) {
      console.error("Error fetching door status data:", error);
    }
  };

  const fetchDoorChangeData = async (date) => {
    const currentDate = dayjs(date);
    const previousDate = currentDate.subtract(1, "day");

    const startDateCurrent = currentDate
      .set("hour", 8)
      .set("minute", 0)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");
    const endDateCurrent = currentDate
      .set("hour", 23)
      .set("minute", 30)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");

    const startDatePrevious = previousDate
      .set("hour", 8)
      .set("minute", 0)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");
    const endDatePrevious = previousDate
      .set("hour", 23)
      .set("minute", 30)
      .set("second", 0)
      .format("YYYY-MM-DD HH:mm:ss");

    try {
      const [responseCurrent, responsePrevious] = await Promise.all([
        axios.get("/api/beacons/door-status", {
          params: { startDate: startDateCurrent, endDate: endDateCurrent },
        }),
        axios.get("/api/beacons/door-status", {
          params: { startDate: startDatePrevious, endDate: endDatePrevious },
        }),
      ]);

      console.log("Door Change Data Response (Current):", responseCurrent.data);
      console.log(
        "Door Change Data Response (Previous):",
        responsePrevious.data
      );

      processDoorChangeData(
        responseCurrent.data,
        responsePrevious.data,
        currentDate,
        previousDate
      );
    } catch (error) {
      console.error("Error fetching door change data:", error);
    }
  };

  const fetchTemperatureData = async (date) => {
    try {
      const response = await axios.get("/api/beacons/temperature-data", {
        params: { date: date.toISOString().split("T")[0] },
      });
      console.log("Temperature Data:", response.data);

      const processedData = response.data
        .map((item) => ({
          ...item,
          temperatures: item.temperatures.filter(
            (temp) => temp !== null && temp !== ""
          ),
          timestamps: item.timestamps.filter(
            (_, index) =>
              item.temperatures[index] !== null &&
              item.temperatures[index] !== ""
          ),
        }))
        .filter((item) => item.temperatures.length > 0);

      setTemperatureData(processedData);
    } catch (error) {
      console.error("Error fetching temperature data:", error);
    }
  };

  const generatePresencePieChartData = (data) => {
    const statusCounts = {
      Verde: 0,
      Rojo: 0,
      Amarillo: 0,
      Negro: 0,
    };

    data.forEach((entry) => {
      Object.values(entry).forEach((status) => {
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });
    });

    const total = Object.values(statusCounts).reduce(
      (sum, count) => sum + count,
      0
    );
    const chartData = Object.entries(statusCounts).map(([status, count]) => ({
      name: status,
      value: count,
      percentage: ((count / total) * 100).toFixed(2),
    }));

    console.log("Generated Presence Chart Data:", chartData);
    setPresenceData(chartData);
  };

  const generateDoorStatusPieChartData = (data) => {
    const openCount = data.filter((d) => d.magnet_status === 0).length;
    const closedCount = data.filter((d) => d.magnet_status === 1).length;
    const total = openCount + closedCount;

    const chartData = [
      {
        name: "Abierto",
        value: openCount,
        percentage: ((openCount / total) * 100).toFixed(2),
      },
      {
        name: "Cerrado",
        value: closedCount,
        percentage: ((closedCount / total) * 100).toFixed(2),
      },
    ];

    console.log("Generated Door Status Chart Data:", chartData);
    setDoorStatusData(chartData);
  };

  const processDoorChangeData = (
    dataCurrent,
    dataPrevious,
    currentDate,
    previousDate
  ) => {
    const processData = (data) => {
      let changeCount = 0;
      let lastStatus = null;
      let currentStatus = null;
      let lastStatusTime = null;

      data.forEach((entry, index) => {
        if (index === 0) {
          lastStatus = entry.magnet_status;
          lastStatusTime = entry.timestamp;
        } else {
          if (entry.magnet_status !== lastStatus) {
            changeCount++;
            lastStatus = entry.magnet_status;
            lastStatusTime = entry.timestamp;
          }
        }
        currentStatus = entry.magnet_status;
      });

      return { changeCount, currentStatus, lastStatusTime };
    };

    const currentResult = processData(dataCurrent);
    const previousResult = processData(dataPrevious);

    const statusLabelCurrent =
      currentResult.currentStatus === 0 ? "Status: Abierta" : "Status: Cerrada";
    const statusColorCurrent =
      currentResult.currentStatus === 0 ? "#4CAF50" : "#F44336";

    setCurrentDoorStatus({
      current: currentResult.currentStatus,
      previous: previousResult.currentStatus,
    });
    setLastStatusTime(currentResult.lastStatusTime);

    setDoorChangeData([
      {
        name: previousDate.format("YYYY-MM-DD"),
        count: previousResult.changeCount,
        color: "#20B2AA",
      },
      {
        name: currentDate.format("YYYY-MM-DD"),
        count: currentResult.changeCount,
        color: "#6A5ACD",
        statusLabel: statusLabelCurrent,
        statusColor: statusColorCurrent,
      },
    ]);
  };

  const COLORS = ["#4CAF50", "#F44336", "#FFEB3B", "#212121"];
  const DOOR_COLORS = ["#26b43bcf", "#af4c4f"];

  const renderCustomizedLabel = (entry) => {
    return `${entry.percentage}%`;
  };

  const presenceStatusLegend = {
    Verde: "Presencia OK",
    Rojo: "Presencia menor al esperado",
    Amarillo: "Presencia baja",
    Negro: "No hubo presencia",
  };

  const CustomizedLabel = (props) => {
    const { x, y, width, value, statusLabel, statusColor } = props;
    return (
      <g>
        <text
          x={x + width / 2}
          y={y - 10}
          fill="#000000"
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {value}
        </text>
        {statusLabel && (
          <>
            <rect x={x} y={y - 35} width={width} height={20} fill="#000000" />
            <text
              x={x + width / 2}
              y={y - 25}
              fill={statusColor}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="12"
            >
              {statusLabel}
            </text>
          </>
        )}
      </g>
    );
  };

  // Añadir esta línea para obtener la fecha actual
  const today = dayjs().endOf("day").toDate();

  return (
    <div className="dashboard">
      <Header title="Dashboard" />
      <div className="dashboard-header">
        <h1 className="dashboard-title">Resumen del Día</h1>
        <DatePicker
          selected={selectedDate}
          onChange={setSelectedDate}
          dateFormat="yyyy-MM-dd"
          className="date-picker"
          maxDate={today} // Añadir esta línea para limitar la selección de fechas
        />
      </div>
      <div className="charts-container">
        <div className="chart-row">
          <div className="chart-section">
            <div className="chart-container">
              <h2>Status de Presencia</h2>
              {presenceData ? (
                <div className="pie-chart-container">
                  <PieChart width={400} height={400}>
                    <Pie
                      data={presenceData}
                      cx={200}
                      cy={200}
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {presenceData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      formatter={(value) =>
                        presenceStatusLegend[value] || value
                      }
                    />
                  </PieChart>
                </div>
              ) : (
                <p>Cargando datos de presencia...</p>
              )}
            </div>
          </div>
          <div className="chart-section">
            <div className="chart-container">
              <h2>Estado de Puertas por Sector</h2>
              {doorStatusData ? (
                <div className="pie-chart-container">
                  <PieChart width={400} height={400}>
                    <Pie
                      data={doorStatusData}
                      cx={200}
                      cy={200}
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {doorStatusData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={DOOR_COLORS[index % DOOR_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </div>
              ) : (
                <p>Cargando datos de estado de puertas...</p>
              )}
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-section">
            <div className="chart-container">
              <h2>Frecuencia de Cambios de Estado de Puertas</h2>
              <div style={{ marginBottom: "30px" }}>
                {currentDoorStatus && lastStatusTime && (
                  <div
                    className="current-status-label"
                    style={{
                      backgroundColor: "black",
                      color:
                        currentDoorStatus.current === 0 ? "#4CAF50" : "#F44336",
                      padding: "5px 10px",
                      borderRadius: "5px",
                      marginBottom: "10px",
                      display: "flex",
                      justifyContent: "center",
                      width: "100%",
                    }}
                  >
                    <span>
                      Status Actual:{" "}
                      {currentDoorStatus.current === 0 ? "Abierta" : "Cerrada"}
                      (Último cambio: {dayjs(lastStatusTime).format("HH:mm:ss")}
                      )
                    </span>
                  </div>
                )}
              </div>
              {doorChangeData ? (
                <div className="bar-chart-container">
                  <BarChart width={800} height={300} data={doorChangeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => Math.round(value)} />
                    <Tooltip />
                    <Bar dataKey="count">
                      {doorChangeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="count"
                        content={<CustomizedLabel />}
                      />
                    </Bar>
                  </BarChart>
                </div>
              ) : (
                <p>Cargando datos de cambios de estado de puertas...</p>
              )}
            </div>
          </div>
        </div>
        <div className="chart-row">
          <div className="chart-section">
            <div className="chart-container">
              <h2>Temperaturas Actuales</h2>
              <div className="temperature-gauges">
                {temperatureData.slice(0, 3).map((data, index) => (
                  <TemperatureGauge
                    key={index}
                    temperature={
                      data.temperatures[data.temperatures.length - 1]
                    }
                    location={data.location}
                    timestamp={data.timestamps[data.timestamps.length - 1]}
                    width={150}
                    height={150}
                    minimo={data.minimo}
                    maximo={data.maximo}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

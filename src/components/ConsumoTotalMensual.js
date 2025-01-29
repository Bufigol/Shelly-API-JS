// ConsumoTotalMensual.js
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    Chart as ChartJS,
    TimeScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    CategoryScale,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { es } from "date-fns/locale";
import DatePicker, { registerLocale } from "react-datepicker";
import { toast } from "react-toastify";
import "react-datepicker/dist/react-datepicker.css";
import "react-toastify/dist/ReactToastify.css";
import Header from "./Header";
import moment from "moment-timezone";
import "../assets/css/ConsumoTotalDiario.css";
import DashboardStats from '../utils/DashboardStats';


// Configuraciones iniciales
moment.tz.setDefault("America/Santiago");
registerLocale("es", es);

ChartJS.register(
    TimeScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    CategoryScale,
    Title,
    Tooltip,
    Legend
);

const chartConfig = {
    colors: {
        bar: "rgba(248, 149, 111, 0.8)",
        barHover: "rgba(255, 193, 7, 1)",
        line: "rgba(77, 68, 111, 1)",
        lineHover: "rgba(54, 162, 235, 0.8)",
        grid: "rgba(0, 0, 0, 0.1)",
    },
    fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
};

const CustomTooltip = (context) => {
    if (!context.tooltip || !context.tooltip.dataPoints) return null;

    const dataPoints = context.tooltip.dataPoints;
    const tooltipDate = moment(dataPoints[0].label, "DD/MM/YYYY").format(
        "DD [de] MMMM YYYY"
    );

    return `<div class="custom-tooltip">
            <div class="tooltip-header">${tooltipDate}</div>
            ${dataPoints
            .map(
                (point) => `
                <div class="tooltip-row" style="color: ${point.dataset.borderColor
                    }">
                    <span class="tooltip-label">${point.dataset.label}:</span>
                    <span class="tooltip-value">
                        ${point.dataset.yAxisID === "y-left"
                        ? `${Number(point.raw).toLocaleString()} CLP`
                        : `${Number(point.raw).toFixed(3)} kWh`
                    }
                    </span>
                </div>
            `
            )
            .join("")}
        </div>`;
};

const ConsumoTotalMensual = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showChart, setShowChart] = useState(false);
    const [error, setError] = useState(null);
    const today = useRef(moment().tz("America/Santiago").endOf("day").toDate());
    const chartRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            if (chartRef.current) {
                chartRef.current.resize();
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleDateChange = (date) => {
        if (moment(date).isSameOrBefore(moment(), "month")) {
            setSelectedDate(date);
        } else {
            toast.warning("No se puede seleccionar un mes futuro.");
        }
    };

    const handleFetchData = async () => {
        if (!selectedDate) {
            toast.warning("Por favor seleccione un mes");
            return;
        }

        setLoading(true);
        setShowChart(true);
        try {
            const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
            const response = await axios.get(`/api/totals/monthly/${formattedDate}`);
            setData(response.data.data);
            setError(null);
        } catch (error) {
            console.error("Error fetching monthly totals data:", error);
            toast.error("Error al cargar los datos. Por favor, intente nuevamente.");
            setError("Error al cargar los datos. Por favor, intente nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    const chartData = {
        labels: data.map((item) => moment(item.fecha_local).format("DD/MM/YYYY")),
        datasets: [
            {
                type: "bar",
                label: "Consumo Diario (kWh)",
                data: data.map((item) => parseFloat(item.energia_activa_total)),
                backgroundColor: chartConfig.colors.bar,
                hoverBackgroundColor: chartConfig.colors.barHover,
                yAxisID: "y-right",
                borderRadius: 4,
                barThickness: "flex",
                maxBarThickness: 40,
            },
            {
                type: "line",
                label: "Costo Total Diario (CLP)",
                data: data.map((item) => parseFloat(item.costo_total)),
                borderColor: chartConfig.colors.line,
                backgroundColor: chartConfig.colors.line,
                hoverBorderColor: chartConfig.colors.lineHover,
                fill: false,
                yAxisID: "y-left",
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        height: 400,
        maxHeight: 600,
        options: {
            resizeDelay: 100,
        },
        interaction: {
            mode: "index",
            intersect: false,
        },
        scales: {
            x: {
                grid: {
                    color: chartConfig.colors.grid,
                    drawBorder: false,
                },
                ticks: {
                    font: {
                        family: chartConfig.fontFamily,
                        size: 12,
                    },
                    maxRotation: 45,
                    minRotation: 45,
                },
                title: {
                    display: true,
                    text: "Día",
                    font: {
                        family: chartConfig.fontFamily,
                        size: 14,
                        weight: "bold",
                    },
                },
            },
            "y-left": {
                position: "left",
                grid: {
                    color: chartConfig.colors.grid,
                    drawBorder: false,
                },
                ticks: {
                    font: {
                        family: chartConfig.fontFamily,
                        size: 12,
                    },
                    callback: (value) => `${value.toLocaleString()}`,
                },
                title: {
                    display: true,
                    text: "Costo total diario (CLP)",
                    font: {
                        family: chartConfig.fontFamily,
                        size: 14,
                        weight: "bold",
                    },
                },
            },
            "y-right": {
                position: "right",
                grid: {
                    display: false,
                },
                ticks: {
                    font: {
                        family: chartConfig.fontFamily,
                        size: 12,
                    },
                    callback: (value) => `${value.toFixed(2)}`,
                },
                title: {
                    display: true,
                    text: "Consumo Diario (kWh)",
                    font: {
                        family: chartConfig.fontFamily,
                        size: 14,
                        weight: "bold",
                    },
                },
            },
        },
        plugins: {
            legend: {
                display: true,
                position: "top",
                align: "center",
                labels: {
                    padding: 20,
                    font: {
                        family: chartConfig.fontFamily,
                        size: 13,
                    },
                    usePointStyle: true,
                    pointStyle: "circle",
                },
            },
            tooltip: {
                enabled: true,
                position: "nearest",
                external: CustomTooltip,
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                titleColor: "#333",
                bodyColor: "#333",
                borderColor: "#ccc",
                borderWidth: 1,
                titleFont: {
                    family: chartConfig.fontFamily,
                    size: 14,
                    weight: "bold",
                },
                bodyFont: {
                    family: chartConfig.fontFamily,
                    size: 13,
                },
                padding: 12,
                cornerRadius: 4,
                displayColors: true,
                intersect: false,
                mode: "index",
            },
        },
    };

    return (
        <div className="consumo-electrico">
            <Header title="Consumo Total Mensual" />
            <div className="content">
                <h1>Consumo Total Mensual</h1>
                <div className="controls">
                    <div className="select-container">
                        <label>Mes:</label>
                        <DatePicker
                            selected={selectedDate}
                            onChange={handleDateChange}
                            dateFormat="MM/yyyy"
                            showMonthYearPicker
                            maxDate={today.current}
                            placeholderText="Seleccionar mes"
                            className="date-picker"
                            locale="es"
                        />
                    </div>

                    <button
                        onClick={handleFetchData}
                        disabled={loading || !selectedDate}
                        className="fetch-button"
                    >
                        {loading ? "Cargando..." : "Obtener Datos"}
                    </button>
                    {data.length > 0 && (
                        <div className="mb-6">
                            <DashboardStats
                                data={data}
                                period="monthly"
                            />
                        </div>
                    )}
                </div>

                {error && <div className="error-message">{error}</div>}

                {showChart && data.length > 0 && (
                    <div className="chart-container">
                        <Bar data={chartData} options={chartOptions} ref={chartRef} />
                    </div>
                )}

                {showChart && data.length === 0 && !loading && (
                    <div className="no-data-message">
                        No hay datos disponibles para el mes seleccionado.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsumoTotalMensual;
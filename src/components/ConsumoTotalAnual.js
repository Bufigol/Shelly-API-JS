// ConsumoTotalAnual.js
import React, { useState, useEffect, useRef, useMemo } from "react";
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
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Header from "./Header";
import moment from "moment-timezone";
import "../assets/css/ConsumoTotalDiario.css";

// Configuraciones iniciales
moment.tz.setDefault("America/Santiago");

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
        bar: "rgba(176, 83, 83, 0.8)",
        barHover: "rgba(255, 193, 7, 1)",
        line: "rgba(0f, 0f, 0f, 1)",
        lineHover: "rgba(54, 162, 235, 0.8)",
        grid: "rgba(0, 0, 0, 0.1)",
    },
    fontFamily: "'Helvetica Neue', 'Helvetica', 'Arial', sans-serif",
};

// Array de nombres de meses para asegurar orden correcto (fuera del componente para optimizar)
const MONTHS = Array.from({ length: 12 }, (_, i) => {
    return {
        number: (i + 1).toString().padStart(2, '0'),
        name: moment().month(i).format('MMM'),
        fullName: moment().month(i).format('MMMM')
    };
});

const CustomTooltip = (context) => {
    if (!context.tooltip || !context.tooltip.dataPoints) return null;

    const dataPoints = context.tooltip.dataPoints;
    const monthName = dataPoints[0].label;
    const month = MONTHS.find(m => m.name === monthName);
    const tooltipMonth = month ? month.fullName : '';

    return `<div class="custom-tooltip">
              <div class="tooltip-header">${tooltipMonth}</div>
              ${dataPoints
            .map(
                (point) => `
                  <div class="tooltip-row" style="color: ${point.dataset.borderColor}">
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

const ConsumoTotalAnual = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState(moment().year());
    const [showChart, setShowChart] = useState(false);
    const [error, setError] = useState(null);
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

    const handleYearChange = (e) => {
        const year = parseInt(e.target.value);
        if (year >= 2000 && year <= moment().year() + 1) {
            setSelectedYear(year);
        } else {
            toast.warning("Año inválido");
        }
    };

    const handleFetchData = async () => {
        if (!selectedYear) {
            toast.warning("Por favor seleccione un año");
            return;
        }

        setLoading(true);
        setShowChart(true);
        try {
            const response = await axios.get(`/api/totals/yearly/${selectedYear}`);
            setData(response.data.data);
            setError(null);
        } catch (error) {
            console.error("Error fetching yearly totals data:", error);
            toast.error("Error al cargar los datos. Por favor, intente nuevamente.");
            setError("Error al cargar los datos. Por favor, intente nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    const chartData = useMemo(() => {
        if (!showChart || data.length === 0) {
            return null;
        }
        // Crear un array ordenado de 12 meses con datos o ceros
        const orderedData = MONTHS.map((month, index) => {
            const monthData = data.find(item => {
                // Usar el mes del item directamente desde fecha_local
                const itemDate = moment(item.fecha_local);
                return itemDate.month() === index;  // month() retorna 0-11
            });
            return {
                consumption: monthData ? parseFloat(monthData.energia_activa_total) : 0,
                cost: monthData ? parseFloat(monthData.costo_total) : 0
            };
        });

        return {
            labels: MONTHS.map(month => month.name),
            datasets: [
                {
                    type: "bar",
                    label: "Consumo Mensual (kWh)",
                    data: orderedData.map(d => d.consumption),
                    backgroundColor: chartConfig.colors.bar,
                    hoverBackgroundColor: chartConfig.colors.barHover,
                    yAxisID: "y-right",
                    borderRadius: 4,
                    barThickness: "flex",
                    maxBarThickness: 40,
                },
                {
                    type: "line",
                    label: "Costo Total Mensual (CLP)",
                    data: orderedData.map(d => d.cost),
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
    }, [showChart, data]);

    const chartOptions = useMemo(() => ({
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
                    callback: (value) => {
                        if (typeof value === 'number' && value >= 0 && value < MONTHS.length) {
                            return MONTHS[value].name;
                        }
                        return '';
                    },
                },
                title: {
                    display: true,
                    text: "Mes",
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
                    text: "Costo total mensual (CLP)",
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
                    text: "Consumo Mensual (kWh)",
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
    }), []);

    return (
        <div className="consumo-electrico">
            <Header title="Consumo Total Anual" />
            <div className="content">
                <h1>Consumo Total Anual</h1>
                <div className="controls">
                    <div className="select-container">
                        <label>Año:</label>
                        <input
                            type="number"
                            value={selectedYear}
                            onChange={handleYearChange}
                            min="2000"
                            max={moment().year() + 1}
                            className="year-input"
                            placeholder="Seleccionar año"
                        />
                    </div>

                    <button
                        onClick={handleFetchData}
                        disabled={loading || !selectedYear}
                        className="fetch-button"
                    >
                        {loading ? "Cargando..." : "Obtener Datos"}
                    </button>
                </div>

                {error && <div className="error-message">{error}</div>}

                {showChart && chartData && (
                    <div className="chart-container">
                        <Bar data={chartData} options={chartOptions} ref={chartRef} />
                    </div>
                )}

                {showChart && (!chartData || data.length === 0) && !loading && (
                    <div className="no-data-message">
                        No hay datos disponibles para el año seleccionado.
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConsumoTotalAnual;
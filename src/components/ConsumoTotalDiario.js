import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Chart as ChartJS, TimeScale, LinearScale, BarElement, LineElement, PointElement, CategoryScale, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { es } from 'date-fns/locale';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import '../assets/css/ConsumoElectrico.css';
import Header from './Header';
import moment from 'moment-timezone';

// Configurar moment para usar la zona horaria de Santiago
moment.tz.setDefault('America/Santiago');
registerLocale('es', es);

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

const ConsumoTotalDiario = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showChart, setShowChart] = useState(false);
    const [error, setError] = useState(null);
    const [chartInstance, setChartInstance] = useState(null);
    const today = useRef(moment().tz('America/Santiago').endOf('day').toDate());
    const chartRef = useRef(null);

    useEffect(() => {
        if (selectedDate) {
            fetchDailyTotals(selectedDate);
        }
         return () => {
             if (chartInstance) {
                 chartInstance.destroy();
             }
         };
    }, [selectedDate, chartInstance]);

    const fetchDailyTotals = async (date) => {
        setLoading(true);
        setShowChart(true);
        try {
            const formattedDate = moment(date).format('YYYY-MM-DD');
            const response = await axios.get(`/api/totals/daily/${formattedDate}`);
             
            setData(response.data.data);
            setLoading(false);
            setError(null);
        } catch (error) {
             console.error("Error fetching daily totals data:", error);
            setLoading(false);
            setError('Error al cargar los datos. Por favor, intente nuevamente.');
        }
    };

    const handleDateChange = (date) => {
        if (moment(date).isSameOrBefore(moment(), 'day')) {
            setSelectedDate(date);
        } else {
             alert("No se puede seleccionar una fecha futura.");
        }
    };
    
     if (loading) {
        return <div className='loading'>Cargando datos...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!showChart) {
        return (
            <div className="consumo-electrico">
                <Header />
                <h1>Consumo Total Diario</h1>
               <DatePicker
                    key={`date-picker-${selectedDate}`}
                    selected={selectedDate}
                    onChange={handleDateChange}
                    dateFormat="dd-MM-yyyy"
                    className="date-picker"
                    locale="es"
                    maxDate={today.current}
                    placeholderText="Seleccione una fecha"
                />
                {selectedDate && <p>Selecciona una fecha para ver los datos de consumo.</p>}
            </div>
        );
    }
    
    if (data.length === 0) {
        return (
            <div className="consumo-electrico">
                <Header />
                <h1>Consumo Total Diario</h1>
                <DatePicker
                    key={`date-picker-${selectedDate}`}
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

   const chartData = {
      labels: data.map(item => moment(item.hora_local).format('HH:mm')),
      datasets: [
          {
              type: 'bar',
              label: 'Consumo por Intervalo (kWh)',
              data: data.map(item => parseFloat(item.energia_activa_total)),
              backgroundColor: 'rgba(255, 193, 7, 0.7)',
              yAxisID: 'y-right',
          },
        {
          type: 'line',
          label: 'Costo Acumulado (CLP)',
          data: data.map(item => parseFloat(item.costo_acumulado)),
          borderColor: 'rgba(54, 162, 235, 1)',
          fill: false,
          yAxisID: 'y-left',
        }
      ]
    };

    const chartOptions = {
          responsive: true,
        maintainAspectRatio: false,
      scales: {
          x: {
              type: 'category', // Usar 'category'
            title: {
            display: true,
            text: 'Hora del Día'
            }
        },
        'y-left': {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Costo Acumulado (CLP)'
          },
           ticks: {
             callback: function(value) {
               return value.toFixed(0);
             }
           }
        },
        'y-right': {
          type: 'linear',
          position: 'right',
          title: {
              display: true,
              text: 'Consumo por Intervalo (kWh)'
          },
             ticks: {
                callback: function(value) {
                   return value.toFixed(2);
                  }
            }
        }
      },
      plugins: {
        legend: {
            display: true,
            position: 'top',
             align: 'center'
        },
        tooltip: {
           mode: 'index',
            intersect: false,
            callbacks: {
              title: function(tooltipItems) {
                  return moment(data[tooltipItems[0].dataIndex].hora_local).format('DD/MM/YYYY HH:mm:ss');
              },
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                    if (context.dataset.yAxisID === 'y-left') {
                        label += context.parsed.y.toFixed(0) + ' CLP';
                    } else if (context.dataset.yAxisID === 'y-right') {
                        label += context.parsed.y.toFixed(3) + ' kWh';
                    }
                }
                return label;
              }
            }
        }
      }
    };
    
     const handleChartCreated = (chart) => {
        setChartInstance(chart);
    };


    return (
        <div className="consumo-electrico">
            <Header title="Consumo Total Diario" />
           <DatePicker
                 key={`date-picker-${selectedDate}`}
                selected={selectedDate}
                onChange={handleDateChange}
                dateFormat="dd-MM-yyyy"
                className="date-picker"
                locale="es"
                maxDate={today.current}
             />
            <div className="chart-container">
                 <Bar data={chartData} options={chartOptions} ref={chartRef} onElementClick={handleChartCreated}/>
            </div>
        </div>
    );
};

export default ConsumoTotalDiario;
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, TimeScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
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
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const LINE_COLOR = 'rgba(54, 162, 235, 1)';

const ConsumoElectrico = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
    const [showCharts, setShowCharts] = useState(false);
  const [error, setError] = useState(null);
  const today = useRef(moment().tz('America/Santiago').endOf('day').toDate());

  useEffect(() => {
      if(selectedDate){
        fetchConsumptionData(selectedDate);
      }
  }, [selectedDate]);


  const fetchConsumptionData = async (date) => {
    setLoading(true);
    setShowCharts(true);
    try {
      const formattedDate = moment(date).format('YYYY-MM-DD');
      console.log('Fetching data for date:', formattedDate);
      const response = await axios.get(`/api/devices/consumption/${formattedDate}`);
        
        console.log('Datos recibidos:', response.data);

      setData(response.data.data);
      setLoading(false);
      setError(null);
    } catch (error) {
      console.error("Error fetching electric consumption data:", error);
      setLoading(false);
      setError('Error al cargar los datos. Por favor, intente nuevamente.');
    }
  };

    const handleDateChange = (date) => {
        if (moment(date).isSameOrBefore(moment(), 'day')) {
            setSelectedDate(date);
            setLoading(true);
        } else {
            alert("No se puede seleccionar una fecha futura.");
        }
    };

  const generateCSV = (deviceData) => {
    const headers = "Device Name,Fecha,Hora,Potencia Promedio (kW), Consumo (kWh)\n";
      const rows = deviceData.data.map(item => {
      const fecha = moment(item.timestamp).format('DD-MM-YY');
        const hora = moment(item.timestamp).format('HH:mm');
      const potencia = item.potencia_kw.toString().replace('.', ',');
      const consumo = item.consumo_kwh.toString().replace('.', ',');
      
      return `"${deviceData.device_name}",${fecha},${hora},${potencia},${consumo}`;
    }).join("\n");
    
    return headers + rows;
  };

    const handleDownload = async (shellyId, deviceName) => {
      try {
          const formattedDate = moment(selectedDate).format('YYYY-MM-DD');
          const response = await axios.get(`/api/devices/download/${shellyId}/${formattedDate}`, {
             responseType: 'blob'
          });

          const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          if (link.download !== undefined) {
              const url = URL.createObjectURL(blob);
              link.setAttribute("href", url);
              link.setAttribute("download", `${deviceName}_consumo_electrico.csv`);
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          }
      } catch (error) {
            console.error("Error al descargar los datos:", error);
          setError('Error al descargar los datos. Por favor, intente nuevamente.');
        }
    };


  if (loading) {
    return <div className='loading'>Cargando datos...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

    if (!showCharts) {
        return (
            <div className="consumo-electrico">
                <Header />
                <h1>Consumo Eléctrico</h1>
                <DatePicker
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
                <h1>Consumo Eléctrico</h1>
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
        type: 'time',
        time: {
          unit: 'hour',
          stepSize: 3,
          displayFormats: {
            hour: 'HH:mm'
          }
        },
        adapters: {
          date: {
            locale: es,
          },
        },
        title: {
          display: true,
          text: 'Hora'
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8
        }
      },
      y: {
        title: {
          display: true,
          text: 'Potencia Promedio (kW)'
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
        display: false
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: function(tooltipItems) {
              return moment(tooltipItems[0].parsed.x).format('DD/MM/YYYY HH:mm:ss');
          },
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toFixed(3) + ' kW';
            }
            return label;
          }
        }
      }
    }
  };

  return (
    <div className="consumo-electrico">
      <Header />
      <h1>Consumo Eléctrico</h1>
      <DatePicker
          selected={selectedDate}
          onChange={handleDateChange}
          dateFormat="dd-MM-yyyy"
          className="date-picker"
          locale="es"
          maxDate={today.current}
      />
      <div className="charts-grid">
        {Object.values(data).map((deviceData) => {
          const chartData = {
              labels: deviceData.data.map(item => moment(item.timestamp).toDate()),
            datasets: [
              {
                label: 'Potencia Promedio',
                data: deviceData.data.map(item => ({
                    x: moment(item.timestamp).toDate(),
                  y: parseFloat(item.potencia_kw)
                })),
                fill: false,
                borderColor: LINE_COLOR,
                tension: 0.1
              }
            ]
          };

          return (
              <div key={deviceData.device_name} className="chart-box">
                <div className="chart-container">
              <h3>
                  Dispositivo: <span style={{ color: LINE_COLOR }}>{deviceData.device_name}</span>
              </h3>
                  <div className="chart-wrapper">
                      <Line data={chartData} options={chartOptions} />
                  </div>
                </div>
              <button onClick={() => handleDownload(deviceData.shelly_id, deviceData.device_name)} className="download-button">
                Descargar Datos
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConsumoElectrico;
// src/components/TemperaturePowerAnalysis.js
import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DatePicker from 'react-datepicker';
import moment from 'moment-timezone';
import axios from 'axios';
import { toast } from 'react-toastify';
import "react-datepicker/dist/react-datepicker.css";
import "react-toastify/dist/ReactToastify.css";
import "../assets/css/TemperaturePowerAnalysis.css";
import Header from "./Header";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
      <p className="font-semibold">Hora: {label}</p>
      <p className="text-purple-600">
        Temperatura: {payload[0]?.value?.toFixed(1)}°C
      </p>
      <p className="text-green-600">
        Potencia: {payload[1]?.value?.toFixed(2)} kW
      </p>
    </div>
  );
};

const TemperaturePowerAnalysis = () => {
  const [data, setData] = useState([]);
  const [locations, setLocations] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [error, setError] = useState(null);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await axios.get('/api/powerAnalysis/temperature-power-locations');
      setLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError('Error al cargar las ubicaciones');
      toast.error('Error al cargar las ubicaciones');
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const processData = useCallback((rawData) => {
    return rawData.map(item => ({
      ...item,
      time: moment(item.intervalo_tiempo).format('HH:mm'),
      promedio_temperatura_externa: parseFloat(item.promedio_temperatura_externa),
      promedio_potencia_kw: parseFloat(item.promedio_potencia_kw)
    }));
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedLocation || !selectedDate) {
      toast.warning('Por favor seleccione una ubicación y fecha');
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setShowChart(false);

    try {
      const location = locations.find(loc => loc.id === parseInt(selectedLocation));
      const formattedDate = moment(selectedDate).format('YYYY-MM-DD');

      const response = await axios.get(
        `/api/powerAnalysis/temperature-power-analysis/${formattedDate}`,
        {
          params: {
            ubicacion: selectedLocation,
            channelId: location?.channels[0]?.id
          }
        }
      );

      const processedData = processData(response.data);
      setData(processedData);
      setShowChart(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      const errorMessage = error.response?.data?.error || 'Error al obtener los datos';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [selectedLocation, selectedDate, locations, processData]);

  return (
    <div className="temperature-power-analysis">
      <Header />
      <div className="content">
        <h1 className="text-2xl font-bold text-center mb-6">
          Análisis de Temperatura y Potencia
        </h1>

        <div className="controls">
          <div className="select-container">
            <label className="block text-sm font-medium">Ubicación:</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={loading}
            >
              <option value="">Seleccionar Ubicación</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Fecha:</label>
            <DatePicker
              selected={selectedDate}
              onChange={setSelectedDate}
              dateFormat="dd/MM/yyyy"
              maxDate={new Date()}
              placeholderText="Seleccionar fecha"
              className="w-full p-2 border rounded-md"
              disabled={loading}
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchData}
              disabled={loading || !selectedLocation || !selectedDate}
              className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Cargando...' : 'Obtener Datos'}
            </button>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-center mb-4">{error}</div>
        )}

        {showChart && data.length > 0 && (
          <>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time"
                    label={{ value: 'Hora', position: 'bottom', offset: 0 }}
                  />
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Temperatura (°C)', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    label={{ value: 'Potencia (kW)', angle: 90, position: 'insideRight' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="promedio_temperatura_externa"
                    stroke="#8884d8"
                    name="Temperatura (°C)"
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="promedio_potencia_kw"
                    stroke="#82ca9d"
                    name="Potencia (kW)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha y hora</th>
                    <th>Temperatura (°C)</th>
                    <th>Potencia (kW)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr key={index}>
                      <td>{row.intervalo_tiempo}</td>
                      <td>{row.promedio_temperatura_externa?.toFixed(2) || '-'}</td>
                      <td>{row.promedio_potencia_kw?.toFixed(3) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TemperaturePowerAnalysis;
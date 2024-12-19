// TemperaturePowerAnalysis.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DatePicker from 'react-datepicker';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import moment from 'moment-timezone';
import "react-datepicker/dist/react-datepicker.css";
import Header from './Header';
import './TemperaturePowerAnalysis.css';

const TemperaturePowerAnalysis = () => {
    const [data, setData] = useState([]);
    const [locations, setLocations] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [showChart, setShowChart] = useState(false);

    // Cargar ubicaciones al iniciar
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const response = await axios.get('/api/temperature-power-locations');
                setLocations(response.data);
            } catch (error) {
                console.error('Error fetching locations:', error);
            }
        };

        fetchLocations();
    }, []);

    const fetchData = async () => {
        if (!selectedLocation || !selectedDate) {
            alert('Por favor seleccione una ubicación y fecha');
            return;
        }

        setLoading(true);
        try {
            const location = locations.find(loc => loc.id === parseInt(selectedLocation));
            
            const response = await axios.get('/api/temperature-power-analysis', {
                params: {
                    date: moment(selectedDate).format('YYYY-MM-DD'),
                    ubicacion: selectedLocation,
                    channelId: location.channels[0].id
                }
            });

            const processedData = response.data.map(item => ({
                ...item,
                time: moment(item.intervalo_tiempo).format('HH:mm'),
                promedio_temperatura_externa: parseFloat(item.promedio_temperatura_externa),
                promedio_potencia_kw: parseFloat(item.promedio_potencia_kw)
            }));

            setData(processedData);
            setShowChart(true);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Error al obtener los datos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="temperature-power-analysis">
            <Header title="Análisis de Temperatura y Potencia" />
            
            <div className="controls">
                <div className="select-container">
                    <label>Ubicación:</label>
                    <select 
                        value={selectedLocation} 
                        onChange={(e) => setSelectedLocation(e.target.value)}
                    >
                        <option value="">Seleccionar Ubicación</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>
                                {loc.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="select-container">
                    <label>Fecha:</label>
                    <DatePicker
                        selected={selectedDate}
                        onChange={date => setSelectedDate(date)}
                        dateFormat="yyyy-MM-dd"
                        maxDate={new Date()}
                        placeholderText="Seleccionar fecha"
                        className="date-picker"
                    />
                </div>

                <button 
                    onClick={fetchData} 
                    disabled={loading || !selectedLocation || !selectedDate}
                    className="fetch-button"
                >
                    {loading ? 'Cargando...' : 'Obtener Datos'}
                </button>
            </div>

            {showChart && data.length > 0 && (
                <div className="chart-container">
                    <ResponsiveContainer width="100%" height={500}>
                        <LineChart
                            data={data}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                                dataKey="time" 
                                label={{ value: 'Hora', position: 'bottom' }}
                            />
                            <YAxis 
                                yAxisId="left"
                                label={{ 
                                    value: 'Temperatura (°C)', 
                                    angle: -90, 
                                    position: 'insideLeft' 
                                }}
                            />
                            <YAxis 
                                yAxisId="right" 
                                orientation="right"
                                label={{ 
                                    value: 'Potencia (kW)', 
                                    angle: 90, 
                                    position: 'insideRight' 
                                }}
                            />
                            <Tooltip />
                            <Legend />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="promedio_temperatura_externa"
                                stroke="#8884d8"
                                name="Temperatura"
                                dot={false}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="promedio_potencia_kw"
                                stroke="#82ca9d"
                                name="Potencia"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default TemperaturePowerAnalysis;
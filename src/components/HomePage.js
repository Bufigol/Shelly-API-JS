// Inside HomePage.js:
import React from 'react';
import { Link } from 'react-router-dom';
import homeWhiteLogo from '../assets/images/home_white.png';
import electricGeneratorIcon from '../assets/images/dashboarelectrcio.png';
import powerMeterIcon from '../assets/images/potenciadinero.png';
import MeterIcon from '../assets/images/electric-generator.png';
import parametrosIcon from '../assets/images/parametros.png';
import speedometerIcon from '../assets/images/dashboarelectrcio.png';
import '../assets/css/HomePage.css';
import Header from './Header'; // Importamos el componente header

const HomePage = () => {
    return (
        <div>
            <Header title="Dashboard Shelly Energy Monitor" /> {/* Usamos el componente Header y pasamos el título */}

            <main className="dashboard-container">
                <div className="cards-grid">
                    {/* Dashboard de medición eléctrica */}
                    <div className="card">
                        <img src={electricGeneratorIcon} alt="Dashboard Icon" className="card-icon" />
                        <h2 className="card-title">Dashboard de medición eléctrica</h2>
                        <Link className="card-button" to="/dashboard-electrico">Ir a la App</Link>
                    </div>

                    {/* Consumo Eléctrico */}
                    <div className="card">
                        <img src={MeterIcon} alt="Energy Consumption Icon" className="card-icon" />
                        <h2 className="card-title">Consumo Eléctrico</h2>
                        <Link className="card-button" to="/consumo-electrico">Ir a la App</Link>
                    </div>
                     {/* Consumo Eléctrico Diario */}
                    <div className="card">
                        <img src={powerMeterIcon} alt="Energy Consumption Icon" className="card-icon" />
                        <h2 className="card-title">Consumo Eléctrico Diario en Dinero</h2>
                        <Link className="card-button" to="/consumo-total-diario">Ir a la App</Link>
                    </div>

                    {/* Parámetros medición eléctrica */}
                    <div className="card">
                        <img src={parametrosIcon} alt="Parameters Icon" className="card-icon" />
                        <h2 className="card-title">Parámetros medición eléctrica</h2>
                        <button className="card-button">Ir a la App</button>
                    </div>

                    {/* Grupos de medición eléctrica */}
                    <div className="card">
                        <img src={speedometerIcon} alt="Groups Icon" className="card-icon" />
                        <h2 className="card-title">Grupos de medición eléctrica</h2>
                        <button className="card-button">Ir a la App</button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default HomePage;
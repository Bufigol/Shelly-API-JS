import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../assets/css/LandingPage.css';
import mapImage from '../assets/images/map-of-a-map.jpeg';
import centerImage from '../assets/images/TNS Track White.png';
import rightImage from '../assets/images/tns_logo_blanco.png';
import storageImage from '../assets/images/storage-logo.png';

const LandingPage = () => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/auth/login', { // Utilizar la ruta correcta
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Login failed');
            }

            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('permissions', JSON.stringify(data.user.permissions));
            navigate('/select-routine');
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="landing-page">
            <div className="image-container">
                <img src={mapImage} alt="Map" className="map-image" />
                <img src={centerImage} alt="TNS Track" className="center-image" />
                <img src={storageImage} alt="Storage Logo" className="storage-image" />
            </div>
            <div className="form-container">
                <h2>Bienvenido</h2>
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                    />
                    <button type="submit">Login</button>
                </form>
                {error && <p className="error">{error}</p>}
                <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
            </div>
            <img src={rightImage} alt="TNS Logo" className="right-image" />
            <footer className="footer">
                <div className="footer-left">Version 1.01</div>
                <div className="footer-right">{currentTime.toLocaleString()}</div>
            </footer>
        </div>
    );
};

export default LandingPage;
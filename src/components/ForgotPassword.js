import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import '../assets/css/ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await axios.post('/api/usuarios/request-password-reset', { email });
      setMessage(response.data);
    } catch (error) {
      setMessage('Error al solicitar el restablecimiento de contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="forgot-password-container">
      <h2>Olvidé mi contraseña</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ingrese su email"
          required
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>
      {message && <p className="message">{message}</p>}
      <Link to="/" className="back-link">Volver al inicio de sesión</Link>
    </div>
  );
};

export default ForgotPassword;

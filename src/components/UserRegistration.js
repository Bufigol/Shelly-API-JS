// UserRegistration.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../assets/css/UserRegistration.css';
import Header from './Header';

const UserRegistration = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/');
          return;
        }

        const config = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        const response = await axios.get('/api/usuarios/users', config);
        setUsers(response.data);
      } catch (error) {
        console.error('Error fetching users:', error);
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/');
        }
      }
    };

    fetchUsers();
  }, [navigate]);

  const handleUserChange = (e) => {
    const user = users.find(u => u.id === parseInt(e.target.value));
    setSelectedUser(user);
    setUsername(user.username);
    setEmail(user.email);
    setPermissions(user.permissions.split(','));
  };

  const handlePermissionChange = (e) => {
    const value = e.target.value;
    setPermissions(
      e.target.checked ? [...permissions, value] : permissions.filter((perm) => perm !== value)
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/');
        return;
      }

      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      const updatedPermissions = permissions.join(',');
      const userData = selectedUser 
        ? { 
            userId: selectedUser.id, 
            username, 
            email, 
            permissions: updatedPermissions
          }
        : { 
            username, 
            password, 
            email, 
            permissions: updatedPermissions
          };

      await axios.post('/api/usuarios/register', userData, config);
      
      setMessage(selectedUser ? 'Permisos actualizados con éxito' : 'Usuario registrado con éxito');
      
      // Update users list
      const response = await axios.get('/api/usuarios/users', config);
      setUsers(response.data);
      
      setTimeout(() => {
        navigate('/select-routine');
      }, 2000);
    } catch (error) {
      console.error('Error:', error);
      setMessage('Error: ' + (error.response?.data?.message || error.message));
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        navigate('/');
      }
    }
  };

  const availablePermissions = [
    { label: 'Crear Usuarios', value: 'create_users' },
    { label: 'Ver Dashboard', value: 'view_dashboard' },
    { label: 'Ver Intrusiones Blind Spot', value: 'view_blind_spot_intrusions' },
    { label: 'Ubicación en Interiores Tiempo Real', value: 'view_interior' },
    { label: 'Búsqueda Histórica en Interiores', value: 'search_interior' },
    { label: 'Presencia Personal por Interiores', value: 'view_presence' },
    { label: 'Ubicación en Exteriores Tiempo Real', value: 'view_exterior' },
    { label: 'Búsqueda Histórica en Exteriores', value: 'search_exterior' },
    { label: 'Visualización Mensajes SMS', value: 'view_sms' },
    { label: 'Estado de Puertas por Sector', value: 'view_door_status' },
    { label: 'Inteligencia de Datos', value: 'view_data_intelligence' },
    { label: 'Configuración', value: 'view_configuration' },
    { label: 'Ver Temperatura', value: 'view_temperature' },
    { label: 'Ver Temperaturas Cámaras de Frío', value: 'view_temperature_camaras' },
    { label: 'Ver Dashboard de Temperatura', value: 'view_temperature_dashboard' },
    { label: 'Ver y Editar Parámetros de Temperatura de Cámaras', value: 'view_temp_params' },
    { label: 'Inteligencia de Datos Temperatura', value: 'view_temperature_data_intelligence' },
    { label: 'Análisis de Deshielo de Cámaras', value: 'view_defrost_analysis' },
  ];

  return (
    <div className="user-registration">
      <Header title="Registrar Usuario" />
      <form className="user-registration-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Seleccionar Usuario:</label>
          <select onChange={handleUserChange} value={selectedUser ? selectedUser.id : ''}>
            <option value="" disabled>Seleccione un usuario</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Username:</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        {!selectedUser && (
          <div className="form-group">
            <label>Password:</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
        )}
        <div className="form-group">
          <label>Email:</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Permissions:</label>
          <table className="permissions-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Asignar</th>
              </tr>
            </thead>
            <tbody>
              {availablePermissions.map((perm) => (
                <tr key={perm.value}>
                  <td>{perm.label}</td>
                  <td>
                    <input
                      type="checkbox"
                      value={perm.value}
                      checked={permissions.includes(perm.value)}
                      onChange={handlePermissionChange}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="submit" className="register-button">
          {selectedUser ? 'Actualizar Permisos' : 'Registrar'}
        </button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
};

export default UserRegistration;
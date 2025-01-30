import React from 'react';
import moment from 'moment-timezone';
import 'moment/locale/es'; // Importamos el locale español
import '../assets/css/DashboardStats.css';

// Configuración inicial de moment
moment.tz.setDefault("America/Santiago");
moment.locale('es'); // Configuramos moment para usar español

const DashboardStats = ({ data, period }) => {
  const calculateTotals = () => {
    if (!data || data.length === 0) return { moneyTotal: 0, energyTotal: 0 };
    
    return {
      moneyTotal: data.reduce((sum, item) => sum + parseFloat(item.costo_total || 0), 0),
      energyTotal: data.reduce((sum, item) => sum + parseFloat(item.energia_activa_total || 0), 0)
    };
  };

  const { moneyTotal, energyTotal } = calculateTotals();

  const isHistoricalData = () => {
    if (!data || data.length === 0) return false;

    const today = moment();
    const dataDate = moment(data[0].fecha_local || data[0].hora_local);

    switch (period) {
      case 'daily':
        return dataDate.date() !== today.date() || 
               dataDate.month() !== today.month() || 
               dataDate.year() !== today.year();
      case 'monthly':
        return dataDate.month() !== today.month() || 
               dataDate.year() !== today.year();
      case 'yearly':
        return dataDate.year() !== today.year();
      default:
        return false;
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-CL', { 
      style: 'currency', 
      currency: 'CLP' 
    }).format(amount);
  };

  const formatElectricity = (amount) => {
    return `${amount.toFixed(2)} kWh`;
  };

  const getDateInfo = () => {
    const isHistorical = isHistoricalData();
    const dateTitle = isHistorical ? 'Fecha de Cierre' : 'Fecha de Actualización';
    
    let displayDate;
    if (data && data.length > 0) {
      const lastUpdate = data[0].fecha_actualizacion;
      if (isHistorical) {
        switch (period) {
          case 'daily':
            displayDate = moment(data[0].hora_local).endOf('day').format('DD [de] MMMM [de] YYYY');
            break;
          case 'monthly':
            displayDate = moment(data[0].fecha_local).endOf('month').format('DD [de] MMMM [de] YYYY');
            break;
          case 'yearly':
            displayDate = moment(data[0].fecha_local).endOf('year').format('DD [de] MMMM [de] YYYY');
            break;
          default:
            displayDate = moment(lastUpdate).format('DD [de] MMMM [de] YYYY HH:mm');
        }
      } else {
        displayDate = moment(lastUpdate).format('DD [de] MMMM [de] YYYY HH:mm');
      }
    }

    return { dateTitle, displayDate };
  };

  const { dateTitle, displayDate } = getDateInfo();

  return (
    <div className="dashboard-stats">
      <div className="dashboard-cards">
        <div className="dashboard-card card-money">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">Total Acumulado</h3>
            <span className="dashboard-card-icon">💰</span>
          </div>
          <div className="dashboard-card-content">
            <div className="dashboard-card-value">{formatMoney(moneyTotal)}</div>
            <p className="dashboard-card-subtitle">
              Actualizado al {moment().format('DD [de] MMMM [de] YYYY')}
            </p>
          </div>
        </div>

        <div className="dashboard-card card-energy">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">Electricidad Utilizada</h3>
            <span className="dashboard-card-icon">⚡</span>
          </div>
          <div className="dashboard-card-content">
            <div className="dashboard-card-value">
              {formatElectricity(energyTotal)}
            </div>
          </div>
        </div>

        <div className="dashboard-card card-date">
          <div className="dashboard-card-header">
            <h3 className="dashboard-card-title">{dateTitle}</h3>
            <span className="dashboard-card-icon">📅</span>
          </div>
          <div className="dashboard-card-content">
            <div className="dashboard-card-value">
              {displayDate}
            </div>
            {!isHistoricalData() && (
              <p className="dashboard-card-subtitle">Datos en tiempo real</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
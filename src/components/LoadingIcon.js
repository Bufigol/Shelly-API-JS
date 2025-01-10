import React from 'react';
import '../assets/css/LoadingIcon.css';

const LoadingIcon = () => {
  return (
    <div className="loading-icon">
      <div className="spinner"></div>
      <p>Loading...</p>
    </div>
  );
};

export default LoadingIcon;

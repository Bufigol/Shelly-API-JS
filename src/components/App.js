import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import '../assets/css/styles.css'; 
import AppContent from './AppContent';

function App() {
  return (
    <Router basename="/">
      <AppContent />
    </Router>
  );
}

export default App;
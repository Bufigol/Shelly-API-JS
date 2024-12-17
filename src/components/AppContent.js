import React, { useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
import DashboardElectrico from './DashboardElectrico'; 
import ConsumoElectrico from './ConsumoElectrico';

function AppContent() {
    const [userPermissions, setUserPermissions] = useState([]);
    const [isNavExpanded, setIsNavExpanded] = useState(false);

    return (
        <div className="app-container">
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard-electrico" element={<DashboardElectrico />} />
                <Route path="/consumo-electrico" element={<ConsumoElectrico />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}

export default AppContent;
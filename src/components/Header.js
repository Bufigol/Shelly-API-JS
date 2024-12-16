// Header.js
import React from 'react';
import '../assets/css/Header.css'; // Importa el CSS del Header
import homeIcon from '../assets/images/general/home_white.png'; // Importa la imagen

function Header({ title }) {
    return (
        <header className="header">
            <div className='header-container'>
                <a href="/" className="home-button">
                  <img src={homeIcon} alt="Home"/>
                </a>
                <h1 className="page-title">{title}</h1>
            </div>
        </header>
    );
}

export default Header;
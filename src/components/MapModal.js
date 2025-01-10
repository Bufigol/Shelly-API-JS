// MapModal.js

import React, { useEffect, useRef } from 'react';
import MapboxGL from 'mapbox-gl';
import '../assets/css/MapModal.css'; // Asegúrate de crear un archivo CSS para el modal

MapboxGL.accessToken = 'pk.eyJ1IjoidGhlbmV4dHNlY3VyaXR5IiwiYSI6ImNsd3YxdmhkeDBqZDgybHB2OTh4dmo3Z2EifQ.bpZlTBTa56pF4cPhE3aSzg';

const MapModal = ({ latitud, longitud, onClose }) => {
  const mapContainerRef = useRef(null);

  useEffect(() => {
    if (mapContainerRef.current) {
      const map = new MapboxGL.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [longitud, latitud],
        zoom: 14,
      });

      new MapboxGL.Marker()
        .setLngLat([longitud, latitud])
        .addTo(map);

      return () => map.remove();
    }
  }, [latitud, longitud]);

  return (
    <div className="modal">
      <div className="modal-content">
        <span className="close" onClick={onClose}>&times;</span>
        <div className="map-container" ref={mapContainerRef} />
      </div>
    </div>
  );
};

export default MapModal;

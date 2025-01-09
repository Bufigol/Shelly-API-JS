// backButtonHandler.js

import { useNavigate } from 'react-router-dom';

export function handleBackButton() {
  const navigate = useNavigate(); // Obtén la función navigate de react-router-dom

  // Manejador del evento popstate
  window.onpopstate = function(event) {
    console.log("El usuario hizo clic en el botón Atrás");
  };

  // Función para prevenir el comportamiento predeterminado y agregar lógica personalizada
  const popStateHandler = function(event) {
    event.preventDefault(); // Evita recargar la página anterior

    // Lógica personalizada: Redirigir a SelectRoutine
    navigate('/select-routine');
  };

  // Agregar el event listener
  window.addEventListener('popstate', popStateHandler);

  // Función de limpieza para remover el event listener al desmontar
  return () => {
    window.removeEventListener('popstate', popStateHandler);
  };
}

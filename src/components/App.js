// App.js
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import GlobalStyle from "../GlobalStyle.js";
import AppContent from "./AppContent";

// Añadir basename al Router en App.js
function App() {
  return (
    <Router basename="/storage">
      <GlobalStyle />
      <AppContent />
    </Router>
  );
}
export default App;

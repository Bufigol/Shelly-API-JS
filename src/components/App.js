// App.js
import React from "react";
import { BrowserRouter as Router } from "react-router-dom";
import GlobalStyle from "../GlobalStyle.js";
import AppContent from "./AppContent";

function App() {
  return (
    <Router>
      <GlobalStyle />
      <AppContent />
    </Router>
  );
}

export default App;

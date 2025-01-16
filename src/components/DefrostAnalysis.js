/* components/DefrostAnalysis.js */

import React, { useState, useEffect } from "react";
import axios from "axios";
import moment from "moment-timezone";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../assets/css/DefrostAnalysis.css";
import Header from "./Header";

const validateArray = (input, label) => {
  if (!Array.isArray(input)) {
    console.error(`${label} no es un array válido:`, input);
    return [];
  }
  return input;
};

const calculateStats = (data) => {
  if (!data || data.length === 0) {
    return {
      promedio: 0,
      desv_std: 0,
      max: 0,
      min: 0,
      registros: 0,
    };
  }

  // Ensure data is an array of objects with 'temperature' property
  const temperatures = data
    .map((record) => parseFloat(record.temperature))
    .filter((temp) => !isNaN(temp));

  if (temperatures.length === 0) {
    return {
      promedio: 0,
      desv_std: 0,
      max: 0,
      min: 0,
      registros: 0,
    };
  }

  const promedio =
    temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
  const desv_std = Math.sqrt(
    temperatures.reduce((a, b) => a + Math.pow(b - promedio, 2), 0) /
      temperatures.length
  );

  return {
    promedio,
    desv_std,
    max: Math.max(...temperatures),
    min: Math.min(...temperatures),
    registros: temperatures.length,
  };
};

const processPreview = (currentData, previousData) => {
  const validCurrentData = validateArray(currentData, "currentData");
  const validPreviousData = validateArray(previousData, "previousData");

  return {
    current: calculateStats(validCurrentData),
    previous: calculateStats(validPreviousData),
  };
};

const DefrostAnalysis = () => {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedDate, setSelectedDate] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weeklyPreview, setWeeklyPreview] = useState(null);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await axios.get("/api/ubibot/temperature-devices");
      setCameras(response.data);
    } catch (error) {
      console.error("Error fetching cameras:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedCamera || !selectedDate) {
      alert("Por favor seleccione una cámara y una fecha válida.");
      return;
    }

    // Validar que la fecha seleccionada sea domingo
    if (moment(selectedDate).isoWeekday() !== 7) {
      alert("La fecha seleccionada debe ser un domingo.");
      console.error("Fecha seleccionada no es domingo:", selectedDate);
      return;
    }

    setLoading(true);
    try {
      // Log the date sent to the API
      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
      console.log(
        "Fecha enviada a la API para analisis diario:",
        formattedDate
      );

      // Análisis diario (domingo)
      const responseDaily = await axios.get(
        "/api/ubibot/defrost-analysis-data",
        {
          params: {
            channelId: selectedCamera,
            date: formattedDate,
          },
        }
      );

      if (
        !responseDaily.data ||
        !responseDaily.data.currentData ||
        !responseDaily.data.previousData
      ) {
        throw new Error("Invalid data format for daily analysis");
      }
      console.log("DefrostAnalysis.js - Daily Analysis - Received data");
      if (
        responseDaily.data.currentData &&
        responseDaily.data.currentData.length > 0
      ) {
        console.log(
          "   First record current data:",
          responseDaily.data.currentData[0].timestamp
        );
        console.log(
          "   Last record current data:",
          responseDaily.data.currentData[
            responseDaily.data.currentData.length - 1
          ].timestamp
        );
      }
      if (
        responseDaily.data.previousData &&
        responseDaily.data.previousData.length > 0
      ) {
        console.log(
          "   First record previous data:",
          responseDaily.data.previousData[0].timestamp
        );
        console.log(
          "   Last record previous data:",
          responseDaily.data.previousData[
            responseDaily.data.previousData.length - 1
          ].timestamp
        );
      }

      const processedDailyPreview = processPreview(
        responseDaily.data.currentData,
        responseDaily.data.previousData
      );
      setPreview(processedDailyPreview);

      // Análisis semanal
      const responseWeekly = await axios.get(
        "/api/ubibot/weekly-defrost-analysis-data",
        {
          params: {
            channelId: selectedCamera,
            date: formattedDate,
          },
        }
      );

      if (
        !responseWeekly.data ||
        !responseWeekly.data.currentData ||
        !responseWeekly.data.previousData
      ) {
        throw new Error("Invalid data format for weekly analysis");
      }

      console.log("DefrostAnalysis.js - Weekly Analysis - Received data");
      if (
        responseWeekly.data.currentData &&
        responseWeekly.data.currentData.length > 0
      ) {
        console.log(
          "   First record current data:",
          responseWeekly.data.currentData[0].timestamp
        );
        console.log(
          "   Last record current data:",
          responseWeekly.data.currentData[
            responseWeekly.data.currentData.length - 1
          ].timestamp
        );
      }
      if (
        responseWeekly.data.previousData &&
        responseWeekly.data.previousData.length > 0
      ) {
        console.log(
          "   First record previous data:",
          responseWeekly.data.previousData[0].timestamp
        );
        console.log(
          "   Last record previous data:",
          responseWeekly.data.previousData[
            responseWeekly.data.previousData.length - 1
          ].timestamp
        );
      }

      const processedWeeklyPreview = processPreview(
        responseWeekly.data.currentData,
        responseWeekly.data.previousData
      );
      setWeeklyPreview(processedWeeklyPreview);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al analizar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setLoading(true);
      const selectedCameraName =
        cameras.find((c) => c.channel_id === selectedCamera)?.name || "Unknown";
      const formattedDate = moment(selectedDate).format("DDMMYYYY");
      const defaultFileName = `Temperature_Analysis_${selectedCameraName.replace(
        /\s+/g,
        "_"
      )}_${formattedDate}.pdf`;

      const response = await axios.post(
        "/api/ubibot/generate-defrost-report",
        {
          channelId: selectedCamera,
          date: moment(selectedDate).format("YYYY-MM-DD"),
        },
        {
          responseType: "blob",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const contentDisposition = response.headers["content-disposition"];
      const matches = /filename="(.+)"/.exec(contentDisposition);
      const serverFileName = matches?.[1] || defaultFileName;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", serverFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Error generando el informe. Por favor intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };
  const handleWeeklyAnalyze = async () => {
    if (
      !selectedCamera ||
      !selectedDate ||
      moment(selectedDate).isoWeekday() !== 7
    ) {
      alert("Por favor seleccione una cámara y un domingo");
      return;
    }

    setLoading(true);
    try {
      // Log the date sent to the API
      const formattedDate = moment(selectedDate).format("YYYY-MM-DD");
      console.log(
        "Fecha enviada a la API para analisis semanal:",
        formattedDate
      );
      const response = await axios.get(
        "/api/ubibot/weekly-defrost-analysis-data",
        {
          params: {
            channelId: selectedCamera,
            date: formattedDate,
          },
        }
      );

      if (
        !response.data ||
        !response.data.currentData ||
        !response.data.previousData
      ) {
        throw new Error("Invalid data format");
      }
      console.log("DefrostAnalysis.js - Weekly Preview - Received data");
      if (response.data.currentData && response.data.currentData.length > 0) {
        console.log(
          "First record current data:",
          response.data.currentData[0].timestamp
        );
        console.log(
          "Last record current data:",
          response.data.currentData[response.data.currentData.length - 1]
            .timestamp
        );
      }
      if (response.data.previousData && response.data.previousData.length > 0) {
        console.log(
          "First record previous data:",
          response.data.previousData[0].timestamp
        );
        console.log(
          "Last record previous data:",
          response.data.previousData[response.data.previousData.length - 1]
            .timestamp
        );
      }

      const processedPreview = processPreview(
        response.data.currentData,
        response.data.previousData
      );
      setWeeklyPreview(processedPreview);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al analizar los datos semanales");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateWeeklyReport = async () => {
    try {
      setLoading(true);
      const selectedCameraName =
        cameras.find((c) => c.channel_id === selectedCamera)?.name || "Unknown";
      const formattedDate = moment(selectedDate).format("DDMMYYYY");
      console.log(
        "DefrostAnalysis.js - Sending data to generate weekly report:"
      );
      console.log("  Channel ID:", selectedCamera);
      console.log("  Date:", moment(selectedDate).format("YYYY-MM-DD"));
      const defaultFileName = `Weekly_Temperature_Analysis_${selectedCameraName.replace(
        /\s+/g,
        "_"
      )}_${formattedDate}.pdf`;
      const response = await axios.post(
        "/api/ubibot/generate-weekly-defrost-report",
        {
          channelId: selectedCamera,
          date: moment(selectedDate).format("YYYY-MM-DD"),
        },
        {
          responseType: "blob",
          timeout: 30000,
        }
      );
      const contentDisposition = response.headers["content-disposition"];
      const matches = /filename="(.+)"/.exec(contentDisposition);
      const serverFileName = matches?.[1] || defaultFileName;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", serverFileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating weekly report:", error);
      alert(
        "Error generando el informe semanal. Por favor intente nuevamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="defrost-analysis">
      <Header title="Análisis de Temperatura" />
      <div className="analysis-controls">
        <select
          value={selectedCamera}
          onChange={(e) => setSelectedCamera(e.target.value)}
        >
          <option value="">Seleccionar Cámara</option>
          {cameras.map((camera) => (
            <option key={camera.channel_id} value={camera.channel_id}>
              {camera.name}
            </option>
          ))}
        </select>

        <DatePicker
          selected={selectedDate}
          onChange={setSelectedDate}
          filterDate={(date) => moment(date).day() === 0}
          dateFormat="dd/MM/yyyy"
          placeholderText="Seleccionar Domingo"
        />

        <button onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analizando..." : "Analizar"}
        </button>
      </div>

      {preview && (
        <div className="preview-section">
          <h2>Vista Previa</h2>
          <div className="preview-content">
            <div className="current-data">
              <h3>Domingo {moment(selectedDate).format("DD/MM/YYYY")}</h3>
              <p>
                Temperatura Promedio: {preview.current.promedio.toFixed(2)}°C
              </p>
              <p>
                Desviación Estándar: {preview.current.desv_std.toFixed(2)}°C
              </p>
              <p>Temperatura Máxima: {preview.current.max.toFixed(2)}°C</p>
              <p>Temperatura Mínima: {preview.current.min.toFixed(2)}°C</p>
              <p>Total de Registros: {preview.current.registros}</p>
            </div>
            <div className="previous-data">
              <h3>
                Domingo{" "}
                {moment(selectedDate).subtract(7, "days").format("DD/MM/YYYY")}
              </h3>
              <p>
                Temperatura Promedio: {preview.previous.promedio.toFixed(2)}°C
              </p>
              <p>
                Desviación Estándar: {preview.previous.desv_std.toFixed(2)}°C
              </p>
              <p>Temperatura Máxima: {preview.previous.max.toFixed(2)}°C</p>
              <p>Temperatura Mínima: {preview.previous.min.toFixed(2)}°C</p>
              <p>Total de Registros: {preview.previous.registros}</p>
            </div>
          </div>
          <button onClick={handleGenerateReport}>Generar Informe PDF</button>
        </div>
      )}
      {weeklyPreview && (
        <div className="weekly-preview-section">
          <h2>Análisis Semanal</h2>
          <div className="preview-content">
            <div className="current-data">
              <h3>
                Semana del{" "}
                {moment(selectedDate).subtract(6, "days").format("DD/MM/YYYY")}
                al {moment(selectedDate).format("DD/MM/YYYY")}
              </h3>
              <p>
                Temperatura Promedio:{" "}
                {weeklyPreview.current.promedio.toFixed(2)}°C
              </p>
              <p>
                Desviación Estándar: {weeklyPreview.current.desv_std.toFixed(2)}
                °C
              </p>
              <p>
                Temperatura Máxima: {weeklyPreview.current.max.toFixed(2)}°C
              </p>
              <p>
                Temperatura Mínima: {weeklyPreview.current.min.toFixed(2)}°C
              </p>
              <p>Total de Registros: {weeklyPreview.current.registros}</p>
            </div>
            <div className="previous-data">
              <h3>
                Semana del{" "}
                {moment(selectedDate).subtract(13, "days").format("DD/MM/YYYY")}
                al{" "}
                {moment(selectedDate).subtract(7, "days").format("DD/MM/YYYY")}
              </h3>
              <p>
                Temperatura Promedio:{" "}
                {weeklyPreview.previous.promedio.toFixed(2)}°C
              </p>
              <p>
                Desviación Estándar:{" "}
                {weeklyPreview.previous.desv_std.toFixed(2)}°C
              </p>
              <p>
                Temperatura Máxima: {weeklyPreview.previous.max.toFixed(2)}°C
              </p>
              <p>
                Temperatura Mínima: {weeklyPreview.previous.min.toFixed(2)}°C
              </p>
              <p>Total de Registros: {weeklyPreview.previous.registros}</p>
            </div>
          </div>
          <button onClick={handleGenerateWeeklyReport} disabled={loading}>
            Generar Informe Semanal PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default DefrostAnalysis;

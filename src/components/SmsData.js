import React, { useState, useEffect } from "react";
import axios from "axios";
import moment from "moment-timezone";
import Header from "./Header";
import pinIcon from "./assets/images/pngkit.png";
import MapModal from "./MapModal";

const SmsData = () => {
  const [smsData, setSmsData] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(
          "http://thenext.ddns.net:1337/api/sms-data" //TODO revisar si se tiene que cambiar
        );
        const sortedData = response.data.sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
        setSmsData(sortedData);
      } catch (error) {
        console.error("Error fetching SMS data:", error);
      }
    };

    fetchData();
  }, []);

  const formatTimestamp = (timestamp) => {
    return moment(timestamp)
      .tz("America/Santiago")
      .format("YYYY-MM-DD HH:mm:ss");
  };

  const handleIconClick = (latitud, longitud) => {
    setSelectedPosition({ latitud, longitud });
    setIsModalOpen(true);
  };

  const extractAlertMessage = (message) => {
    if (
      message.toLowerCase().includes("hombre caido") ||
      message.toLowerCase().includes("mandown")
    ) {
      return "Hombre Caído";
    } else if (message.toLowerCase().includes("necesito ayuda")) {
      return "Necesito Ayuda";
    }
    return "";
  };

  const getAlertStyle = (message) => {
    if (
      message.toLowerCase().includes("hombre caido") ||
      message.toLowerCase().includes("mandown")
    ) {
      return { backgroundColor: "rgba(255, 0, 0, 0.5)", color: "white" };
    } else if (message.toLowerCase().includes("necesito ayuda")) {
      return { backgroundColor: "rgba(255, 255, 0, 0.5)", color: "black" };
    }
    return {};
  };

  return (
    <div>
      <Header title="Base de Mensajes Recibidos" />
      <div className="content">
        <h1>SMS Data</h1>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Device ID</th>
              <th>Alerta</th>
              <th>Sector</th>
              <th>Latitud</th>
              <th>Longitud</th>
              <th>Timestamp</th>
              <th>Mapa</th>
            </tr>
          </thead>
          <tbody>
            {smsData.map((sms) => (
              <tr key={sms.id}>
                <td>{sms.id}</td>
                <td>{sms.device_id}</td>
                <td style={getAlertStyle(sms.message)}>
                  {extractAlertMessage(sms.message)}
                </td>
                <td>{sms.sector}</td>
                <td>{sms.latitud}</td>
                <td>{sms.longitud}</td>
                <td>{formatTimestamp(sms.timestamp)}</td>
                <td>
                  <img
                    src={pinIcon}
                    alt="Mapa"
                    style={{ cursor: "pointer", width: "14px", height: "24px" }}
                    onClick={() => handleIconClick(sms.latitud, sms.longitud)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isModalOpen && selectedPosition && (
          <MapModal
            latitud={selectedPosition.latitud}
            longitud={selectedPosition.longitud}
            onClose={() => setIsModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default SmsData;

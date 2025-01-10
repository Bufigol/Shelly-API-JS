// En TemperatureGauge.js
import React, { useEffect, useRef } from "react";
import { RadialGauge } from "canvas-gauges";
import dayjs from "dayjs";

const TemperatureGauge = ({
  temperature,
  location,
  timestamp,
  width,
  height,
  minimo,
  maximo,
}) => {
  const gaugeRef = useRef(null);

  useEffect(() => {
    if (gaugeRef.current) {
      const gauge = new RadialGauge({
        renderTo: gaugeRef.current,
        width: width || 300,
        height: height || 300,
        units: "°C",
        title: location,
        minValue: -50,
        maxValue: 50,
        majorTicks: [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50],
        minorTicks: 2,
        strokeTicks: true,
        highlights: [
          { from: -50, to: 0, color: "rgba(0,0,255,.3)" },
          { from: 0, to: 50, color: "rgba(255,0,0,.3)" },
        ],
        ticksAngle: 225,
        startAngle: 67.5,
        colorMajorTicks: "#ddd",
        colorMinorTicks: "#ddd",
        colorTitle: "#eee",
        colorUnits: "#ccc",
        colorNumbers: "#eee",
        colorPlate: "#222",
        borderShadowWidth: 0,
        borders: true,
        needleType: "arrow",
        needleWidth: 2,
        needleCircleSize: 7,
        needleCircleOuter: true,
        needleCircleInner: false,
        animationDuration: 1500,
        animationRule: "linear",
        colorBorderOuter: "#333",
        colorBorderOuterEnd: "#111",
        colorBorderMiddle: "#222",
        colorBorderMiddleEnd: "#111",
        colorBorderInner: "#111",
        colorBorderInnerEnd: "#333",
        colorNeedleShadowDown: "#333",
        colorNeedleCircleOuter: "#333",
        colorNeedleCircleOuterEnd: "#111",
        colorNeedleCircleInner: "#111",
        colorNeedleCircleInnerEnd: "#222",
        valueBoxBorderRadius: 0,
        colorValueBoxRect: "#222",
        colorValueBoxRectEnd: "#333",
        value: temperature,
      }).draw();

      return () => {
        gauge.destroy();
      };
    }
  }, [temperature, location, width, height]);
  const isTemperatureInRange = temperature >= minimo && temperature <= maximo;

  return (
    <div style={{ textAlign: "center", margin: "10px" }}>
      <canvas ref={gaugeRef}></canvas>
      <p style={{ fontSize: "18px", fontWeight: "bold" }}>
        {dayjs(timestamp).format("HH:mm")}
      </p>
      <div
        style={{ display: "flex", justifyContent: "center", marginTop: "10px" }}
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: isTemperatureInRange
              ? "rgba(0, 255, 0, 1)"
              : "rgba(0, 255, 0, 0.3)",
            marginRight: "5px",
          }}
        ></div>
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: isTemperatureInRange
              ? "rgba(255, 0, 0, 0.3)"
              : "rgba(255, 0, 0, 1)",
          }}
        ></div>
      </div>
    </div>
  );
};

export default TemperatureGauge;

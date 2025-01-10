const PDFDocument = require("pdfkit");
const moment = require("moment");
const QuickChart = require("quickchart-js");
const fetch = require("node-fetch");

class TemperatureAnalyzer {
  constructor() {
    this.stats = {
      current: {
        promedio: 0,
        desv_std: 0,
        max: -Infinity,
        min: Infinity,
        registros: 0,
      },
      previous: {
        promedio: 0,
        desv_std: 0,
        max: -Infinity,
        min: Infinity,
        registros: 0,
      },
    };
    this.hourlyAverages = {
      current: new Map(),
      previous: new Map(),
    };
    this.records = {
      current: [],
      previous: [],
    };
  }

  async analyzeData(currentData, previousData, cameraName, dataDate) {
    if (!currentData || currentData.length === 0) {
      throw new Error("No hay datos para analizar para la fecha actual");
    }
    if (!previousData || previousData.length === 0) {
      throw new Error("No hay datos para analizar para la semana previa");
    }

    // Convertir los datos y almacenarlos en la instancia
    this.records.current = currentData.map((record) => ({
      datetime: moment(record.timestamp),
      temperature: parseFloat(record.temperature),
    }));
    this.records.previous = previousData.map((record) => ({
      datetime: moment(record.timestamp),
      temperature: parseFloat(record.temperature),
    }));
    // Calculate the stats for each period
    this.calculateStats("current");
    this.calculateStats("previous");
    this.calculateHourlyPatterns("current");
    this.calculateHourlyPatterns("previous");
  }

  calculateStats(period) {
    const temperatures = this.records[period].map((r) => r.temperature);
    this.stats[period].registros = temperatures.length;
    this.stats[period].promedio =
      temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    this.stats[period].desv_std = Math.sqrt(
      temperatures.reduce(
        (a, b) => a + Math.pow(b - this.stats[period].promedio, 2),
        0
      ) / temperatures.length
    );
    this.stats[period].max = Math.max(...temperatures);
    this.stats[period].min = Math.min(...temperatures);
  }
  calculateHourlyPatterns(period) {
    this.hourlyAverages[period].clear();
    this.records[period].forEach((record) => {
      const hour = record.datetime.hour();
      if (!this.hourlyAverages[period].has(hour)) {
        this.hourlyAverages[period].set(hour, {
          sum: 0,
          count: 0,
          max: -Infinity,
          min: Infinity,
        });
      }
      const temp = record.temperature;
      const hourData = this.hourlyAverages[period].get(hour);
      hourData.sum += temp;
      hourData.count++;
      hourData.max = Math.max(hourData.max, temp);
      hourData.min = Math.min(hourData.min, temp);
    });
  }

  async generateTemperatureChart(period, dataDate) {
    const chart = new QuickChart();

    const hours = Array.from(this.hourlyAverages[period].keys()).sort(
      (a, b) => a - b
    );
    const averages = hours.map((hour) => {
      const data = this.hourlyAverages[period].get(hour);
      return data.sum / data.count;
    });
    const maxTemps = hours.map(
      (hour) => this.hourlyAverages[period].get(hour).max
    );
    const minTemps = hours.map(
      (hour) => this.hourlyAverages[period].get(hour).min
    );

    chart
      .setWidth(800)
      .setHeight(400)
      .setBackgroundColor("white")
      .setVersion("2");

    const config = {
      type: "line",
      data: {
        labels: hours.map((hour) => `${hour.toString().padStart(2, "0")}:00`),
        datasets: [
          {
            label: "Temperatura Promedio (°C)",
            data: averages,
            borderColor: "rgb(75, 192, 192)",
            fill: false,
            tension: 0.4,
          },
          {
            label: "Temperatura Máxima (°C)",
            data: maxTemps,
            borderColor: "rgb(255, 99, 132)",
            fill: false,
            tension: 0.4,
          },
          {
            label: "Temperatura Mínima (°C)",
            data: minTemps,
            borderColor: "rgb(54, 162, 235)",
            fill: false,
            tension: 0.4,
          },
        ],
      },
    };

    chart.setConfig(config);

    try {
      const imageUrl = await chart.getShortUrl();
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("Error generating the chart:", error);
      throw error;
    }
  }
  async generatePDF(cameraName, dataDate) {
    return new Promise(async (resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({
        size: "Letter",
        margins: {
          top: 100,
          bottom: 70,
          left: 60,
          right: 60,
        },
      });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      try {
        this.generatePDFContent(doc, cameraName, dataDate);

        // Add the chart and adjust position
        doc
          .fontSize(16)
          .text(
            `Valores Detallados por Hora Período Actual- ${moment(
              dataDate
            ).format("DD-MM-YYYY")}`,
            {
              underline: true,
              align: "center",
            }
          )
          .moveDown(1);

        const chartBuffer = await this.generateTemperatureChart(
          "current",
          dataDate
        );
        if (chartBuffer) {
          doc.image(chartBuffer, 50, doc.y, {
            fit: [500, 200],
            align: "center",
          });
          doc.moveDown(12); // Add space after the chart
        }

        doc.addPage();
        await this.addDetailedValuesTable(doc, "current", dataDate);
        doc.addPage();
        doc
          .fontSize(16)
          .text(
            `Valores Detallados por Hora Período Anterior- ${moment(dataDate)
              .subtract(7, "days")
              .format("DD-MM-YYYY")}`,
            {
              underline: true,
              align: "left",
              left: 0, // Alinea el texto a 50 unidades del borde izquierdo
            }
          )
          .moveDown(1);

        const chartBufferPrevious = await this.generateTemperatureChart(
          "previous",
          moment(dataDate).subtract(7, "days")
        );
        if (chartBufferPrevious) {
          doc.image(chartBufferPrevious, 50, doc.y, {
            fit: [500, 200],
            align: "center",
          });
          doc.moveDown(12); // Add space after the chart
        }

        await this.addDetailedValuesTable(
          doc,
          "previous",
          moment(dataDate).subtract(7, "days")
        );

        doc.end();
      } catch (error) {
        console.error("Error generating PDF:", error);
        reject(error);
      }
    });
  }

  drawPageHeader(doc, cameraName, dataDate) {
    try {
      doc.image("./src/assets/images/thenextlogo.png", 70, 30, {
        width: 100,
        height: 75,
      });
      doc.image("./src/assets/images/storagelogo.png", 440, 30, {
        width: 100,
        height: 75,
      });
    } catch (error) {
      console.error("Error loading logos:", error);
    }

    doc
      .moveDown(1)
      .fontSize(18)
      .text("Informe de Análisis de Temperatura", { align: "center" })
      .fontSize(14)
      .text(`Cámara: ${cameraName}`, { align: "center" })
      .fontSize(12)
      .text(
        `Fecha de los Datos Analizados: ${moment(dataDate).format(
          "DD-MM-YYYY"
        )}`,
        { align: "center" }
      )
      .moveDown(0.5)
      .text("Analiza Domingos - Puertas Cerradas*", { align: "center" })
      .text(`Fecha de Análisis: ${moment().format("DD-MM-YYYY HH:mm")}`, {
        align: "center",
      })
      .moveDown(2);
  }

  async generatePDFContent(doc, cameraName, dataDate) {
    doc.on("pageAdded", () => {
      try {
        doc.image("./src/assets/images/thenextlogo.png", 70, 30, {
          width: 100,
          height: 75,
        });
        doc.image("./src/assets/images/storagelogo.png", 440, 30, {
          width: 100,
          height: 75,
        });
      } catch (error) {
        console.error("Error loading logos:", error);
      }
    });
    this.drawPageHeader(
      doc,
      cameraName || "Sin nombre",
      dataDate || "Sin fecha"
    );
    doc
      .fontSize(16)
      .text("Indicadores", { underline: true, align: "left" })
      .moveDown(1);
    // Tabla de estadísticas
    const tableConfig = {
      margin: { left: 50, right: 50 },
      rowHeight: 25,
      headerHeight: 30,
      fontSize: 10,
      columns: [
        { header: "Descripción Indicadores", width: 200 },
        {
          header: `${moment(dataDate).format("DD-MM-YYYY")}\nPeriodo Actual`,
          width: 120,
        }, // Agregamos "Periodo Actual"
        {
          header: `${moment(dataDate)
            .subtract(7, "days")
            .format("DD-MM-YYYY")}\nPeriodo Anterior`,
          width: 120,
        },
      ],
    };

    let yPos = doc.y;
    const startX = tableConfig.margin.left;

    // Encabezado
    doc
      .fillColor("#f0f0f0")
      .rect(
        startX,
        yPos,
        tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
        tableConfig.headerHeight + 10
      )
      .fill();

    doc.fillColor("#000000");

    // Texto del encabezado
    doc.fontSize(tableConfig.fontSize);
    tableConfig.columns.forEach((column, i) => {
      let xPos = startX;
      for (let j = 0; j < i; j++) {
        xPos += tableConfig.columns[j].width;
      }
      doc.text(
        column.header,
        xPos,
        yPos + (tableConfig.headerHeight - tableConfig.fontSize) / 2,
        { width: column.width, align: "center" }
      );
    });

    yPos += tableConfig.headerHeight + 10;

    // Datos de la tabla
    const rows = [
      [
        "Temperatura Promedio (°C)",
        this.stats.current.promedio.toFixed(2),
        this.stats.previous.promedio.toFixed(2),
      ],
      [
        "Desviación Estándar (°C)",
        this.stats.current.desv_std.toFixed(2),
        this.stats.previous.desv_std.toFixed(2),
      ],
      [
        "Temperatura Máxima (°C)",
        this.stats.current.max.toFixed(2),
        this.stats.previous.max.toFixed(2),
      ],
      [
        "Temperatura Mínima (°C)",
        this.stats.current.min.toFixed(2),
        this.stats.previous.min.toFixed(2),
      ],
      [
        "Total de Registros",
        this.stats.current.registros.toString(),
        this.stats.previous.registros.toString(),
      ],
    ];
    doc.moveDown(16);
    rows.forEach((rowData, index) => {
      if (index % 2 === 0) {
        doc
          .fillColor("#f9f9f9")
          .rect(
            startX,
            yPos,
            tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
            tableConfig.rowHeight
          )
          .fill();
      }

      doc.fillColor("#000000");

      let xPos = startX;
      rowData.forEach((text, i) => {
        const isCurrentDateColumn = i === 1;
        doc
          .font(isCurrentDateColumn ? "Helvetica-Bold" : "Helvetica")
          .text(
            text,
            xPos,
            yPos + (tableConfig.rowHeight - tableConfig.fontSize) / 2,
            { width: tableConfig.columns[i].width, align: "center" }
          );
        xPos += tableConfig.columns[i].width;
      });

      yPos += tableConfig.rowHeight;
    });
    doc.moveDown(2);
  }

  async addDetailedValuesTable(doc, period, dataDate) {
    const startY = doc.y;
    const tableConfig = {
      margin: { left: 50, right: 50 },
      rowHeight: 20,
      headerHeight: 20,
      fontSize: 10,
      columns: [
        { header: "Hora", width: 60 },
        { header: "Temp Promedio (°C)", width: 120 },
        { header: "Temp Máxima (°C)", width: 120 },
        { header: "Temp Mínima (°C)", width: 120 },
      ],
    };

    let yPos = doc.y;
    const startX = tableConfig.margin.left;
    // Encabezado
    doc
      .fillColor("#f0f0f0")
      .rect(
        startX,
        yPos,
        tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
        tableConfig.headerHeight
      )
      .fill();

    doc.fillColor("#000000");

    // Texto del encabezado
    doc.fontSize(tableConfig.fontSize);
    tableConfig.columns.forEach((column, i) => {
      let xPos = startX;
      for (let j = 0; j < i; j++) {
        xPos += tableConfig.columns[j].width;
      }
      doc.text(
        column.header,
        xPos,
        yPos + (tableConfig.headerHeight - tableConfig.fontSize) / 2,
        { width: column.width, align: "center" }
      );
    });
    yPos += tableConfig.headerHeight;

    // Datos de la tabla
    Array.from(this.hourlyAverages[period].keys())
      .sort((a, b) => a - b)
      .forEach((hour, index) => {
        if (
          yPos + tableConfig.rowHeight >
          doc.page.height - doc.page.margins.bottom
        ) {
          doc.addPage();
          yPos = doc.page.margins.top;
        }
        const data = this.hourlyAverages[period].get(hour);
        const rowData = [
          `${hour.toString().padStart(2, "0")}:00`,
          (data.sum / data.count).toFixed(2),
          data.max.toFixed(2),
          data.min.toFixed(2),
        ];

        if (index % 2 === 0) {
          doc
            .fillColor("#f9f9f9")
            .rect(
              startX,
              yPos,
              tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
              tableConfig.rowHeight
            )
            .fill();
        }

        doc.fillColor("#000000");

        let xPos = startX;
        rowData.forEach((text, i) => {
          doc.text(
            text,
            xPos,
            yPos + (tableConfig.rowHeight - tableConfig.fontSize) / 2,
            { width: tableConfig.columns[i].width, align: "center" }
          );
          xPos += tableConfig.columns[i].width;
        });
        yPos += tableConfig.rowHeight;
      });
    doc.y = yPos + 20;
  }
}

module.exports = TemperatureAnalyzer;

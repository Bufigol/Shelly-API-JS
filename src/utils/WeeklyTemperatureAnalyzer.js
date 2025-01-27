// WeeklyTemperatureAnalyzer.js
const PDFDocument = require("pdfkit");
const moment = require("moment-timezone");
const QuickChart = require("quickchart-js");
const fetch = require("node-fetch");

class WeeklyTemperatureAnalyzer {
  constructor() {
    this.stats = {
      current: {
        promedio: 0,
        desv_std: 0,
        max: -Infinity,
        min: Infinity,
        registros: 0,
        weekNumber: 0,
      },
      previous: {
        promedio: 0,
        desv_std: 0,
        max: -Infinity,
        min: Infinity,
        registros: 0,
        weekNumber: 0,
      },
    };
    this.dailyAverages = {
      current: new Map(),
      previous: new Map(),
    };
    this.records = {
      current: [],
      previous: [],
    };
    // Agregar estructura para análisis de distribución
    this.temperatureDistribution = {
      current: new Map(),
      previous: new Map(),
    };
  }

  // Agregar método para calcular distribución de temperaturas
  calculateTemperatureDistribution(period) {
    const ranges = [
      { min: -20, max: -16, label: "-20 a -16" },
      { min: -15.9, max: -14, label: "-15.9 a -14" },
      { min: -13.9, max: -10, label: "-13.9 a -10" },
      { min: -10, max: -5, label: "-10 a -5" },
      { min: -4.9, max: 0, label: "-4.9 a 0" },
      { min: 0, max: Infinity, label: "Temperatura positiva" },
    ];

    const distribution = new Map();
    const dayNames = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];

    // Inicializar distribución
    dayNames.forEach((day) => {
      distribution.set(
        day,
        ranges.map((range) => ({
          range: range.label,
          count: 0,
          percentage: 0,
        }))
      );
    });

    // Contar las temperaturas por rango y día
    for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
      const dayName = dayNames[dayIndex - 1];
      this.records[period]
        .filter((record) => record.datetime.isoWeekday() === dayIndex)
        .forEach((record) => {
          const temp = record.temperature;
          const dayData = distribution.get(dayName);

          const rangeIndex = ranges.findIndex(
            (range) => temp >= range.min && temp <= range.max
          );
          if (rangeIndex >= 0) {
            dayData[rangeIndex].count++;
          }
        });
    }

    // Calcular porcentajes enteros y ajustar para que sumen 100
    distribution.forEach((dayData, day) => {
      const totalReadings = dayData.reduce(
        (sum, range) => sum + range.count,
        0
      );
      let totalPercentage = 0;

      dayData.forEach((range) => {
        range.percentage =
          totalReadings > 0
            ? Math.round((range.count / totalReadings) * 100)
            : 0;
        totalPercentage += range.percentage;
      });

      // Ajustar la diferencia para que la suma sea 100
      let correction = 100 - totalPercentage;
      if (correction !== 0) {
        for (const range of dayData) {
          if (range.percentage > 0) {
            range.percentage += correction;
            if (range.percentage < 0) range.percentage = 0; // Asegurar que no sea negativo
            break;
          }
        }
      }
    });

    this.temperatureDistribution[period] = distribution;
  }

  async generateDistributionChart(period) {
    const chart = new QuickChart();
    const dayNames = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];
    const distribution = this.temperatureDistribution[period];

    const datasets = [
      {
        label: "-20 a -16",
        backgroundColor: "#000080",
        stack: "Stack 0",
        data: dayNames.map((dayName) => {
          const dayData = distribution.get(dayName);
          return dayData ? dayData[0].percentage : 0;
        }),
      },
      {
        label: "-15.9 a -14",
        backgroundColor: "#0000FF",
        stack: "Stack 0",
        data: dayNames.map((dayName) => {
          const dayData = distribution.get(dayName);
          return dayData ? dayData[1].percentage : 0;
        }),
      },
      {
        label: "-13.9 a -10",
        backgroundColor: "#00FF00",
        stack: "Stack 0",
        data: dayNames.map((dayName) => {
          const dayData = distribution.get(dayName);
          return dayData ? dayData[2].percentage : 0;
        }),
      },
      {
        label: "-10 a -5",
        backgroundColor: "#FFFF00",
        stack: "Stack 0",
        data: dayNames.map((dayName) => {
          const dayData = distribution.get(dayName);
          return dayData ? dayData[3].percentage : 0;
        }),
      },
      {
        label: "-4.9 a 0",
        backgroundColor: "#FFA500",
        stack: "Stack 0",
        data: dayNames.map((dayName) => {
          const dayData = distribution.get(dayName);
          return dayData ? dayData[4].percentage : 0;
        }),
      },
      {
        label: "Temperatura positiva",
        backgroundColor: "#FF0000",
        stack: "Stack 0",
        data: dayNames.map((dayName) => {
          const dayData = distribution.get(dayName);
          return dayData ? dayData[5].percentage : 0;
        }),
      },
    ];

    chart
      .setWidth(500)
      .setHeight(400)
      .setBackgroundColor("white")
      .setVersion("2");

    const config = {
      type: "bar",
      data: {
        labels: dayNames,
        datasets: datasets,
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: "Distribución Porcentual de Rangos de Temperatura por Día",
            font: {
              size: 16,
            },
          },
          legend: {
            display: true,
            position: "right",
          },
        },
        responsive: true,
        scales: {
          x: {
            stacked: true,
            grid: {
              display: false,
            },
          },
          y: {
            stacked: true,
            min: 0,
            max: 100,
            ticks: {
              stepSize: 20,
              callback: function (value) {
                return value + "%";
              },
            },
            grid: {
              color: "#E5E5E5",
            },
          },
        },
        layout: {
          padding: {
            left: 20,
            right: 20,
            top: 20,
            bottom: 20,
          },
        },
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
      console.error("Error generating distribution chart:", error);
      throw error;
    }
  }

  async analyzeData(currentData, previousData, cameraName, dataDate) {
    // Configurar moment para usar lunes como primer día de la semana
    moment.locale("es", {
      week: {
        dow: 1, // Lunes es 1
        doy: 4, // La semana que contiene Ene 4 es la primera semana del año
      },
    });

    // Use selectedDate as anchor point
    const selectedDate = moment(dataDate).tz("America/Santiago");

    // Calculate date ranges correctly
    const startDate = selectedDate.clone().subtract(6, "days").startOf("day");
    const endDate = selectedDate.clone().endOf("day");
    const prevStartDate = selectedDate
      .clone()
      .subtract(13, "days")
      .startOf("day");
    const prevEndDate = selectedDate.clone().subtract(7, "days").endOf("day");

    console.log("analyzeData - Calculated Date Ranges:");
    console.log(
      "  Current Week Start:",
      startDate.format("YYYY-MM-DD HH:mm:ss")
    );
    console.log("  Current Week End:", endDate.format("YYYY-MM-DD HH:mm:ss"));
    console.log(
      "  Previous Week Start:",
      prevStartDate.format("YYYY-MM-DD HH:mm:ss")
    );
    console.log(
      "  Previous Week End:",
      prevEndDate.format("YYYY-MM-DD HH:mm:ss")
    );

    console.log("Current Week Range:", {
      start: startDate.format("YYYY-MM-DD HH:mm:ss"),
      end: endDate.format("YYYY-MM-DD HH:mm:ss"),
      weekNumber: endDate.isoWeek(),
    });

    console.log("Previous Week Range:", {
      start: prevStartDate.format("YYYY-MM-DD HH:mm:ss"),
      end: prevEndDate.format("YYYY-MM-DD HH:mm:ss"),
      weekNumber: prevEndDate.isoWeek(),
    });

    // Filter the data using the correctly calculated ranges
    this.records.current = currentData
      .map((record) => {
        const datetime = moment.tz(record.timestamp, "America/Santiago");
        return {
          datetime: datetime,
          timestamp: record.timestamp, // Log the raw timestamp
          rawTimestamp: record.external_temperature_timestamp, // Log the original timestamp
          temperature: parseFloat(record.temperature),
        };
      })
      .filter((record) => {
        return record.datetime.isBetween(startDate, endDate, null, "[]");
      });

    this.records.previous = previousData
      .map((record) => {
        const datetime = moment.tz(record.timestamp, "America/Santiago");
        return {
          datetime: datetime,
          timestamp: record.timestamp, // Log the raw timestamp
          rawTimestamp: record.external_temperature_timestamp, // Log the original timestamp
          temperature: parseFloat(record.temperature),
        };
      })
      .filter((record) => {
        return record.datetime.isBetween(
          prevStartDate,
          prevEndDate,
          null,
          "[]"
        );
      });

    // Almacenar los números de semana
    this.stats.current.weekNumber = endDate.isoWeek();
    this.stats.previous.weekNumber = prevEndDate.isoWeek();

    // Store the date ranges for reference
    this.dateRanges = {
      current: {
        start: startDate.format("DD/MM/YYYY"),
        end: endDate.format("DD/MM/YYYY"),
      },
      previous: {
        start: prevStartDate.format("DD/MM/YYYY"),
        end: prevEndDate.format("DD/MM/YYYY"),
      },
    };

    // Calculate statistics for each period
    this.calculateStats("current");
    this.calculateStats("previous");
    this.calculateDailyPatterns("current");
    this.calculateDailyPatterns("previous");

    // Logging específico para verificar datos
    console.log(
      "Sample of current records:",
      this.records.current.slice(0, 5).map((r) => ({
        date: r.datetime.format("YYYY-MM-DD"),
        day: r.datetime.format("dddd"),
        temp: r.temperature,
        timestamp: r.timestamp,
        rawTimestamp: r.rawTimestamp,
      }))
    );

    // Log específico para registros del domingo
    const sundayRecords = this.records.current.filter(
      (r) => r.datetime.isoWeekday() === 7
    );

    // Conteo por día para la semana actual
    const currentDayCount = this.records.current.reduce((acc, record) => {
      const day = record.datetime.format("dddd");
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    console.log("Records per day (current):", currentDayCount);

    // Conteo por día para la semana anterior
    const previousDayCount = this.records.previous.reduce((acc, record) => {
      const day = record.datetime.format("dddd");
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    console.log("Records per day (previous):", previousDayCount);

    // Log adicional para verificar el rango de fechas de los datos
    console.log("Date range verification:", {
      current: {
        firstRecord:
          this.records.current.length > 0
            ? this.records.current[0].datetime.format("YYYY-MM-DD HH:mm:ss")
            : "No records",
        lastRecord:
          this.records.current.length > 0
            ? this.records.current[
                this.records.current.length - 1
              ].datetime.format("YYYY-MM-DD HH:mm:ss")
            : "No records",
      },
      previous: {
        firstRecord:
          this.records.previous.length > 0
            ? this.records.previous[0].datetime.format("YYYY-MM-DD HH:mm:ss")
            : "No records",
        lastRecord:
          this.records.previous.length > 0
            ? this.records.previous[
                this.records.previous.length - 1
              ].datetime.format("YYYY-MM-DD HH:mm:ss")
            : "No records",
      },
    });
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

  calculateDailyPatterns(period) {
    this.dailyAverages[period].clear();

    const dayNames = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];

    // Usar isoWeekday() en lugar de day()
    for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
      const dayData = this.records[period].filter((record) => {
        return record.datetime.isoWeekday() === dayIndex;
      });

      console.log(
        `${period} - Day ${dayIndex} (${dayNames[dayIndex - 1]}) records:`,
        dayData.length
      );

      if (dayData.length > 0) {
        const temperatures = dayData.map((r) => r.temperature);
        this.dailyAverages[period].set(dayIndex, {
          sum: temperatures.reduce((a, b) => a + b, 0),
          count: temperatures.length,
          max: Math.max(...temperatures),
          min: Math.min(...temperatures),
        });
      } else {
        this.dailyAverages[period].set(dayIndex, {
          sum: 0,
          count: 0,
          max: -Infinity,
          min: Infinity,
        });
      }
    }
  }

  async generateTemperatureChart(period, dataDate) {
    const chart = new QuickChart();

    const dayNames = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];

    // Asegurarnos de tener todos los días del 1 al 7
    const days = [1, 2, 3, 4, 5, 6, 7];

    const averages = days.map((day) => {
      const data = this.dailyAverages[period].get(day);
      return data && data.count > 0 ? data.sum / data.count : null;
    });

    const maxTemps = days.map((day) => {
      const data = this.dailyAverages[period].get(day);
      if (!data || data.max === -Infinity) return null;
      return data.max;
    });

    const minTemps = days.map((day) => {
      const data = this.dailyAverages[period].get(day);
      if (!data || data.min === Infinity) return null;
      return data.min;
    });

    chart
      .setWidth(500)
      .setHeight(200)
      .setBackgroundColor("white")
      .setVersion("2");

    const config = {
      type: "line",
      data: {
        labels: days.map((day) => dayNames[day - 1]),
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
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "top",
          },
        },
        scales: {
          y: {
            beginAtZero: false,
          },
        },
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

  drawPageHeader(doc, cameraName, dataDate) {
    try {
      doc.image("./src/assets/images/thenextlogo.png", 70, 30, {
        width: 100,
        height: 75,
      });
      doc.image(
        "./src/assets/images/storagelogo.png",
        600,
        30,
        { width: 100, height: 75 },
        { align: "right" }
      );
    } catch (error) {
      console.error("Error loading logos:", error);
    }

    const currentWeek = moment(dataDate).isoWeek();

    doc
      .moveDown(2)
      .fontSize(18)
      .text("INFORME DE ANALISIS DE TEMPERATURA SEMANAL", { align: "center" })
      .fontSize(14)
      .text(`Correspondiente a: ${cameraName}`, {
        align: "center",
        font: "Helvetica-Bold",
      })
      .fontSize(12)
      .text(
        `Fecha de los Datos Analizados: ${moment(dataDate).format(
          "DD-MM-YYYY"
        )} , Semana ${this.stats.current.weekNumber}`,
        { align: "center" }
      )
      .moveDown(0.5)
      .text("Analiza Inter-Semanas", { align: "center" })
      .text(`Fecha de Análisis: ${moment().format("DD-MM-YYYY HH:mm")}`, {
        align: "center",
      })
      .moveDown(2);
  }
  async addChartSection(doc, period, dataDate, x, y) {
    // Determinar título y número de semana según el período
    const weekNumber =
      period === "current"
        ? this.stats.current.weekNumber
        : this.stats.previous.weekNumber;
    const title = `Valores Detallados por Día Período ${
      period === "current" ? "Actual" : "Anterior"
    } - Semana ${weekNumber}`;

    // Configuración de dimensiones
    const sectionWidth = 300;
    const chartHeight = 180;
    const spacing = 20;

    // Dibujar título
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(title, x, y, {
        width: sectionWidth,
        align: "left",
        underline: true,
      })
      .font("Helvetica")
      .moveDown(1);

    // Generar y agregar el gráfico
    const chartBuffer = await this.generateTemperatureChart(period, dataDate);
    if (chartBuffer) {
      doc.image(chartBuffer, x, y + spacing, {
        fit: [sectionWidth, chartHeight],
        align: "center",
      });
    }

    // Calcular posición Y para la tabla
    const tableY = y + spacing + chartHeight + spacing;

    // Configuración de la tabla
    const tableConfig = {
      fontSize: 9,
      rowHeight: 20,
      headerHeight: 25,
      columns: [
        { header: "Día", width: 70 },
        { header: "Temp Promedio\n(°C)", width: 70 },
        { header: "Temp Máxima\n(°C)", width: 70 },
        { header: "Temp Mínima\n(°C)", width: 70 },
      ],
    };

    // Dibujar tabla
    const headerY = tableY;

    // Fondo del encabezado
    doc
      .fillColor("#f0f0f0")
      .rect(
        x,
        headerY,
        tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
        tableConfig.headerHeight
      )
      .fill();

    // Texto del encabezado
    doc.fillColor("#000000").fontSize(tableConfig.fontSize);

    let headerX = x;
    tableConfig.columns.forEach((column) => {
      doc.text(
        column.header,
        headerX,
        headerY + (tableConfig.headerHeight - tableConfig.fontSize * 2) / 2,
        { width: column.width, align: "center" }
      );
      headerX += column.width;
    });

    // Obtener datos de la tabla según el período
    const dailyData = Array.from(this.dailyAverages[period].entries())
      .sort((a, b) => a[0] - b[0])
      .map(([dayIndex, data]) => ({
        day: [
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes",
          "Sábado",
          "Domingo",
        ][dayIndex - 1],
        avg: data.count > 0 ? (data.sum / data.count).toFixed(2) : "NaN",
        max: data.max !== -Infinity ? data.max.toFixed(2) : "NaN",
        min: data.min !== Infinity ? data.min.toFixed(2) : "NaN",
      }));

    // Dibujar filas de datos
    let rowY = headerY + tableConfig.headerHeight;
    dailyData.forEach((row, index) => {
      // Fondo alternado para las filas
      if (index % 2 === 0) {
        doc
          .fillColor("#f9f9f9")
          .rect(
            x,
            rowY,
            tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
            tableConfig.rowHeight
          )
          .fill();
      }

      doc.fillColor("#000000");

      // Datos de la fila
      let cellX = x;
      [row.day, row.avg, row.max, row.min].forEach((text, i) => {
        doc.text(
          text,
          cellX,
          rowY + (tableConfig.rowHeight - tableConfig.fontSize) / 2,
          { width: tableConfig.columns[i].width, align: "center" }
        );
        cellX += tableConfig.columns[i].width;
      });

      rowY += tableConfig.rowHeight;
    });

    // Retornar la posición Y final para seguir agregando contenido
    return rowY;
  }
  async generatePDFContent(doc, cameraName, dataDate) {
    // Mantener el evento pageAdded para los logos
    doc.on("pageAdded", () => {
      try {
        doc.image("./src/assets/images/thenextlogo.png", 70, 30, {
          width: 100,
          height: 75,
        });
        doc.image(
          "./src/assets/images/storagelogo.png",
          600,
          30,
          { width: 100, height: 75 },
          { align: "right" }
        );
      } catch (error) {
        console.error("Error loading logos:", error);
      }
    });

    // Dibujar el encabezado
    this.drawPageHeader(
      doc,
      cameraName || "Sin nombre",
      dataDate || "Sin fecha"
    );

    // Sección de Indicadores
    doc
      .fontSize(16)
      .text("Indicadores", { underline: true, align: "center" })
      .moveDown(1);

    // Tabla de estadísticas (código modificado)
    const tableConfig = {
      align: "center",
      rowHeight: 25,
      headerHeight: 30,
      fontSize: 10,
      columns: [
        { header: "Descripción\nIndicadores", width: 150 },
        {
          header: `Semana ${this.stats.current.weekNumber}\nPeríodo Actual`,
          width: 100,
        },
        {
          header: `Semana ${this.stats.previous.weekNumber}\nPeríodo Anterior`,
          width: 100,
        },
      ],
    };

    // Calcular el ancho total de la tabla
    const tableWidth = tableConfig.columns.reduce(
      (sum, col) => sum + col.width,
      0
    );
    // Calcular la posición X para centrar la tabla
    const startX = (doc.page.width - tableWidth) / 2;

    let yPos = doc.y;

    // Encabezado de la tabla
    doc
      .fillColor("#f0f0f0")
      .rect(
        startX,
        yPos, // Cambiar de tableConfig.margin.left a startX
        tableConfig.columns.reduce((sum, col) => sum + col.width, 0),
        tableConfig.headerHeight + 10
      )
      .fill();

    doc.fillColor("#000000");

    // Texto del encabezado
    doc.fontSize(tableConfig.fontSize);
    tableConfig.columns.forEach((column, i) => {
      let xPos = startX; // Cambiar de tableConfig.margin.left a startX
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

    // Nueva página para los gráficos y tablas
    doc.addPage();

    // Calcular dimensiones para el nuevo layout
    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const chartWidth = pageWidth / 2;
    const startY = doc.page.margins.top + 50; // Dar espacio para los logos

    // Sección período actual (lado izquierdo)
    doc
      .fontSize(12)
      .text(
        `Valores Detallados por Día Período Actual - Semana ${this.stats.current.weekNumber}`,
        doc.page.margins.left,
        startY,
        { width: chartWidth, underline: true }
      );

    const chartBufferCurrent = await this.generateTemperatureChart(
      "current",
      dataDate
    );
    if (chartBufferCurrent) {
      doc.image(chartBufferCurrent, doc.page.margins.left, startY + 30, {
        fit: [chartWidth - 20, 180],
      });
    }

    // Tabla período actual
    await this.addDetailedValuesTable(
      doc,
      "current",
      dataDate,
      doc.page.margins.left,
      startY + 220
    );

    // Sección período anterior (lado derecho)
    doc
      .fontSize(12)
      .text(
        `Valores Detallados por Día Período Anterior - Semana ${this.stats.previous.weekNumber}`,
        doc.page.margins.left + chartWidth,
        startY,
        { width: chartWidth, underline: true }
      );

    const chartBufferPrevious = await this.generateTemperatureChart(
      "previous",
      dataDate
    );
    if (chartBufferPrevious) {
      doc.image(
        chartBufferPrevious,
        doc.page.margins.left + chartWidth,
        startY + 30,
        { fit: [chartWidth - 20, 180] }
      );
    }

    // Tabla período anterior
    await this.addDetailedValuesTable(
      doc,
      "previous",
      dataDate,
      doc.page.margins.left + chartWidth,
      startY + 220
    );

    doc.moveDown(2);
  }

  async generatePDF(cameraName, dataDate) {
    return new Promise(async (resolve, reject) => {
      const chunks = [];
      const doc = new PDFDocument({
        size: "Letter",
        layout: "landscape",
        margins: {
          top: 70,
          bottom: 70,
          left: 50,
          right: 50,
        },
      });

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      try {
        // Página 1: Contenido inicial del PDF
        await this.generatePDFContent(doc, cameraName, dataDate);

        // Página 2: Gráficos y tablas lado a lado
        doc.addPage();
        const pageWidth =
          doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const chartWidth = pageWidth / 2;
        const startY = doc.page.margins.top + 40;

        // Calcular distribuciones
        this.calculateTemperatureDistribution("current");
        this.calculateTemperatureDistribution("previous");

        // Generar gráficos de distribución
        const currentDistChart = await this.generateDistributionChart(
          "current"
        );
        const previousDistChart = await this.generateDistributionChart(
          "previous"
        );

        // Título para el gráfico actual
        doc.fontSize(12);
        const currentTitle = `Distribución de Temperaturas - Período Actual - Semana ${this.stats.current.weekNumber}`;
        doc.text(currentTitle, doc.page.margins.left, startY, {
          width: chartWidth,
          align: "left",
          underline: true,
        });

        // Título para el gráfico anterior
        doc.fontSize(12);
        const previousTitle = `Distribución de Temperaturas - Período Anterior - Semana ${this.stats.previous.weekNumber}`;
        doc
          .text(previousTitle, doc.page.margins.left + chartWidth, startY, {
            width: chartWidth,
            align: "left",
            underline: true,
          })
          .font("Helvetica");

        // Colocar gráficos lado a lado
        if (currentDistChart) {
          doc.image(currentDistChart, doc.page.margins.left, startY + 10, {
            fit: [chartWidth - 20, 400],
          });
        }
        if (previousDistChart) {
          doc.image(
            previousDistChart,
            doc.page.margins.left + chartWidth,
            startY + 10,
            { fit: [chartWidth - 20, 400] }
          );
        }

        //  Add the data tables
        const currentTableY = startY + 270;
        await this.addDistributionDataTable(
          doc,
          "current",
          doc.page.margins.left,
          currentTableY
        );

        const previousTableY = startY + 270;
        await this.addDistributionDataTable(
          doc,
          "previous",
          doc.page.margins.left + chartWidth,
          previousTableY
        );

        doc.end();
      } catch (error) {
        console.error("Error generating PDF:", error);
        reject(error);
      }
    });
  }
  async addDistributionDataTable(doc, period, tableX, tableY) {
    const ranges = [
      "-20 a -16",
      "-15.9 a -14",
      "-13.9 a -10",
      "-10 a -5",
      "-4.9 a 0",
      "Tempe. > 0",
    ];
    const dayNames = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];
    const distribution = this.temperatureDistribution[period];

    const tableConfig = {
      margin: { left: 50, right: 50 },
      rowHeight: 15,
      headerHeight: 20,
      fontSize: 7,
      columns: [
        { header: "Rango", width: 45 }, // "Rango" column for temp ranges
        ...dayNames.map((day) => ({ header: day, width: 35 })),
      ],
    };

    let yPos = tableY;
    const startX = tableX;

    // Table header
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
    doc.fontSize(tableConfig.fontSize);

    let headerX = startX;
    tableConfig.columns.forEach((column) => {
      doc.text(
        column.header,
        headerX,
        yPos + (tableConfig.headerHeight - tableConfig.fontSize) / 2,
        { width: column.width, align: "center" }
      );
      headerX += column.width;
    });
    yPos += tableConfig.headerHeight;

    // Table data
    ranges.forEach((rangeLabel, rangeIndex) => {
      if (rangeIndex % 2 === 0) {
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
      let rowX = startX;

      // First column: temperature range
      doc.text(
        rangeLabel,
        rowX,
        yPos + (tableConfig.rowHeight - tableConfig.fontSize) / 2,
        { width: tableConfig.columns[0].width, align: "center" }
      );
      rowX += tableConfig.columns[0].width;

      // Data columns: percentages for each day
      dayNames.forEach((dayName) => {
        const dayData = distribution.get(dayName);
        const value = dayData ? Math.round(dayData[rangeIndex].percentage) : 0;
        doc.text(
          value.toString(),
          rowX,
          yPos + (tableConfig.rowHeight - tableConfig.fontSize) / 2,
          { width: tableConfig.columns[1].width, align: "center" }
        );
        rowX += tableConfig.columns[1].width;
      });

      yPos += tableConfig.rowHeight;
    });

    doc.y = yPos + 20;
  }

  async addDetailedValuesTable(doc, period, dataDate, tableX, tableY) {
    const tableConfig = {
      margin: { left: 50, right: 50 },
      rowHeight: 20,
      headerHeight: 32,
      fontSize: 9,
      columns: [
        { header: "Día", width: 70 },
        { header: "Temp Promedio\n(°C)", width: 70 },
        { header: "Temp Máxima\n(°C)", width: 70 },
        { header: "Temp Mínima\n(°C)", width: 70 },
      ],
    };

    const dayNames = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
      "Domingo",
    ];
    let yPos = tableY;
    const startX = tableX;

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
    Array.from(this.dailyAverages[period].keys())
      .sort((a, b) => a - b)
      .forEach((dayIndex, index) => {
        if (
          yPos + tableConfig.rowHeight >
          doc.page.height - doc.page.margins.bottom
        ) {
          doc.addPage();
          yPos = doc.page.margins.top;
        }

        const data = this.dailyAverages[period].get(dayIndex);
        const rowData = [
          dayNames[dayIndex - 1],
          data.count > 0 ? (data.sum / data.count).toFixed(2) : "NaN",
          data.max !== -Infinity ? data.max.toFixed(2) : "NaN",
          data.min !== Infinity ? data.min.toFixed(2) : "NaN",
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

module.exports = WeeklyTemperatureAnalyzer;

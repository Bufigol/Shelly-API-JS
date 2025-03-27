// src/utils/math_utils.js

// src/utils/math_utils.js - Modificado
function isDifferenceGreaterThan(
  currentValue,
  previousValue,
  thresholdMinutes
) {
  if (previousValue === null) return false;

  // Convertir ambos valores a objetos Date si no lo son ya
  const currentDate =
    currentValue instanceof Date ? currentValue : new Date(currentValue);
  const previousDate =
    previousValue instanceof Date ? previousValue : new Date(previousValue);

  // Calcular diferencia en minutos
  const diffInMilliseconds = Math.abs(currentDate - previousDate);
  const diffInMinutes = diffInMilliseconds / (1000 * 60);

  console.log(
    `Comparando timestamps: Actual=${currentDate.toISOString()}, Anterior=${previousDate.toISOString()}`
  );
  console.log(
    `Diferencia: ${diffInMinutes.toFixed(
      2
    )} minutos, Umbral: ${thresholdMinutes} minutos`
  );

  return diffInMinutes > thresholdMinutes;
}

module.exports = {
  isDifferenceGreaterThan,
};

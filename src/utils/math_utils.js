// src/utils/math_utils.js

function isDifferenceGreaterThan(currentValue, previousValue, threshold) {
  if (previousValue === null) return false;
  return Math.abs(currentValue - previousValue) > threshold;
}

module.exports = {
  isDifferenceGreaterThan,
};

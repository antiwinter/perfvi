/**
 * Interpolates between blue (0) and yellow (1) based on the general-dom value
 * @param value - A number between 0 and 1
 * @returns RGB color string
 */
export function interpolateColor(value: number): string {
  // Clamp value between 0 and 1
  const t = Math.max(0, Math.min(1, value));

  // Blue: rgb(0, 0, 255)
  // Yellow: rgb(255, 255, 0)
  const r = Math.round(255 * t);
  const g = Math.round(255 * t);
  const b = Math.round(255 * (1 - t));

  return `rgb(${r}, ${g}, ${b})`;
}

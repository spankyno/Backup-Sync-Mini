/** Formatea un porcentaje con un decimal, ej. 42.5%. */
export function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

/** Trunca una ruta larga de archivo dejando visible inicio y fin. */
export function truncatePath(path: string, maxLength = 48): string {
  if (path.length <= maxLength) return path;
  const half = Math.floor((maxLength - 3) / 2);
  return `${path.slice(0, half)}...${path.slice(-half)}`;
}

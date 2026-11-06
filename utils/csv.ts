/**
 * Exportación CSV 100% client-side: genera el archivo en memoria (Blob)
 * y dispara la descarga. Sin dependencias ni carga en el servidor.
 */

type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  const s = String(value ?? "");
  // Comillas, comas, puntos y coma o saltos de línea → envolver en comillas
  if (/[",;\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Descarga un CSV con BOM UTF-8 (para que Excel muestre bien los acentos).
 *
 * @param filename Nombre del archivo (se añade .csv si falta)
 * @param headers  Fila de encabezados
 * @param rows     Filas de datos
 * @param delimiter "," por defecto; ";" para que Excel en español separe las columnas
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
  delimiter: "," | ";" = ","
): void {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvValue).join(delimiter)
  );
  // BOM para que Excel detecte UTF-8
  const csv = "﻿" + lines.join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Fecha local YYYY-MM-DD para nombres de archivo. */
export function todayForFilename(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

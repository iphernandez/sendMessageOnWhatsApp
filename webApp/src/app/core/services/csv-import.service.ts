import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import { Player } from '../models/player.model';
import { WeeklyRecord } from '../models/weekly-record.model';
import { TdpCategory, TdpHistoryEntry, TdpWeights, DEFAULT_TDP_WEIGHTS } from '../models/tdp.model';
import { FfchData } from '../models/ffch-data.model';

export interface CsvImportResult {
  data: FfchData;
  warnings: string[];
}

const STATIC_COLUMNS = ['Galactico', 'Bullying', 'Posicion', 'TDP', 'Puntos', 'SedeTemporadaAnterior', 'PtsTemporadaAnterior'] as const;

const CATEGORY_LABELS: Record<string, TdpCategory> = {
  'año': 'anualidad',
  'ano': 'anualidad',
  'pre temporada': 'pretemporada',
  pretemporada: 'pretemporada',
  galas: 'gala',
  gala: 'gala',
  'socios fundadores': 'socioFundador',
  'socio fundador': 'socioFundador',
  'partido del pavo': 'partidoPavo',
  'partido pavo': 'partidoPavo',
  'afitrion gala': 'anfitrionGala',
  'anfitrion gala': 'anfitrionGala',
  'team building': 'teamBuilding'
};

const WEIGHT_ROW_LABELS: Record<string, TdpCategory> = {
  anualidad: 'anualidad',
  pretemporada: 'pretemporada',
  gala: 'gala',
  'socio fundador': 'socioFundador',
  'partido pavo': 'partidoPavo',
  'anfitrion gala': 'anfitrionGala',
  'afitrion gala': 'anfitrionGala'
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function toBoolean(cell: string | undefined): boolean {
  return (cell ?? '').trim() === '1';
}

function slugify(text: string): string {
  return (
    normalize(text)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'player'
  );
}

/** "18 December 2025" or "12/11/2025" -> "2025-12-18" / "2025-12-11" (ISO, yyyy-MM-dd). */
function parseFechaLabel(label: string): string | null {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, m, d, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Parses the two legacy Excel-exported CSVs (FFCH_Puntuacion/*.csv) into the app's
 * JSON schema. Column boundaries are discovered by header name/label search rather
 * than hardcoded indices, since the original spreadsheet's merged header cells shift
 * unpredictably once exported to plain CSV.
 */
@Injectable({ providedIn: 'root' })
export class CsvImportService {
  import(puntosCsvText: string, tdpCsvText: string): CsvImportResult {
    const warnings: string[] = [];
    const puntosRows = Papa.parse<string[]>(puntosCsvText, { skipEmptyLines: false }).data;
    const tdpRows = Papa.parse<string[]>(tdpCsvText, { skipEmptyLines: false }).data;

    const { players, weeklyRecords } = this.parsePuntosCsv(puntosRows, warnings);
    const { tdpHistory, weights, playerTdpPercent } = this.parseTdpCsv(tdpRows, players, warnings);

    // Prefer the TDP% already computed by the spreadsheet's VLOOKUP for players we
    // could not confidently reconstruct from raw category flags.
    for (const player of players) {
      if (!playerTdpPercent.has(player.galactico)) {
        warnings.push(`No se encontró TDP.csv para "${player.galactico}"; TDP se calculará desde 0.`);
      }
    }

    const data: FfchData = {
      players,
      weeklyRecords,
      tdpHistory,
      seasonConfig: {
        id: 'default',
        ptsTemporadaAnteriorIncludedInSum: true,
        weights
      },
      updatedAt: new Date().toISOString()
    };

    return { data, warnings };
  }

  private parsePuntosCsv(rows: string[][], warnings: string[]): { players: Player[]; weeklyRecords: WeeklyRecord[] } {
    const headerRowIndex = rows.findIndex((row) => row[0]?.trim() === 'Galactico');
    if (headerRowIndex < 1) {
      throw new Error('No se encontró la fila de encabezados ("Galactico") en el CSV de Puntos.');
    }
    const headerRow = rows[headerRowIndex];
    const fechaRow = rows[headerRowIndex - 1] ?? [];

    const staticIndex: Record<string, number> = {};
    for (const name of STATIC_COLUMNS) {
      const index = headerRow.findIndex((cell) => cell?.trim() === name);
      if (index === -1) {
        warnings.push(`No se encontró la columna estática "${name}" en el CSV de Puntos.`);
      }
      staticIndex[name] = index;
    }

    interface Block {
      fecha: string;
      colByName: Record<string, number>;
    }
    const blocks: Block[] = [];
    let current: Block | null = null;

    headerRow.forEach((cellRaw, col) => {
      const cell = cellRaw?.trim();
      if (!cell) return;
      if (cell === 'RSVP') {
        const fechaLabel = fechaRow[col]?.trim();
        const fecha = fechaLabel ? parseFechaLabel(fechaLabel) : null;
        if (!fecha) {
          warnings.push(`Fecha no reconocida en columna ${col} ("${fechaLabel ?? ''}"); se omite ese bloque semanal.`);
        }
        current = { fecha: fecha ?? `desconocida-col-${col}`, colByName: { RSVP: col } };
        blocks.push(current);
        return;
      }
      if (current && ['Jugo', 'Sede', 'Pts', 'Pago', 'Pago/Tarde', 'PtosFecha'].includes(cell)) {
        current.colByName[cell] = col;
      }
    });

    const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row[staticIndex['Galactico']]?.trim());

    const players: Player[] = [];
    const weeklyRecords: WeeklyRecord[] = [];
    const usedIds = new Set<string>();

    dataRows.forEach((row) => {
      const galactico = row[staticIndex['Galactico']].trim();
      let id = slugify(galactico);
      while (usedIds.has(id)) id += '-2';
      usedIds.add(id);

      const posicionRaw = row[staticIndex['Posicion']]?.trim();
      players.push({
        id,
        galactico,
        bullying: row[staticIndex['Bullying']]?.trim() ?? '',
        wanombre: '',
        wanumber: '',
        posicion: posicionRaw ? Number(posicionRaw) : players.length + 1,
        activo: true,
        cupoExPat: false,
        sedeTemporadaAnterior: toBoolean(row[staticIndex['SedeTemporadaAnterior']])
      });

      blocks.forEach((block, blockIndex) => {
        if (block.fecha.startsWith('desconocida-')) return;
        const get = (name: string) => (name in block.colByName ? row[block.colByName[name]]?.trim() : undefined);

        weeklyRecords.push({
          id: `${id}-${block.fecha}`,
          playerId: id,
          fecha: block.fecha,
          rsvp: get('RSVP') === undefined ? null : toBoolean(get('RSVP')),
          jugo: get('Jugo') === undefined ? null : toBoolean(get('Jugo')),
          sede: get('Sede') === undefined ? null : toBoolean(get('Sede')),
          // Blocks without a Pago/Pago-Tarde column predate payment tracking: assume no sanction.
          pago: 'Pago' in block.colByName ? toBoolean(get('Pago')) : 'Pago/Tarde' in block.colByName ? toBoolean(get('Pago/Tarde')) : true,
          // Historical CSVs merged Tarde into the Pago/Tarde column; cannot be reconstructed separately.
          tarde: null
        });
      });
    });

    return { players, weeklyRecords };
  }

  private parseTdpCsv(
    rows: string[][],
    players: Player[],
    warnings: string[]
  ): { tdpHistory: TdpHistoryEntry[]; weights: TdpWeights; playerTdpPercent: Map<string, number> } {
    const groupLabelRow = rows[0] ?? [];
    const headerRow = rows[1] ?? [];

    const labelColumns: Array<{ category: TdpCategory; startCol: number }> = [];
    groupLabelRow.forEach((cellRaw, col) => {
      const cell = normalize(cellRaw ?? '');
      if (!cell) return;
      const category = CATEGORY_LABELS[cell];
      if (category) {
        labelColumns.push({ category, startCol: col });
      } else {
        warnings.push(`Etiqueta de categoría TDP no reconocida: "${cellRaw}" (columna ${col}).`);
      }
    });

    const categoryColumns: Array<{ category: TdpCategory; col: number; year: number }> = [];
    labelColumns.forEach((label, i) => {
      const endCol = i + 1 < labelColumns.length ? labelColumns[i + 1].startCol : headerRow.length;
      for (let col = label.startCol; col < endCol; col++) {
        const yearMatch = headerRow[col]?.match(/(\d{4})/);
        if (yearMatch) {
          categoryColumns.push({ category: label.category, col, year: Number(yearMatch[1]) });
        }
      }
    });

    // Weight rows appear as plain "Nombre,Valor%" rows near the bottom of the sheet.
    const weights: TdpWeights = { ...DEFAULT_TDP_WEIGHTS };
    for (const row of rows) {
      const label = normalize(row[0] ?? '');
      const category = WEIGHT_ROW_LABELS[label];
      if (category) {
        const percentMatch = row[1]?.match(/([\d.]+)%/);
        if (percentMatch) {
          weights[category] = Number(percentMatch[1]) / 100;
        }
      }
    }
    // Team Building had no dedicated weight row historically; default to Anfitrion Gala's value.
    weights.teamBuilding = weights.teamBuilding ?? weights.anfitrionGala;

    const galacticoCol = 0;
    const tdpPercentCol = 2; // "Galactico,Bullying,TDP,..." per the source layout.

    const tdpHistory: TdpHistoryEntry[] = [];
    const playerTdpPercent = new Map<string, number>();

    rows.slice(2).forEach((row) => {
      const galactico = row[galacticoCol]?.trim();
      if (!galactico) return;
      const player = players.find((p) => normalize(p.galactico) === normalize(galactico));
      if (!player) {
        warnings.push(`Jugador "${galactico}" existe en TDP.csv pero no en Puntos.csv; se omite su historial.`);
        return;
      }

      const percentMatch = row[tdpPercentCol]?.match(/([\d.]+)%/);
      if (percentMatch) {
        playerTdpPercent.set(galactico, Number(percentMatch[1]) / 100);
      }

      categoryColumns.forEach(({ category, col, year }) => {
        tdpHistory.push({
          id: `${player.id}-${category}-${year}`,
          playerId: player.id,
          category,
          year,
          participated: toBoolean(row[col])
        });
      });
    });

    return { tdpHistory, weights, playerTdpPercent };
  }
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CsvImportService } from './csv-import.service';
import { ScoringService } from './scoring.service';

// Runs the importer against the actual source-of-truth CSVs in FFCH_Puntuacion/ (not a synthetic
// fixture) and cross-checks every player's computed TDP against the percentage the original
// spreadsheet displays, to catch regressions the Rafa-only unit test wouldn't (e.g. players with
// gaps, the "Socio Fundador" single-flag column, or the trailing Pesos/Reglas/legend rows below
// the player rows being mistaken for unmatched players).
describe('CsvImportService against the real FFCH_Puntuacion CSVs', () => {
  const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../FFCH_Puntuacion');
  const puntosCsv = readFileSync(resolve(dataDir, 'FFCH - Puntuacion - 2026 Puntos.csv'), 'utf8');
  const tdpCsv = readFileSync(resolve(dataDir, 'FFCH - Puntuacion - TDP.csv'), 'utf8');

  it('imports every player from the CSV with no unmatched-player warnings', () => {
    const { data, warnings } = new CsvImportService().import(puntosCsv, tdpCsv);

    expect(data.players.length).toBeGreaterThan(0);
    expect(warnings.filter((w) => w.includes('existe en TDP.csv pero no en Puntos.csv'))).toEqual([]);
  });

  it("computes each player's TDP% matching the value displayed in FFCH - Puntuacion - TDP.csv", () => {
    const scoring = new ScoringService();
    const { data } = new CsvImportService().import(puntosCsv, tdpCsv);

    const displayedTdpByPlayer = extractDisplayedTdp(tdpCsv);
    const mismatches: string[] = [];

    for (const player of data.players) {
      const displayed = displayedTdpByPlayer.get(player.galactico);
      if (displayed === undefined) continue; // player not present in TDP.csv - nothing to compare.

      const computed = scoring.computeTdp(
        data.tdpHistory.filter((h) => h.playerId === player.id),
        data.seasonConfig.weights,
        player.socioFundador
      );

      if (Math.round(computed * 100) !== displayed) {
        mismatches.push(`${player.galactico}: calculado ${Math.round(computed * 100)}% vs mostrado ${displayed}%`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});

/** Ground truth reference, independent of CsvImportService: reads the displayed "TDP" column directly. */
function extractDisplayedTdp(csvText: string): Map<string, number> {
  const rows = csvText.split(/\r?\n/).map((line) => line.split(','));
  const headerRowIndex = rows.findIndex((r) => r[1]?.trim() === 'Bullying' && r[2]?.trim() === 'TDP');
  const map = new Map<string, number>();
  for (const row of rows.slice(headerRowIndex + 1)) {
    const galactico = row[0]?.trim();
    const percentMatch = row[2]?.match(/([\d.]+)%/);
    if (galactico && percentMatch) {
      map.set(galactico, Number(percentMatch[1]));
    }
  }
  return map;
}

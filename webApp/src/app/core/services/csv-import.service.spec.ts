import { CsvImportService } from './csv-import.service';
import { ScoringService } from './scoring.service';

// Verifies the TDP column mapping against a real row from "FFCH - Puntuacion - TDP.csv":
// Rafa participated in every single tracked year/category (all flags = 1) and the sheet
// displays TDP = 56%. With default weights (2%,1%,1%,2%,1%,1%,1%) and widths (16,9,8,1,2,2,2),
// where the width-1 "Socio Fundador" column is a single Player flag, not a per-year history entry:
// 16*2% + 9*1% + 8*1% + 1*2% + 2*1% + 1*1% + 2*1% = 56%.
describe('CsvImportService TDP column mapping', () => {
  const puntosCsv = [
    '',
    'Galactico,Bullying,wanumber,Posicion,TDP,Puntos,SedeTemporadaAnterior,PtsTemporadaAnterior',
    'Rafa,Tower!,13885662859483,1,56%,0,0,0'
  ].join('\n');

  function buildTdpCsv(flags: number[]): string {
    const years = [
      ...Array.from({ length: 16 }, (_, i) => 2025 - i), // Año: D:S
      ...['2026', '2025', '2024', '2023', '2022', '2021', '2019', '2018', '2017'], // Pretemporada: T:AB
      ...['2025', '2024', '2023', '2022', '2021', '2019', '2018', '2017'], // Galas: AC:AJ
      '', // AK: blank header, still real data (Socio Fundador)
      '2025',
      '2024', // AL:AM (Partido Pavo per the verified weight mapping)
      '2025',
      '2024', // AN:AO (Anfitrion Gala)
      '2026 - Timbers',
      '2025 - Timbers' // AP:AQ (Team Building)
    ];
    const header = ['Galactico', 'Bullying', 'TDP', ...years].join(',');
    const dataRow = ['Rafa', 'Tower!', '56%', ...flags.map(String)].join(',');
    return ['', header, dataRow].join('\n');
  }

  it('maps every TDP.csv column to the exact category the formula weights, matching the displayed 56%', () => {
    // Rafa's actual flags: Año/Pretemporada/Galas/AK/AL:AM all "1", but AN:AO = [1, 0] (one blank cell).
    const rafaFlags = [
      ...new Array(16).fill(1), // Año (D:S)
      ...new Array(9).fill(1), // Pretemporada (T:AB)
      ...new Array(8).fill(1), // Galas (AC:AJ)
      1, // AK (Socio Fundador)
      1,
      1, // AL:AM (Partido Pavo)
      1,
      0, // AN:AO (Anfitrion Gala) - Rafa's real row has a blank here
      1,
      1 // AP:AQ (Team Building)
    ];
    const { data, warnings } = new CsvImportService().import(puntosCsv, buildTdpCsv(rafaFlags));

    // Socio Fundador (AK) is no longer a tdpHistory entry - it's a single Player flag (39 = 40 - 1).
    expect(data.tdpHistory).toHaveLength(39);
    expect(data.tdpHistory.filter((h) => h.participated)).toHaveLength(38);
    expect(data.players[0].socioFundador).toBe(true);
    expect(data.players[0].wanumber).toBe('13885662859483');

    const tdp = new ScoringService().computeTdp(data.tdpHistory, data.seasonConfig.weights, data.players[0].socioFundador);
    expect(tdp).toBeCloseTo(0.56, 5);

    // Socio Fundador is read directly (no year needed), so this fully-populated fixture has no warnings.
    expect(warnings).toEqual([]);
  });
});

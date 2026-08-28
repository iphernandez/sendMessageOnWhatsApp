export type TdpCategory =
  | 'anualidad'
  | 'pretemporada'
  | 'gala'
  | 'socioFundador'
  | 'partidoPavo'
  | 'anfitrionGala'
  | 'teamBuilding';

/**
 * Categories tracked per-year (one flag per year, e.g. "Galas" has one column per year attended).
 * Excludes 'socioFundador', which is a single lifetime flag stored on Player instead (see player.model.ts).
 */
export type TdpHistoryCategory = Exclude<TdpCategory, 'socioFundador'>;

/** One yes/no historical participation flag for a player, category and year. */
export interface TdpHistoryEntry {
  id: string;
  playerId: string;
  category: TdpHistoryCategory;
  year: number;
  participated: boolean;
}

/** Weight (as a decimal fraction, e.g. 0.02 = 2%) applied to each TDP category when computing TDP%. */
export type TdpWeights = Record<TdpCategory, number>;

export const DEFAULT_TDP_WEIGHTS: TdpWeights = {
  anualidad: 0.02,
  pretemporada: 0.01,
  gala: 0.01,
  socioFundador: 0.02,
  partidoPavo: 0.01,
  anfitrionGala: 0.01,
  // Independent from anfitrionGala (the original spreadsheet formula reused that cell); same default value.
  teamBuilding: 0.01
};

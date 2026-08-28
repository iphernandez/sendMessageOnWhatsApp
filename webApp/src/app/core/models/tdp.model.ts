export type TdpCategory =
  | 'anualidad'
  | 'pretemporada'
  | 'gala'
  | 'socioFundador'
  | 'partidoPavo'
  | 'anfitrionGala'
  | 'teamBuilding';

/** One yes/no historical participation flag for a player, category and year. */
export interface TdpHistoryEntry {
  id: string;
  playerId: string;
  category: TdpCategory;
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

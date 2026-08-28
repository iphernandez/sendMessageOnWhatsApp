import { Player } from './player.model';
import { WeeklyRecord } from './weekly-record.model';
import { TdpHistoryEntry } from './tdp.model';
import { SeasonConfig } from './season-config.model';

/** Consolidated document persisted locally (IndexedDB) and synced to FFCH_Puntuacion/data/ffch-puntuacion.json */
export interface FfchData {
  players: Player[];
  weeklyRecords: WeeklyRecord[];
  tdpHistory: TdpHistoryEntry[];
  seasonConfig: SeasonConfig;
  updatedAt: string;
}

export function createEmptyFfchData(seasonConfig: SeasonConfig): FfchData {
  return {
    players: [],
    weeklyRecords: [],
    tdpHistory: [],
    seasonConfig,
    updatedAt: new Date().toISOString()
  };
}

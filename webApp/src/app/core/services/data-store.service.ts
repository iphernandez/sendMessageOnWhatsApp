import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Player } from '../models/player.model';
import { WeeklyRecord } from '../models/weekly-record.model';
import { TdpHistoryEntry } from '../models/tdp.model';
import { SeasonConfig } from '../models/season-config.model';
import { DEFAULT_TDP_WEIGHTS } from '../models/tdp.model';
import { FfchData } from '../models/ffch-data.model';

const SEASON_CONFIG_ID = 'default';

interface SettingEntry {
  key: string;
  value: string;
}

/**
 * Client-side database (IndexedDB via Dexie) - local cache/query engine for the shared FFCH data.
 * RemoteSyncService layers Firestore sync on top of it.
 */
@Injectable({ providedIn: 'root' })
export class DataStoreService extends Dexie {
  players!: Table<Player, string>;
  weeklyRecords!: Table<WeeklyRecord, string>;
  tdpHistory!: Table<TdpHistoryEntry, string>;
  seasonConfig!: Table<SeasonConfig, string>;
  settings!: Table<SettingEntry, string>;

  constructor() {
    super('ffch-puntuacion');
    this.version(1).stores({
      players: 'id, galactico, posicion, activo',
      weeklyRecords: 'id, playerId, fecha',
      tdpHistory: 'id, playerId, category, year',
      seasonConfig: 'id',
      settings: 'key'
    });
    // v2 added a local `users` table for accounts; superseded by Firebase Auth + Firestore, table left
    // unused (harmless leftover) rather than migrated, to avoid a destructive schema-deletion migration.
    this.version(2).stores({
      players: 'id, galactico, posicion, activo',
      weeklyRecords: 'id, playerId, fecha',
      tdpHistory: 'id, playerId, category, year',
      seasonConfig: 'id',
      settings: 'key',
      users: 'id, &email'
    });
  }

  /** Generic key/value entry in the local settings table, used e.g. to persist the logged-in user id. */
  async getSetting(key: string): Promise<string | null> {
    const entry = await this.settings.get(key);
    return entry?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.settings.put({ key, value });
  }

  async clearSetting(key: string): Promise<void> {
    await this.settings.delete(key);
  }

  async getSeasonConfig(): Promise<SeasonConfig> {
    const existing = await this.seasonConfig.get(SEASON_CONFIG_ID);
    if (existing) return existing;

    const defaults: SeasonConfig = {
      id: SEASON_CONFIG_ID,
      ptsTemporadaAnteriorIncludedInSum: true,
      weights: { ...DEFAULT_TDP_WEIGHTS }
    };
    await this.seasonConfig.put(defaults);
    return defaults;
  }

  async saveSeasonConfig(config: SeasonConfig): Promise<void> {
    await this.seasonConfig.put({ ...config, id: SEASON_CONFIG_ID });
  }

  async exportAll(): Promise<FfchData> {
    const [players, weeklyRecords, tdpHistory, seasonConfig] = await Promise.all([
      this.players.toArray(),
      this.weeklyRecords.toArray(),
      this.tdpHistory.toArray(),
      this.getSeasonConfig()
    ]);
    return { players, weeklyRecords, tdpHistory, seasonConfig, updatedAt: new Date().toISOString() };
  }

  async importAll(data: FfchData): Promise<void> {
    await this.transaction(
      'rw',
      [this.players, this.weeklyRecords, this.tdpHistory, this.seasonConfig],
      async () => {
        await Promise.all([
          this.players.clear(),
          this.weeklyRecords.clear(),
          this.tdpHistory.clear(),
          this.seasonConfig.clear()
        ]);
        await Promise.all([
          this.players.bulkAdd(data.players),
          this.weeklyRecords.bulkAdd(data.weeklyRecords),
          this.tdpHistory.bulkAdd(data.tdpHistory),
          this.seasonConfig.put({ ...data.seasonConfig, id: SEASON_CONFIG_ID })
        ]);
      }
    );
  }
}

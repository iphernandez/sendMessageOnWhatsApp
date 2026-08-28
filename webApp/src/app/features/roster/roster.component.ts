import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { Player } from '../../core/models/player.model';
import { TdpCategory, TdpHistoryEntry, TdpWeights } from '../../core/models/tdp.model';
import { SeasonConfig } from '../../core/models/season-config.model';

const CATEGORY_OPTIONS: Array<{ value: TdpCategory; label: string }> = [
  { value: 'anualidad', label: 'Año (Anualidad)' },
  { value: 'pretemporada', label: 'Pre temporada' },
  { value: 'gala', label: 'Gala' },
  { value: 'socioFundador', label: 'Socio Fundador' },
  { value: 'partidoPavo', label: 'Partido del Pavo' },
  { value: 'anfitrionGala', label: 'Anfitrión Gala' },
  { value: 'teamBuilding', label: 'Team Building' }
];

function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'player'
  );
}

@Component({
  selector: 'app-roster',
  imports: [FormsModule],
  templateUrl: './roster.component.html',
  styleUrl: './roster.component.scss'
})
export class RosterComponent {
  readonly categoryOptions = CATEGORY_OPTIONS;
  readonly players = signal<Player[]>([]);
  readonly seasonConfig = signal<SeasonConfig | null>(null);
  readonly selectedPlayerId = signal<string | null>(null);
  readonly selectedPlayerHistory = signal<TdpHistoryEntry[]>([]);

  readonly newPlayer: Partial<Player> = { activo: true, cupoExPat: false, sedeTemporadaAnterior: false };
  readonly newHistoryEntry: { category: TdpCategory; year: number; participated: boolean } = {
    category: 'anualidad',
    year: new Date().getFullYear(),
    participated: true
  };

  constructor(private readonly store: DataStoreService) {
    void this.load();
  }

  async load(): Promise<void> {
    const [players, seasonConfig] = await Promise.all([
      this.store.players.orderBy('posicion').toArray(),
      this.store.getSeasonConfig()
    ]);
    this.players.set(players);
    this.seasonConfig.set(seasonConfig);
  }

  async addPlayer(): Promise<void> {
    const galactico = this.newPlayer.galactico?.trim();
    if (!galactico) return;

    let id = slugify(galactico);
    const existingIds = new Set(this.players().map((p) => p.id));
    while (existingIds.has(id)) id += '-2';

    const player: Player = {
      id,
      galactico,
      bullying: this.newPlayer.bullying?.trim() ?? '',
      wanombre: this.newPlayer.wanombre?.trim() ?? '',
      wanumber: this.newPlayer.wanumber?.trim() ?? '',
      posicion: this.newPlayer.posicion ?? this.players().length + 1,
      activo: true,
      cupoExPat: !!this.newPlayer.cupoExPat,
      sedeTemporadaAnterior: !!this.newPlayer.sedeTemporadaAnterior
    };

    await this.store.players.add(player);
    this.newPlayer.galactico = '';
    this.newPlayer.bullying = '';
    this.newPlayer.wanombre = '';
    this.newPlayer.wanumber = '';
    this.newPlayer.posicion = undefined;
    this.newPlayer.cupoExPat = false;
    this.newPlayer.sedeTemporadaAnterior = false;
    await this.load();
  }

  async updatePlayer(player: Player): Promise<void> {
    await this.store.players.put(player);
  }

  async removePlayer(player: Player): Promise<void> {
    await this.store.players.delete(player.id);
    await this.store.weeklyRecords.where('playerId').equals(player.id).delete();
    await this.store.tdpHistory.where('playerId').equals(player.id).delete();
    if (this.selectedPlayerId() === player.id) this.selectedPlayerId.set(null);
    await this.load();
  }

  async saveWeights(weights: TdpWeights): Promise<void> {
    const config = this.seasonConfig();
    if (!config) return;
    await this.store.saveSeasonConfig({ ...config, weights });
    await this.load();
  }

  async saveIncludePtsTemporadaAnterior(included: boolean): Promise<void> {
    const config = this.seasonConfig();
    if (!config) return;
    await this.store.saveSeasonConfig({ ...config, ptsTemporadaAnteriorIncludedInSum: included });
    await this.load();
  }

  async selectPlayer(playerId: string): Promise<void> {
    this.selectedPlayerId.set(playerId);
    const history = await this.store.tdpHistory.where('playerId').equals(playerId).toArray();
    this.selectedPlayerHistory.set(history.sort((a, b) => a.category.localeCompare(b.category) || a.year - b.year));
  }

  async addHistoryEntry(): Promise<void> {
    const playerId = this.selectedPlayerId();
    if (!playerId) return;

    const entry: TdpHistoryEntry = {
      id: `${playerId}-${this.newHistoryEntry.category}-${this.newHistoryEntry.year}`,
      playerId,
      category: this.newHistoryEntry.category,
      year: this.newHistoryEntry.year,
      participated: this.newHistoryEntry.participated
    };
    await this.store.tdpHistory.put(entry);
    await this.selectPlayer(playerId);
  }

  async removeHistoryEntry(entry: TdpHistoryEntry): Promise<void> {
    await this.store.tdpHistory.delete(entry.id);
    await this.selectPlayer(entry.playerId);
  }

  categoryLabel(category: TdpCategory): string {
    return this.categoryOptions.find((c) => c.value === category)?.label ?? category;
  }
}

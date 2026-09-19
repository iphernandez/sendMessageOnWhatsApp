import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Player } from '../../core/models/player.model';
import { DataStoreService } from '../../core/services/data-store.service';
import { ScoringService } from '../../core/services/scoring.service';
import { TeamBalancerService, BalancedTeams, BalancerPlayer, TeamRestriction } from '../../core/services/team-balancer.service';

interface Candidate extends BalancerPlayer {
  selected: boolean;
}

interface TeamHistoryEntry {
  date: string;
  winner: 'teamA' | 'teamB';
  teamA: string[];
  teamB: string[];
}

@Component({
  selector: 'app-team-balancer',
  imports: [FormsModule],
  templateUrl: './team-balancer.component.html',
  styleUrl: './team-balancer.component.scss'
})
export class TeamBalancerComponent {
  readonly candidates = signal<Candidate[]>([]);
  readonly teams = signal<BalancedTeams | null>(null);
  readonly copyText = signal('');
  readonly pastTeams = signal<TeamHistoryEntry[]>([]);
  readonly lastWinner = signal<'teamA' | 'teamB' | null>(null);
  readonly restrictions = signal<TeamRestriction[]>([]);
  readonly restrictionAId = signal('');
  readonly restrictionBId = signal('');

  private playerMap = new Map<string, Player>();

  constructor(
    private readonly store: DataStoreService,
    private readonly scoring: ScoringService,
    private readonly balancer: TeamBalancerService
  ) {
    void this.load();
  }

  async load(): Promise<void> {
    const [allPlayers, weeklyRecords, tdpHistory, seasonConfig, storedWinner, storedHistory, storedRestrictions] = await Promise.all([
      this.store.players.toArray(),
      this.store.weeklyRecords.toArray(),
      this.store.tdpHistory.toArray(),
      this.store.getSeasonConfig(),
      this.store.getSetting('team-balancer:lastWinner'),
      this.store.getSetting('team-balancer:history'),
      this.store.getSetting('team-balancer:restrictions')
    ]);

    this.playerMap = new Map(allPlayers.map((player) => [player.id, player]));

    const activePlayers = allPlayers.filter((player) => player.activo).sort((a, b) => a.posicion - b.posicion);
    const maxPoints = activePlayers.reduce((max, player) => {
      const summary = this.scoring.summarizePlayer(
        player.id,
        weeklyRecords,
        tdpHistory,
        seasonConfig.weights,
        player.sedeTemporadaAnterior,
        seasonConfig.ptsTemporadaAnteriorIncludedInSum,
        player.socioFundador
      );
      return Math.max(max, summary.puntos);
    }, 0);

    const candidates: Candidate[] = activePlayers.map((player) => {
      const summary = this.scoring.summarizePlayer(
        player.id,
        weeklyRecords,
        tdpHistory,
        seasonConfig.weights,
        player.sedeTemporadaAnterior,
        seasonConfig.ptsTemporadaAnteriorIncludedInSum,
        player.socioFundador
      );

      const rating = player.rating ?? this.balancer.toRatingFromPoints(summary.puntos, maxPoints || 1);

      return {
        playerId: player.id,
        nombre: player.galactico,
        puntos: summary.puntos,
        rating,
        selected: false
      };
    });

    this.candidates.set(candidates);

    const winner = storedWinner === 'teamA' || storedWinner === 'teamB' ? storedWinner : null;
    this.lastWinner.set(winner);
    this.pastTeams.set(storedHistory ? (JSON.parse(storedHistory) as TeamHistoryEntry[]) : []);
    this.restrictions.set(storedRestrictions ? (JSON.parse(storedRestrictions) as TeamRestriction[]) : []);
  }

  buildTeams(): void {
    const selected = this.candidates().filter((c) => c.selected);
    const teams = this.balancer.balance(selected, this.restrictions());
    this.teams.set(teams);
    this.copyText.set(this.formatConvocados(teams));
  }

  async addRestriction(): Promise<void> {
    const playerAId = this.restrictionAId().trim();
    const playerBId = this.restrictionBId().trim();

    if (!playerAId || !playerBId || playerAId === playerBId) {
      return;
    }

    const exists = this.restrictions().some(
      (restriction) =>
        (restriction.playerAId === playerAId && restriction.playerBId === playerBId) ||
        (restriction.playerAId === playerBId && restriction.playerBId === playerAId)
    );

    if (exists) {
      return;
    }

    const next = [...this.restrictions(), { id: crypto.randomUUID(), playerAId, playerBId }];
    this.restrictions.set(next);
    await this.store.setSetting('team-balancer:restrictions', JSON.stringify(next));
    this.restrictionAId.set('');
    this.restrictionBId.set('');
  }

  async deleteRestriction(restrictionId: string): Promise<void> {
    const next = this.restrictions().filter((restriction) => restriction.id !== restrictionId);
    this.restrictions.set(next);
    await this.store.setSetting('team-balancer:restrictions', JSON.stringify(next));
  }

  async applyLastGameResult(winner: 'teamA' | 'teamB'): Promise<void> {
    const currentTeams = this.teams();
    if (!currentTeams) return;

    const teamAIds = currentTeams.teamA.players.map((p) => p.playerId);
    const teamBIds = currentTeams.teamB.players.map((p) => p.playerId);

    const nextCandidates = this.balancer.applyLastGameResult(
      this.candidates().filter((candidate) => candidate.selected),
      winner,
      teamAIds,
      teamBIds
    );

    const nextCandidatesById = new Map(nextCandidates.map((candidate) => [candidate.playerId, candidate]));
    const updatedCandidates = this.candidates().map((candidate) => {
      const next = nextCandidatesById.get(candidate.playerId);
      if (!next) {
        return candidate;
      }
      return { ...candidate, rating: next.rating };
    });

    this.candidates.set(updatedCandidates);

    for (const candidate of nextCandidates) {
      const persisted = this.playerMap.get(candidate.playerId);
      if (!persisted) continue;
      this.playerMap.set(candidate.playerId, { ...persisted, rating: candidate.rating });
    }

    await this.store.players.bulkPut(
      Array.from(this.playerMap.values()).map((player) => ({ ...player, rating: player.rating ?? 1 }))
    );

    this.lastWinner.set(winner);
    await this.store.setSetting('team-balancer:lastWinner', winner);

    const historyEntry: TeamHistoryEntry = {
      date: new Date().toISOString(),
      winner,
      teamA: teamAIds,
      teamB: teamBIds
    };

    const nextHistory = [historyEntry, ...this.pastTeams()];
    this.pastTeams.set(nextHistory.slice(0, 10));
    await this.store.setSetting('team-balancer:history', JSON.stringify(this.pastTeams()));
  }

  playerLabel(player: { nombre: string; playerId: string; wanumber?: string }): string {
    return player.wanumber ? `${player.nombre} (${player.wanumber})` : player.nombre;
  }

  private formatConvocados(teams: BalancedTeams): string {
    const format = (label: string, team: BalancedTeams['teamA']) => {
      const names = team.players.map((p) => `${p.nombre}(${p.rating.toFixed(0)})`).join(',\n');
      return `${label}\n${names}\nTOTAL ${team.total.toFixed(0)} | PROM ${team.promedio.toFixed(2)}`;
    };
    return `${format('🟧 EQUIPO A', teams.teamA)}\n\n${format('🔵 EQUIPO B', teams.teamB)}`;
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  }

  async copyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(this.copyText());
  }
}

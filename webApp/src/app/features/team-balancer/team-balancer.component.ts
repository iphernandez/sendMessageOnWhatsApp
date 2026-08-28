import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { ScoringService } from '../../core/services/scoring.service';
import { TeamBalancerService, BalancedTeams, BalancerPlayer } from '../../core/services/team-balancer.service';

interface Candidate extends BalancerPlayer {
  selected: boolean;
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

  constructor(
    private readonly store: DataStoreService,
    private readonly scoring: ScoringService,
    private readonly balancer: TeamBalancerService
  ) {
    void this.load();
  }

  async load(): Promise<void> {
    const [players, weeklyRecords, tdpHistory, seasonConfig] = await Promise.all([
      this.store.players.filter((p) => p.activo).sortBy('posicion'),
      this.store.weeklyRecords.toArray(),
      this.store.tdpHistory.toArray(),
      this.store.getSeasonConfig()
    ]);

    const candidates: Candidate[] = players.map((player) => {
      const summary = this.scoring.summarizePlayer(
        player.id,
        weeklyRecords,
        tdpHistory,
        seasonConfig.weights,
        player.sedeTemporadaAnterior,
        seasonConfig.ptsTemporadaAnteriorIncludedInSum,
        player.socioFundador
      );
      return { playerId: player.id, nombre: player.galactico, puntos: summary.puntos, selected: false };
    });
    this.candidates.set(candidates);
  }

  buildTeams(): void {
    const selected = this.candidates().filter((c) => c.selected);
    const teams = this.balancer.balance(selected);
    this.teams.set(teams);
    this.copyText.set(this.formatConvocados(teams));
  }

  private formatConvocados(teams: BalancedTeams): string {
    const format = (label: string, team: BalancedTeams['teamA']) => {
      const names = team.players.map((p) => `${p.nombre}(${p.puntos.toFixed(0)})`).join(',\n');
      return `${label}\n${names}\nTOTAL ${team.total.toFixed(0)} | PROM ${team.promedio.toFixed(2)}`;
    };
    return `${format('🟧 EQUIPO A', teams.teamA)}\n\n${format('🔵 EQUIPO B', teams.teamB)}`;
  }

  async copyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(this.copyText());
  }
}

import { Injectable } from '@angular/core';

export interface BalancerPlayer {
  playerId: string;
  nombre: string;
  puntos: number;
}

export interface BalancedTeam {
  players: BalancerPlayer[];
  total: number;
  promedio: number;
}

export interface BalancedTeams {
  teamA: BalancedTeam;
  teamB: BalancedTeam;
}

/**
 * Splits confirmed players into two balanced teams using a greedy "snake draft":
 * sort by Puntos desc, always assign the next player to whichever team currently
 * has the lower total. Mirrors the two-team/PROM format seen in convocados.md.
 * Callers can freely move players between the resulting teams afterwards (manual override).
 */
@Injectable({ providedIn: 'root' })
export class TeamBalancerService {
  balance(players: BalancerPlayer[]): BalancedTeams {
    const sorted = [...players].sort((a, b) => b.puntos - a.puntos);

    const teamAPlayers: BalancerPlayer[] = [];
    const teamBPlayers: BalancerPlayer[] = [];
    let totalA = 0;
    let totalB = 0;

    for (const player of sorted) {
      if (totalA <= totalB) {
        teamAPlayers.push(player);
        totalA += player.puntos;
      } else {
        teamBPlayers.push(player);
        totalB += player.puntos;
      }
    }

    return {
      teamA: this.toTeam(teamAPlayers),
      teamB: this.toTeam(teamBPlayers)
    };
  }

  private toTeam(players: BalancerPlayer[]): BalancedTeam {
    const total = players.reduce((sum, p) => sum + p.puntos, 0);
    const promedio = players.length ? total / players.length : 0;
    return { players, total, promedio };
  }
}

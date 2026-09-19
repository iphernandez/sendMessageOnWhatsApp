import { Injectable } from '@angular/core';

export interface BalancerPlayer {
  playerId: string;
  nombre: string;
  puntos: number;
  rating: number;
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

export interface TeamRestriction {
  id: string;
  playerAId: string;
  playerBId: string;
}

/**
 * Splits confirmed players into two balanced teams using a greedy "snake draft":
 * sort by rating desc, always assign the next player to whichever team currently
 * has the lower total. Mirrors the two-team/PROM format seen in convocados.md.
 * Callers can freely move players between the resulting teams afterwards (manual override).
 */
@Injectable({ providedIn: 'root' })
export class TeamBalancerService {
  toRatingFromPoints(points: number, maxPoints: number): number {
    if (!Number.isFinite(points)) return 1;
    if (maxPoints <= 0) return 1;

    const ratio = Math.max(0, points / maxPoints);
    const rawValue = ratio * 9 + 1;
    return this.clampRating(Math.floor(rawValue));
  }

  applyLastGameResult(
    players: BalancerPlayer[],
    winner: 'teamA' | 'teamB',
    teamAIds: string[],
    teamBIds: string[]
  ): BalancerPlayer[] {
    const teamASet = new Set(teamAIds);
    const teamBSet = new Set(teamBIds);

    return players.map((player) => {
      if (winner === 'teamA' && teamASet.has(player.playerId)) {
        return { ...player, rating: this.clampRating(player.rating + 1) };
      }

      if (winner === 'teamB' && teamBSet.has(player.playerId)) {
        return { ...player, rating: this.clampRating(player.rating + 1) };
      }

      if (winner === 'teamA' && teamBSet.has(player.playerId)) {
        return { ...player, rating: this.clampRating(player.rating - 1) };
      }

      if (winner === 'teamB' && teamASet.has(player.playerId)) {
        return { ...player, rating: this.clampRating(player.rating - 1) };
      }

      return player;
    });
  }

  balance(players: BalancerPlayer[], restrictions: TeamRestriction[] = []): BalancedTeams {
    const sorted = [...players].sort((a, b) => b.rating - a.rating);

    const teamAPlayers: BalancerPlayer[] = [];
    const teamBPlayers: BalancerPlayer[] = [];
    let totalA = 0;
    let totalB = 0;

    for (const player of sorted) {
      const preferredTeam = totalA <= totalB ? 'teamA' : 'teamB';
      const target = preferredTeam === 'teamA' ? teamAPlayers : teamBPlayers;
      const alternative = preferredTeam === 'teamA' ? teamBPlayers : teamAPlayers;

      const canUsePreferred = this.canAddPlayerToTeam(player.playerId, target, restrictions);
      const canUseAlternative = this.canAddPlayerToTeam(player.playerId, alternative, restrictions);

      if (canUsePreferred) {
        if (preferredTeam === 'teamA') {
          teamAPlayers.push(player);
          totalA += player.rating;
        } else {
          teamBPlayers.push(player);
          totalB += player.rating;
        }
      } else if (canUseAlternative) {
        if (preferredTeam === 'teamA') {
          teamBPlayers.push(player);
          totalB += player.rating;
        } else {
          teamAPlayers.push(player);
          totalA += player.rating;
        }
      } else {
        if (preferredTeam === 'teamA') {
          teamAPlayers.push(player);
          totalA += player.rating;
        } else {
          teamBPlayers.push(player);
          totalB += player.rating;
        }
      }
    }

    return {
      teamA: this.toTeam(teamAPlayers),
      teamB: this.toTeam(teamBPlayers)
    };
  }

  canAddPlayerToTeam(playerId: string, teamPlayers: BalancerPlayer[], restrictions: TeamRestriction[]): boolean {
    return !teamPlayers.some((member) => this.hasRestriction(playerId, member.playerId, restrictions));
  }

  hasRestriction(playerAId: string, playerBId: string, restrictions: TeamRestriction[]): boolean {
    return restrictions.some(
      (restriction) =>
        (restriction.playerAId === playerAId && restriction.playerBId === playerBId) ||
        (restriction.playerAId === playerBId && restriction.playerBId === playerAId)
    );
  }

  private clampRating(value: number): number {
    return Math.min(10, Math.max(1, Math.round(value)));
  }

  private toTeam(players: BalancerPlayer[]): BalancedTeam {
    const total = players.reduce((sum, p) => sum + p.rating, 0);
    const promedio = players.length ? total / players.length : 0;
    return { players, total, promedio };
  }
}

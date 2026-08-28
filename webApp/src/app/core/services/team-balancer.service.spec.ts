import { TeamBalancerService, BalancerPlayer } from './team-balancer.service';

describe('TeamBalancerService', () => {
  let service: TeamBalancerService;

  beforeEach(() => {
    service = new TeamBalancerService();
  });

  it('splits players into two teams with balanced totals via snake draft', () => {
    const players: BalancerPlayer[] = [
      { playerId: '1', nombre: 'A', puntos: 5 },
      { playerId: '2', nombre: 'B', puntos: 5 },
      { playerId: '3', nombre: 'C', puntos: 3 },
      { playerId: '4', nombre: 'D', puntos: 2 }
    ];

    const { teamA, teamB } = service.balance(players);

    expect(teamA.players.length + teamB.players.length).toBe(players.length);
    expect(Math.abs(teamA.total - teamB.total)).toBeLessThanOrEqual(3);
  });

  it('returns zeroed team stats when given no players', () => {
    const { teamA, teamB } = service.balance([]);
    expect(teamA.total).toBe(0);
    expect(teamA.promedio).toBe(0);
    expect(teamB.players).toEqual([]);
  });
});

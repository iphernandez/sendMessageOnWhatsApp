import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { ScoringService } from '../../core/services/scoring.service';
import { MessageTemplateService } from '../../core/services/message-template.service';

const DEFAULT_TEMPLATE = `Futbol \`{{DATE}} {{TIME}}\` -- *Convocatoria* -- _{{LOCATION}}_ ({{LOCATION_URL}})

_*LIGA {{SEASON_YEAR}} - TEMPORADA DE {{SEASON}}*_

_*FECHA {{WEEK_NUMBER}} *_

\`Por favor confirmar su asistencia en el chat.\`

- Número de jugadores con *Tarjeta Amarilla* por llegar tarde:

  \t_*{{YELLOW_CARDS_LATE}}*_

- Número de jugadores con *Tarjeta Roja* y suspensión del próximo partido por llegar tarde:

  \t_*{{RED_CARDS_LATE}}*_

- Número de jugadores con *Tarjeta Roja* y suspensión del próximo partido porque no han pagado:

  \t_*{{RED_CARDS_PAYMENT}}*_

*EN BASE A LA REGLA ESTOS JUGADORES PIERDEN SUS PUNTOS DE LA FECHA ANTERIOR Y _NO PODRÁN JUGAR LA FECHA INDICADA EN ESTA CONVOCATORIA*`;

@Component({
  selector: 'app-convocatoria',
  imports: [FormsModule],
  templateUrl: './convocatoria.component.html',
  styleUrl: './convocatoria.component.scss'
})
export class ConvocatoriaComponent {
  readonly fechas = signal<string[]>([]);
  readonly selectedFecha = signal<string>('');
  readonly template = signal(DEFAULT_TEMPLATE);
  readonly vars = signal({
    DATE: '',
    TIME: '7:00 PM',
    LOCATION: 'Coloso de Hillsboro',
    LOCATION_URL: '',
    SEASON: 'Invierno',
    SEASON_YEAR: new Date().getFullYear(),
    WEEK_NUMBER: 1
  });
  readonly cardCounts = signal({ yellow: 0, redLate: 0, redPayment: 0 });
  readonly rendered = signal('');

  constructor(
    private readonly store: DataStoreService,
    private readonly scoring: ScoringService,
    private readonly templates: MessageTemplateService
  ) {
    void this.loadFechas();
  }

  async loadFechas(): Promise<void> {
    const records = await this.store.weeklyRecords.toArray();
    const fechas = Array.from(new Set(records.map((r) => r.fecha))).sort();
    this.fechas.set(fechas);
    if (fechas.length) {
      this.selectedFecha.set(fechas[fechas.length - 1]);
      await this.recomputeCardCounts();
    }
  }

  async onFechaChange(fecha: string): Promise<void> {
    this.selectedFecha.set(fecha);
    await this.recomputeCardCounts();
  }

  async recomputeCardCounts(): Promise<void> {
    const fecha = this.selectedFecha();
    if (!fecha) return;

    const players = await this.store.players.filter((p) => p.activo).toArray();
    let yellow = 0;
    let redLate = 0;
    let redPayment = 0;

    for (const player of players) {
      const records = await this.store.weeklyRecords.where('playerId').equals(player.id).toArray();
      const scores = this.scoring.computeWeeklyScores(records);
      const score = scores.find((s) => s.fecha === fecha);
      if (!score) continue;
      const record = records.find((r) => r.fecha === fecha);
      if (score.tarjetaAmarilla) yellow += 1;
      if (score.tarjetaRoja && record?.pago === false) redPayment += 1;
      else if (score.tarjetaRoja) redLate += 1;
    }

    this.cardCounts.set({ yellow, redLate, redPayment });
  }

  render(): void {
    const v = this.vars();
    const counts = this.cardCounts();
    this.rendered.set(
      this.templates.render(this.template(), {
        ...v,
        YELLOW_CARDS_LATE: counts.yellow,
        RED_CARDS_LATE: counts.redLate,
        RED_CARDS_PAYMENT: counts.redPayment
      })
    );
  }

  async copyToClipboard(): Promise<void> {
    await navigator.clipboard.writeText(this.rendered());
  }
}

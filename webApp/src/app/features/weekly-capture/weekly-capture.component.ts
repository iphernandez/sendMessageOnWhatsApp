import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { Player } from '../../core/models/player.model';
import { WeeklyRecord } from '../../core/models/weekly-record.model';

interface CaptureRow {
  player: Player;
  record: WeeklyRecord;
}

@Component({
  selector: 'app-weekly-capture',
  imports: [FormsModule],
  templateUrl: './weekly-capture.component.html',
  styleUrl: './weekly-capture.component.scss'
})
export class WeeklyCaptureComponent {
  readonly fechas = signal<string[]>([]);
  readonly selectedFecha = signal<string>(this.today());
  readonly rows = signal<CaptureRow[]>([]);

  constructor(private readonly store: DataStoreService) {
    void this.loadFechas();
    void this.loadRows();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async loadFechas(): Promise<void> {
    const records = await this.store.weeklyRecords.toArray();
    const fechas = Array.from(new Set(records.map((r) => r.fecha))).sort();
    this.fechas.set(fechas);
  }

  async onFechaChange(fecha: string): Promise<void> {
    this.selectedFecha.set(fecha);
    await this.loadRows();
  }

  async loadRows(): Promise<void> {
    const fecha = this.selectedFecha();
    const players = await this.store.players.filter((p) => p.activo).sortBy('posicion');
    const existing = await this.store.weeklyRecords.where('fecha').equals(fecha).toArray();
    const byPlayer = new Map(existing.map((r) => [r.playerId, r]));

    const rows: CaptureRow[] = players.map((player) => ({
      player,
      record:
        byPlayer.get(player.id) ??
        ({ id: `${player.id}-${fecha}`, playerId: player.id, fecha, rsvp: null, jugo: null, sede: null, pago: true, tarde: false } as WeeklyRecord)
    }));
    this.rows.set(rows);
  }

  async saveRow(row: CaptureRow): Promise<void> {
    await this.store.weeklyRecords.put(row.record);
    await this.loadFechas();
  }

  async deleteRow(row: CaptureRow): Promise<void> {
    const confirmed = confirm(`¿Eliminar el registro de ${row.player.galactico} para ${this.selectedFecha()}? Esto también elimina cualquier cálculo derivado de ese registro.`);
    if (!confirmed) return;
    await this.store.weeklyRecords.delete(row.record.id);
    await this.loadFechas();
    await this.loadRows();
  }

  async createFecha(fecha: string): Promise<void> {
    if (!fecha) return;
    this.selectedFecha.set(fecha);
    await this.loadRows();
  }

  async deleteFecha(): Promise<void> {
    const fecha = this.selectedFecha();
    const confirmed = confirm(`¿Eliminar la captura completa de ${fecha} para todos los jugadores? Esto también elimina cualquier cálculo derivado de esos registros.`);
    if (!confirmed) return;
    await this.store.weeklyRecords.where('fecha').equals(fecha).delete();
    await this.loadFechas();
    await this.loadRows();
  }
}

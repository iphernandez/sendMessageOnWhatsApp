import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { RemoteSyncService } from '../../core/services/remote-sync.service';
import { CsvImportService } from '../../core/services/csv-import.service';
import { FfchData } from '../../core/models/ffch-data.model';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  readonly statusMessage = signal('');
  readonly lastVersion = signal<number | null>(null);
  readonly csvWarnings = signal<string[]>([]);

  constructor(
    private readonly store: DataStoreService,
    private readonly remoteSync: RemoteSyncService,
    private readonly csvImport: CsvImportService
  ) {}

  async pullFromFirestore(): Promise<void> {
    try {
      const remote = await this.remoteSync.pull();
      if (!remote) {
        this.statusMessage.set('Todavía no hay datos guardados en Firestore.');
        return;
      }
      await this.store.importAll(remote.data);
      this.lastVersion.set(remote.version);
      this.statusMessage.set('Datos sincronizados desde Firestore.');
    } catch (error) {
      this.statusMessage.set(this.errorMessage(error));
    }
  }

  async pushToFirestore(): Promise<void> {
    try {
      const remote = await this.remoteSync.pull();
      const expectedVersion = remote?.version ?? 0;
      const data = await this.store.exportAll();
      const newVersion = await this.remoteSync.push(data, expectedVersion);
      this.lastVersion.set(newVersion);
      this.statusMessage.set('Datos guardados en Firestore.');
    } catch (error) {
      this.statusMessage.set(this.errorMessage(error));
    }
  }

  async exportJson(): Promise<void> {
    const data = await this.store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ffch-puntuacion.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async importJsonFile(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text) as FfchData;
    await this.store.importAll(data);
    this.statusMessage.set('Datos importados desde archivo JSON.');
  }

  async importCsv(puntosInput: HTMLInputElement, tdpInput: HTMLInputElement): Promise<void> {
    const puntosFile = puntosInput.files?.[0];
    const tdpFile = tdpInput.files?.[0];
    if (!puntosFile || !tdpFile) {
      this.statusMessage.set('Selecciona ambos archivos CSV (Puntos y TDP).');
      return;
    }
    const [puntosText, tdpText] = await Promise.all([puntosFile.text(), tdpFile.text()]);
    const { data, warnings } = this.csvImport.import(puntosText, tdpText);
    this.csvWarnings.set(warnings);
    await this.store.importAll(data);
    this.statusMessage.set(`Importación CSV completa: ${data.players.length} jugadores, ${data.weeklyRecords.length} registros semanales.`);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Error desconocido.';
  }
}

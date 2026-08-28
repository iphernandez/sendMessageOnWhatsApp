import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataStoreService } from '../../core/services/data-store.service';
import { AdminSessionService } from '../../core/services/admin-session.service';
import { GithubSyncService } from '../../core/services/github-sync.service';
import { CsvImportService } from '../../core/services/csv-import.service';
import { FfchData } from '../../core/models/ffch-data.model';

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  readonly tokenInput = signal('');
  readonly statusMessage = signal('');
  readonly lastSha = signal<string | null>(null);
  readonly csvWarnings = signal<string[]>([]);

  constructor(
    readonly admin: AdminSessionService,
    private readonly store: DataStoreService,
    private readonly githubSync: GithubSyncService,
    private readonly csvImport: CsvImportService
  ) {}

  async saveToken(): Promise<void> {
    const token = this.tokenInput().trim();
    if (!token) return;
    await this.admin.setToken(token);
    this.tokenInput.set('');
    this.statusMessage.set('Token guardado localmente (IndexedDB).');
  }

  async forgetToken(): Promise<void> {
    await this.admin.clearToken();
    this.statusMessage.set('Token olvidado.');
  }

  async pullFromGithub(): Promise<void> {
    const token = await this.admin.getToken();
    if (!token) {
      this.statusMessage.set('Configura un token de GitHub primero.');
      return;
    }
    try {
      const { data, sha } = await this.githubSync.pull(token);
      await this.store.importAll(data);
      this.lastSha.set(sha);
      this.statusMessage.set('Datos sincronizados desde GitHub.');
    } catch (error) {
      this.statusMessage.set(this.errorMessage(error));
    }
  }

  async pushToGithub(): Promise<void> {
    const token = await this.admin.getToken();
    if (!token) {
      this.statusMessage.set('Configura un token de GitHub primero.');
      return;
    }
    try {
      const { sha: currentSha } = await this.githubSync.pull(token);
      const data = await this.store.exportAll();
      const newSha = await this.githubSync.push(token, data, currentSha);
      this.lastSha.set(newSha);
      this.statusMessage.set('Datos guardados en GitHub.');
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

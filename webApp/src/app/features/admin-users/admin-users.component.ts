import { Component, signal } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { PublicUser } from '../../core/models/user.model';

@Component({
  selector: 'app-admin-users',
  imports: [],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss'
})
export class AdminUsersComponent {
  readonly users = signal<PublicUser[]>([]);
  readonly loading = signal(true);
  readonly statusMessage = signal('');
  readonly statusIsError = signal(false);
  readonly tempPasswordFor = signal<{ userId: string; password: string } | null>(null);

  constructor(private readonly auth: AuthService) {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.users.set(await this.auth.listUsers());
    this.loading.set(false);
  }

  async toggleAdmin(user: PublicUser): Promise<void> {
    const result = await this.auth.setAdmin(user.id, !user.isAdmin);
    await this.reportAndReload(result);
  }

  async removeUser(user: PublicUser): Promise<void> {
    if (!confirm(`¿Eliminar la cuenta de ${user.name} (${user.email})? Esta acción no se puede deshacer.`)) return;
    const result = await this.auth.deleteUser(user.id);
    await this.reportAndReload(result);
  }

  async resetPassword(user: PublicUser): Promise<void> {
    this.tempPasswordFor.set(null);
    const result = await this.auth.adminResetPassword(user.id);
    this.statusIsError.set(!result.success);
    this.statusMessage.set(result.success ? '' : (result.message ?? 'No se pudo restablecer la contraseña.'));
    if (result.success && result.tempPassword) {
      this.tempPasswordFor.set({ userId: user.id, password: result.tempPassword });
    }
    await this.load();
  }

  private async reportAndReload(result: { success: boolean; message?: string }): Promise<void> {
    this.statusIsError.set(!result.success);
    this.statusMessage.set(result.success ? '' : (result.message ?? 'No se pudo completar la acción.'));
    await this.load();
  }
}

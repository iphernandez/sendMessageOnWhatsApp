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

  async toggleDisabled(user: PublicUser): Promise<void> {
    const action = user.disabled ? 'habilitar' : 'deshabilitar';
    if (!confirm(`¿Seguro que quieres ${action} la cuenta de ${user.name} (${user.email})?`)) return;
    const result = await this.auth.setDisabled(user.id, !user.disabled);
    await this.reportAndReload(result);
  }

  async resetPassword(user: PublicUser): Promise<void> {
    const result = await this.auth.adminSendResetEmail(user);
    this.statusIsError.set(!result.success);
    this.statusMessage.set(
      result.success
        ? `Se envió un correo de restablecimiento a ${user.email}.`
        : (result.message ?? 'No se pudo enviar el correo de restablecimiento.')
    );
  }

  private async reportAndReload(result: { success: boolean; message?: string }): Promise<void> {
    this.statusIsError.set(!result.success);
    this.statusMessage.set(result.success ? '' : (result.message ?? 'No se pudo completar la acción.'));
    await this.load();
  }
}

import { Injectable, signal } from '@angular/core';
import { DataStoreService } from './data-store.service';

/** Tracks whether a GitHub token is present locally, to gate write actions in admin pages. */
@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  readonly hasToken = signal(false);

  constructor(private readonly store: DataStoreService) {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const token = await this.store.getGithubToken();
    this.hasToken.set(!!token);
  }

  async setToken(token: string): Promise<void> {
    await this.store.setGithubToken(token);
    this.hasToken.set(true);
  }

  async clearToken(): Promise<void> {
    await this.store.clearGithubToken();
    this.hasToken.set(false);
  }

  getToken(): Promise<string | null> {
    return this.store.getGithubToken();
  }
}

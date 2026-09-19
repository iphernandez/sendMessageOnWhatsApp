import { Injectable } from '@angular/core';
import { FfchData } from '../models/ffch-data.model';

const OWNER = 'iphernandez';
const REPO = 'sendMessageOnWhatsApp';
const DATA_PATH = 'FFCH_Puntuacion/data/ffch-puntuacion.json';
const API_BASE = 'https://api.github.com';

export interface RemoteFile {
  data: FfchData;
  sha: string;
}

export class GithubSyncConflictError extends Error {
  constructor() {
    super('El archivo en GitHub cambió desde la última vez que se leyó. Vuelve a sincronizar antes de guardar.');
  }
}

/**
 * Reads/writes FFCH_Puntuacion/data/ffch-puntuacion.json directly from the browser
 * using a fine-grained Personal Access Token (Contents: Read and write, scoped to this repo only).
 * The token never leaves the browser except in HTTPS requests to api.github.com.
 */
@Injectable({ providedIn: 'root' })
export class GithubSyncService {
  async pull(token?: string): Promise<RemoteFile> {
    const response = await fetch(
      `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURI(DATA_PATH)}`,
      { headers: this.buildHeaders(token) }
    );

    if (!response.ok) {
      throw new Error(`No se pudo leer los datos de GitHub (HTTP ${response.status}).`);
    }

    const body = await response.json();
    const decoded = this.decodeBase64Utf8(body.content as string);
    return { data: JSON.parse(decoded) as FfchData, sha: body.sha as string };
  }

  async push(token: string, data: FfchData, previousSha: string): Promise<string> {
    const payload = {
      message: `chore(ffch-puntuacion): actualizar datos (${new Date().toISOString()})`,
      content: this.encodeBase64Utf8(JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2)),
      sha: previousSha
    };

    const response = await fetch(
      `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURI(DATA_PATH)}`,
      {
        method: 'PUT',
        headers: this.buildHeaders(token),
        body: JSON.stringify(payload)
      }
    );

    if (response.status === 409 || response.status === 422) {
      throw new GithubSyncConflictError();
    }
    if (!response.ok) {
      throw new Error(`No se pudo guardar los datos en GitHub (HTTP ${response.status}).`);
    }

    const body = await response.json();
    return body.content.sha as string;
  }

  private buildHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    if (token) {
      return {
        ...headers,
        Authorization: `Bearer ${token}`
      };
    }

    return headers;
  }

  private decodeBase64Utf8(base64: string): string {
    const binary = atob(base64.replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  private encodeBase64Utf8(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }
}

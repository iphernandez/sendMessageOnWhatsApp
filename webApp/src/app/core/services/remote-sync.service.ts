import { Injectable } from '@angular/core';
import { doc, getDoc, runTransaction } from 'firebase/firestore';
import { firestore } from './firebase';
import { FfchData } from '../models/ffch-data.model';

const DATA_DOC_PATH = 'data/ffch-puntuacion';

export interface RemoteFfchData {
  data: FfchData;
  version: number;
}

export class SyncConflictError extends Error {
  constructor() {
    super('Los datos cambiaron en Firestore desde la última vez que los leíste. Vuelve a sincronizar antes de guardar.');
  }
}

/**
 * Reads/writes the shared FFCH data (players/weeklyRecords/tdpHistory/seasonConfig) from a single
 * Firestore document. Read access is open to any signed-in user (dashboard is read-only for
 * non-admins); write access is restricted to admins via Firestore security rules, not by a token.
 */
@Injectable({ providedIn: 'root' })
export class RemoteSyncService {
  /** Returns null if no data has ever been pushed to Firestore yet. */
  async pull(): Promise<RemoteFfchData | null> {
    const snapshot = await getDoc(doc(firestore, DATA_DOC_PATH));
    if (!snapshot.exists()) return null;

    const raw = snapshot.data();
    const { version, ...data } = raw as FfchData & { version?: number };
    return { data: data as FfchData, version: version ?? 0 };
  }

  async push(data: FfchData, expectedVersion: number): Promise<number> {
    const ref = doc(firestore, DATA_DOC_PATH);
    return runTransaction(firestore, async (tx) => {
      const snapshot = await tx.get(ref);
      const currentVersion = snapshot.exists() ? ((snapshot.data()['version'] as number) ?? 0) : 0;
      if (currentVersion !== expectedVersion) {
        throw new SyncConflictError();
      }

      const nextVersion = currentVersion + 1;
      tx.set(ref, { ...data, updatedAt: new Date().toISOString(), version: nextVersion });
      return nextVersion;
    });
  }
}

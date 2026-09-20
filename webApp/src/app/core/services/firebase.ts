import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

/** Single shared Firebase app/auth/firestore instances for the whole SPA. */
const firebaseApp = initializeApp(environment.firebase);

export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);

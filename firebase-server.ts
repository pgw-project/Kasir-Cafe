import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  writeBatch,
  Firestore
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  Auth
} from 'firebase/auth';
import fs from 'fs';
import path from 'path';

// Load Firebase configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } else {
    console.warn('[Firebase Server] firebase-applet-config.json not found, using environment variables.');
  }
} catch (error) {
  console.error('[Firebase Server] Error reading firebase-applet-config.json:', error);
}

// Initialize Firebase Client SDK safely on the server-side
let firestore: Firestore | null = null;
let auth: Auth | null = null;

try {
  if (firebaseConfig && firebaseConfig.projectId) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    auth = getAuth(app);
    console.log('[Firebase Server] Client-side SDK initialized successfully on server-side.');
  } else {
    console.warn('[Firebase Server] Configuration not found or incomplete.');
  }
} catch (error) {
  console.error('[Firebase Server] Failed to initialize Firebase Client SDK on server:', error);
}

export { firestore, auth };

// Required Operation types for FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

/**
 * Standardized Firebase Skill Error Handler
 */
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
    },
    operationType,
    path
  };
  console.error('[Firestore Error]: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Dynamically authenticates the backend server using email/password provider.
 * If user does not exist, registers the system account dynamically.
 */
export async function authenticateServer() {
  if (!firestore || !auth) {
    console.warn('[Firebase Server] Skip server authentication: Auth/Firestore not initialized.');
    return;
  }

  const email = 'system@maissy.com';
  const password = 'systemPOSSecure2026!';

  try {
    console.log('[Firebase Server] Authenticating system server account...');
    await signInWithEmailAndPassword(auth, email, password);
    console.log('[Firebase Server] System account successfully authenticated on Firestore.');
  } catch (signInError: any) {
    if (signInError.code === 'auth/operation-not-allowed') {
      console.warn('[Firebase Server] Email/Password Sign-in provider is disabled in Firebase Console. Please enable the Email/Password provider under Authentication -> Sign-in method in the Firebase Console if you wish to enable server-side database synchronization, otherwise the app continues with local cache.');
    } else if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential' || signInError.code === 'auth/invalid-email') {
      console.log('[Firebase Server] System account not found. Registering system account programmatically...');
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('[Firebase Server] System account programmatically created and signed in.');
      } catch (createError: any) {
        if (createError.code === 'auth/operation-not-allowed') {
          console.warn('[Firebase Server] Email/Password Sign-in provider is disabled in Firebase Console. Please enable the Email/Password provider under Authentication -> Sign-in method in the Firebase Console if you wish to enable server-side database synchronization, otherwise the app continues with local cache.');
        } else {
          console.error('[Firebase Server] Failed to create system account (make sure Email/Password Auth is enabled in Console):', createError.message);
        }
      }
    } else {
      console.error('[Firebase Server] Authentication failed:', signInError.message);
    }
  }
}

/**
 * Loads all data from Firestore collections with a fast-failing timeout.
 * Returns null if the collections are empty or unreachable, so we can fallback to local data or seed initial data.
 */
export async function loadFromFirestore() {
  if (!firestore) {
    console.warn('[Firestore] Firestore is not initialized. Skipping cloud fetch (local database mode)...');
    return null;
  }

  // Ensure authenticated before calling load
  await authenticateServer().catch(err => {
    console.error('[Firestore] Pre-load server authentication failed:', err);
  });
  
  console.log('[Firestore] Fetching data from cloud Firestore using client-side credentials...');
  
  const fetchPromise = async () => {
    const collections = ['users', 'menus', 'transactions', 'transaction_details', 'activity_log'];
    const result: any = {};
    let totalDocs = 0;

    for (const col of collections) {
      let snapshot;
      try {
        snapshot = await getDocs(collection(firestore!, col));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, col);
      }

      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      result[col] = list;
      totalDocs += list.length;
      console.log(`[Firestore] Loaded ${list.length} items from collection '${col}'`);
    }

    // Load settings
    let settingsDoc;
    try {
      settingsDoc = await getDoc(doc(firestore!, 'settings', 'global'));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    }

    if (settingsDoc.exists()) {
      result['settings'] = settingsDoc.data();
      totalDocs++;
      console.log('[Firestore] Loaded settings from cloud.');
    } else {
      result['settings'] = null;
    }

    if (totalDocs === 0) {
      console.log('[Firestore] Cloud database is empty.');
      return null;
    }

    return result;
  };

  try {
    // 6 seconds timeout limit to prevent blocking server startup
    return await Promise.race([
      fetchPromise(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore connection timeout (6s)')), 6000)
      )
    ]);
  } catch (error) {
    console.error('[Firestore] Error loading from Firestore (falling back):', error);
    return null;
  }
}

/**
 * Recursively cleans undefined values and replaces them with null (or strips them)
 * to prevent Firestore "Cannot serialize undefined value" exceptions.
 */
function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

/**
 * Synchronizes an in-memory collection with Firestore by adding/updating current items and deleting orphans.
 */
export async function syncCollection(col: string, newItems: any[]) {
  if (!firestore) {
    console.warn(`[Firestore] Firestore is not initialized. Skipping sync of collection '${col}'`);
    return;
  }

  // Ensure authenticated before calling write operation
  await authenticateServer().catch(err => {
    console.error(`[Firestore] Pre-sync server authentication failed for collection '${col}':`, err);
  });
  
  try {
    if (col === 'settings') {
      const cleanedSettings = cleanUndefined(newItems);
      try {
        await setDoc(doc(firestore, 'settings', 'global'), cleanedSettings);
        console.log('[Firestore] Settings synced to cloud.');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'settings/global');
      }
      return;
    }

    const idKey = col === 'users' ? 'ID_User' :
                  col === 'menus' ? 'ID_Menu' :
                  col === 'transactions' ? 'ID_Transaksi' :
                  col === 'transaction_details' ? 'ID_Detail' :
                  col === 'activity_log' ? 'Timestamp' :
                  'ID_Log';

    // 1. Get existing docs in Firestore for this collection
    let snapshot;
    try {
      snapshot = await getDocs(collection(firestore, col));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, col);
    }

    const existingIds = new Set<string>();
    snapshot.forEach(doc => {
      existingIds.add(doc.id);
    });

    const newItemsIds = new Set(newItems.map(item => item[idKey]).filter(Boolean));

    let batch = writeBatch(firestore);
    let opCount = 0;

    // 2. Find orphaned docs in Firestore and delete them
    for (const id of existingIds) {
      if (!newItemsIds.has(id)) {
        batch.delete(doc(firestore, col, id));
        opCount++;
        if (opCount >= 400) {
          try {
            await batch.commit();
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, col);
          }
          batch = writeBatch(firestore);
          opCount = 0;
        }
      }
    }

    // 3. Set or update all active items
    for (const item of newItems) {
      const id = item[idKey] || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const cleanedItem = cleanUndefined(item);
      batch.set(doc(firestore, col, id), cleanedItem);
      opCount++;
      if (opCount >= 400) {
        try {
          await batch.commit();
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, col);
        }
        batch = writeBatch(firestore);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      try {
        await batch.commit();
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, col);
      }
    }
    console.log(`[Firestore] Collection '${col}' successfully synced (items count: ${newItems.length}).`);
  } catch (error) {
    console.error(`[Firestore] Error syncing collection '${col}':`, error);
  }
}

/**
 * Syncs the entire database object to Firestore in parallel batches.
 */
export async function syncFullDatabase(db: any) {
  if (!firestore) {
    console.warn('[Firestore] Firestore is not initialized. Skipping full database sync...');
    return;
  }

  // Ensure authenticated before calling sync
  await authenticateServer().catch(err => {
    console.error('[Firestore] Pre-sync-all server authentication failed:', err);
  });
  
  console.log('[Firestore] Syncing full database to cloud...');
  const promises = [
    syncCollection('users', db.users || []),
    syncCollection('menus', db.menus || []),
    syncCollection('transactions', db.transactions || []),
    syncCollection('transaction_details', db.transaction_details || []),
    syncCollection('activity_log', db.activity_log || []),
    syncCollection('settings', db.settings || {}),
  ];
  await Promise.all(promises);
  console.log('[Firestore] Full database sync complete.');
}

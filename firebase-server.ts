import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Load Firebase configuration
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (error) {
  console.error('Error reading firebase-applet-config.json:', error);
}

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

// Get reference to Firestore database instance
export const firestore = getFirestore(firebaseConfig.firestoreDatabaseId);

/**
 * Loads all data from Firestore collections.
 * Returns null if the collections are empty so we can fallback to local data or seed initial data.
 */
export async function loadFromFirestore() {
  console.log('[Firestore] Fetching data from cloud Firestore...');
  try {
    const collections = ['users', 'menus', 'transactions', 'transaction_details', 'activity_log'];
    const result: any = {};
    let totalDocs = 0;

    for (const col of collections) {
      const snapshot = await firestore.collection(col).get();
      const list: any[] = [];
      snapshot.forEach(doc => {
        list.push(doc.data());
      });
      result[col] = list;
      totalDocs += list.length;
      console.log(`[Firestore] Loaded ${list.length} items from collection '${col}'`);
    }

    // Load settings
    const settingsDoc = await firestore.collection('settings').doc('global').get();
    if (settingsDoc.exists) {
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
  } catch (error) {
    console.error('[Firestore] Error loading from Firestore:', error);
    return null;
  }
}

/**
 * Synchronizes an in-memory collection with Firestore by adding/updating current items and deleting orphans.
 */
export async function syncCollection(col: string, newItems: any[]) {
  try {
    if (col === 'settings') {
      await firestore.collection('settings').doc('global').set(newItems);
      console.log('[Firestore] Settings synced to cloud.');
      return;
    }

    const idKey = col === 'users' ? 'ID_User' :
                  col === 'menus' ? 'ID_Menu' :
                  col === 'transactions' ? 'ID_Transaction' :
                  col === 'transaction_details' ? 'ID_Detail' :
                  'ID_Log';

    // 1. Get existing docs in Firestore for this collection
    const snapshot = await firestore.collection(col).get();
    const existingIds = new Set<string>();
    snapshot.forEach(doc => {
      existingIds.add(doc.id);
    });

    const newItemsIds = new Set(newItems.map(item => item[idKey]).filter(Boolean));

    let batch = firestore.batch();
    let opCount = 0;

    // 2. Find orphaned docs in Firestore and delete them
    for (const id of existingIds) {
      if (!newItemsIds.has(id)) {
        batch.delete(firestore.collection(col).doc(id));
        opCount++;
        if (opCount >= 400) {
          await batch.commit();
          batch = firestore.batch();
          opCount = 0;
        }
      }
    }

    // 3. Set or update all active items
    for (const item of newItems) {
      const id = item[idKey] || `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      batch.set(firestore.collection(col).doc(id), item);
      opCount++;
      if (opCount >= 400) {
        await batch.commit();
        batch = firestore.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
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

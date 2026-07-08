import { initializeApp, getApps } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { User, Menu, Transaction, TransactionDetail, ActivityLog, Settings } from '../types';
import dbData from '../../database.json';

// Safe check to avoid initialization issues
let db: any = null;
try {
  if (firebaseConfig && firebaseConfig.projectId) {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
    console.log('[Firebase Client] Client-side SDK initialized successfully.');
  } else {
    console.warn('[Firebase Client] Configuration not found or incomplete.');
  }
} catch (e) {
  console.error('[Firebase Client] Initialization error:', e);
}

export { db };

// Helper to manage high-fidelity LocalStorage database
const getLocalDb = () => {
  const collections = ['users', 'menus', 'transactions', 'transaction_details', 'activity_log', 'settings'];
  let dbInitialized = true;
  for (const col of collections) {
    if (!localStorage.getItem(`pos_${col}`)) {
      dbInitialized = false;
      break;
    }
  }

  if (!dbInitialized) {
    console.log('[Local DB] Initializing localStorage database from database.json...');
    try {
      localStorage.setItem('pos_users', JSON.stringify(dbData.users || []));
      localStorage.setItem('pos_menus', JSON.stringify(dbData.menus || []));
      localStorage.setItem('pos_transactions', JSON.stringify(dbData.transactions || []));
      localStorage.setItem('pos_transaction_details', JSON.stringify(dbData.transaction_details || []));
      localStorage.setItem('pos_activity_log', JSON.stringify(dbData.activity_log || []));
      localStorage.setItem('pos_settings', JSON.stringify(dbData.settings || {}));
    } catch (e) {
      console.error('[Local DB] Error seeding localStorage:', e);
    }
  } else {
    // Retrofitting check: Ensure cafes list and creator user are present in existing localStorage
    try {
      const settingsRaw = localStorage.getItem('pos_settings');
      if (settingsRaw) {
        const settings = JSON.parse(settingsRaw);
        if (!settings.cafes || settings.cafes.length === 0) {
          console.log('[Local DB] Retrofitting cafes in localStorage settings...');
          settings.cafes = dbData.settings?.cafes || [
            {
              id: 'cafe-maissy-coffee',
              namaToko: settings.namaToko || 'Kafe Maissy Coffee',
              alamat: settings.alamat || 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
              telepon: settings.telepon || '0812-3456-7890',
              pesanFooter: settings.pesanFooter || 'Terima kasih telah berkunjung ke Maissy Coffee!',
              Created_At: new Date().toISOString()
            }
          ];
          if (!settings.activeCafeId) {
            settings.activeCafeId = 'cafe-maissy-coffee';
          }
          localStorage.setItem('pos_settings', JSON.stringify(settings));
        }
      }

      const usersRaw = localStorage.getItem('pos_users');
      if (usersRaw) {
        const users = JSON.parse(usersRaw);
        const creatorEmail = 'asriantofistek015@gmail.com';
        const creatorExists = users.some((u: any) => u.Email && u.Email.toLowerCase() === creatorEmail.toLowerCase());
        if (!creatorExists) {
          console.log('[Local DB] Retrofitting creator user in localStorage users...');
          users.unshift({
            ID_User: 'USR-000',
            Nama: 'Asrianto (Creator)',
            Email: creatorEmail,
            Role: 'creator',
            Status: 'active',
            Password: 'admin123',
            Created_At: new Date().toISOString()
          });
          localStorage.setItem('pos_users', JSON.stringify(users));
        }
      }
    } catch (e) {
      console.error('[Local DB] Error retrofitting localStorage:', e);
    }
  }

  const dbInstance = {
    get: (col: string): any => {
      try {
        const val = localStorage.getItem(`pos_${col}`);
        return val ? JSON.parse(val) : (col === 'settings' ? {} : []);
      } catch (e) {
        return col === 'settings' ? {} : [];
      }
    },
    set: (col: string, data: any) => {
      try {
        localStorage.setItem(`pos_${col}`, JSON.stringify(data));
      } catch (e) {
        console.error(`[Local DB] Error saving ${col}:`, e);
      }
    }
  };

  if (typeof window !== 'undefined') {
    (window as any).__getLocalDbInstance = dbInstance;
  }

  return dbInstance;
};

// Seeding helper is bypassed on client to avoid "Missing or insufficient permissions"
async function ensureSeeded() {
  console.log('[Firebase Client] Client-side direct seeding bypassed. Initializing LocalStorage database on-demand.');
}

// Trigger lazy seeding check
ensureSeeded().catch(err => console.error('Error ensuring seeded:', err));

// --- CLIENT-SIDE REST ROUTER ---
// Replicates Express API logic using localStorage fallback
export const clientFirebaseRouter = {
  handleRequest: async (path: string, method: string, body: any): Promise<any> => {
    // Clean paths like `/api/users/123` to route parameters and strip query strings
    const cleanPath = path.replace(/^\/api/, '').split('?')[0];

    // 1. Auth: Login
    if (cleanPath === '/auth/login' && method === 'POST') {
      const { email, password } = body;
      const ldb = getLocalDb();
      const users: User[] = ldb.get('users');

      const user = users.find(u => u.Email.toLowerCase() === email.toLowerCase() && u.Status === 'active');
      if (!user) {
        return { ok: false, status: 401, data: { success: false, message: 'Email tidak terdaftar atau akun nonaktif' } };
      }
      if (user.Password !== password) {
        return { ok: false, status: 401, data: { success: false, message: 'Password salah' } };
      }

      // Add activity log
      const log: ActivityLog = {
        Timestamp: new Date().toISOString(),
        ID_User: user.ID_User,
        Nama_User: user.Nama,
        Action: 'LOGIN',
        Module: 'AUTH',
        Description: `Pengguna ${user.Nama} (${user.Role}) berhasil login (client-side local db).`,
      };
      const logs = ldb.get('activity_log');
      logs.push(log);
      ldb.set('activity_log', logs);

      const { Password, ...userProfile } = user;
      const mockToken = `token_${user.ID_User}_${Date.now()}`;
      return { ok: true, status: 200, data: { success: true, token: mockToken, user: userProfile } };
    }

    // 2. Auth: Register
    if (cleanPath === '/auth/register' && method === 'POST') {
      const { nama, email, password, role } = body;
      const ldb = getLocalDb();
      const users: User[] = ldb.get('users');

      const exists = users.some(u => u.Email.toLowerCase() === email.toLowerCase());
      if (exists) {
        return { ok: false, status: 400, data: { success: false, message: 'Email sudah terdaftar.' } };
      }

      const newUser: User = {
        ID_User: `usr_${Date.now()}`,
        Nama: nama,
        Email: email,
        Password: password,
        Role: role || 'kasir',
        Status: 'active',
        Created_At: new Date().toISOString()
      };

      users.push(newUser);
      ldb.set('users', users);

      // Add log
      const log: ActivityLog = {
        Timestamp: new Date().toISOString(),
        ID_User: newUser.ID_User,
        Nama_User: newUser.Nama,
        Action: 'REGISTER',
        Module: 'AUTH',
        Description: `Staf baru ${newUser.Nama} (${newUser.Role}) didaftarkan.`,
      };
      const logs = ldb.get('activity_log');
      logs.push(log);
      ldb.set('activity_log', logs);

      return { ok: true, status: 200, data: { success: true, user: newUser } };
    }

    // 3. Auth: Reset Password
    if (cleanPath === '/auth/reset-password' && method === 'POST') {
      const { email, newPassword } = body;
      const ldb = getLocalDb();
      const users: User[] = ldb.get('users');
      const idx = users.findIndex(u => u.Email.toLowerCase() === email.toLowerCase());

      if (idx === -1) {
        return { ok: false, status: 404, data: { success: false, message: 'Email tidak ditemukan.' } };
      }

      users[idx].Password = newPassword;
      ldb.set('users', users);

      return { ok: true, status: 200, data: { success: true, message: 'Kata sandi berhasil diperbarui.' } };
    }

    // 4. CRUD: Users
    if (cleanPath === '/users' && method === 'GET') {
      const ldb = getLocalDb();
      const users = ldb.get('users') || [];
      const urlObj = new URL(path, window.location.origin);
      const userIdParam = urlObj.searchParams.get('userId');
      if (userIdParam) {
        const currentUser = users.find((u: any) => u.ID_User === userIdParam);
        if (currentUser && currentUser.Role !== 'creator' && currentUser.cafeId) {
          return { ok: true, status: 200, data: users.filter((u: any) => u.cafeId === currentUser.cafeId) };
        }
      }
      return { ok: true, status: 200, data: users };
    }
    if (cleanPath === '/users' && method === 'POST') {
      const ldb = getLocalDb();
      const users = ldb.get('users');
      const newUser = { ...body, ID_User: body.ID_User || `usr_${Date.now()}` };
      users.push(newUser);
      ldb.set('users', users);
      return { ok: true, status: 200, data: { success: true, user: newUser } };
    }
    if (cleanPath.startsWith('/users/') && method === 'PUT') {
      const id = cleanPath.split('/')[2];
      const ldb = getLocalDb();
      const users = ldb.get('users');
      const idx = users.findIndex((u: any) => u.ID_User === id);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...body };
        ldb.set('users', users);
      }
      return { ok: true, status: 200, data: { success: true, user: body } };
    }
    if (cleanPath.startsWith('/users/') && method === 'DELETE') {
      const id = cleanPath.split('/')[2];
      const ldb = getLocalDb();
      const users = ldb.get('users');
      const filtered = users.filter((u: any) => u.ID_User !== id);
      ldb.set('users', filtered);
      return { ok: true, status: 200, data: { success: true } };
    }

    // 5. CRUD: Menus
    if (cleanPath === '/menus' && method === 'GET') {
      const ldb = getLocalDb();
      return { ok: true, status: 200, data: ldb.get('menus') };
    }
    if (cleanPath === '/menus' && method === 'POST') {
      const ldb = getLocalDb();
      const menus = ldb.get('menus');
      const newMenu = { ...body, ID_Menu: body.ID_Menu || `menu_${Date.now()}` };
      menus.push(newMenu);
      ldb.set('menus', menus);
      return { ok: true, status: 200, data: { success: true, menu: newMenu } };
    }
    if (cleanPath.startsWith('/menus/') && method === 'PUT') {
      const id = cleanPath.split('/')[2];
      const ldb = getLocalDb();
      const menus = ldb.get('menus');
      const idx = menus.findIndex((m: any) => m.ID_Menu === id);
      if (idx !== -1) {
        menus[idx] = { ...menus[idx], ...body };
        ldb.set('menus', menus);
      }
      return { ok: true, status: 200, data: { success: true, menu: body } };
    }
    if (cleanPath.startsWith('/menus/') && method === 'DELETE') {
      const id = cleanPath.split('/')[2];
      const ldb = getLocalDb();
      const menus = ldb.get('menus');
      const filtered = menus.filter((m: any) => m.ID_Menu !== id);
      ldb.set('menus', filtered);
      return { ok: true, status: 200, data: { success: true } };
    }

    // 6. CRUD: Settings & Cafes Fallback Router
    if (cleanPath === '/settings' && method === 'GET') {
      const ldb = getLocalDb();
      let settings = ldb.get('settings') || {};
      if (!settings || !settings.namaToko) {
        settings = {
          namaToko: 'Kafe Maissy Coffee',
          alamat: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
          telepon: '0812-3456-7890',
          pesanFooter: 'Terima kasih telah berkunjung ke Maissy Coffee!',
          googleSpreadsheetId: '1SHeYy5Vb1OaC9R_gTqC0y1-N4VzMaissySpreadsheetID',
          googleDriveFolderId: '1nXzPzQ2lqqaATvNybfTqcYU9lHc2DuG5',
          autoSync: true,
          cafes: [
            {
              id: 'cafe-maissy-coffee',
              namaToko: 'Kafe Maissy Coffee',
              alamat: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
              telepon: '0812-3456-7890',
              pesanFooter: 'Terima kasih telah berkunjung ke Maissy Coffee!',
              Created_At: new Date().toISOString()
            }
          ],
          activeCafeId: 'cafe-maissy-coffee'
        };
        ldb.set('settings', settings);
      }

      // Ensure cafes exists inside settings fallback
      if (!settings.cafes || settings.cafes.length === 0) {
        settings.cafes = [
          {
            id: 'cafe-maissy-coffee',
            namaToko: settings.namaToko || 'Kafe Maissy Coffee',
            alamat: settings.alamat || 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
            telepon: settings.telepon || '0812-3456-7890',
            pesanFooter: settings.pesanFooter || 'Terima kasih telah berkunjung ke Maissy Coffee!',
            Created_At: new Date().toISOString()
          }
        ];
        settings.activeCafeId = 'cafe-maissy-coffee';
        ldb.set('settings', settings);
      }

      let settingsResponse = { ...settings };

      // Apply cafe override if requester is not a creator and is assigned to a specific cafe
      try {
        const urlObj = new URL(path, 'http://localhost');
        const userId = urlObj.searchParams.get('userId');
        if (userId) {
          const users = ldb.get('users') || [];
          const user = users.find((u: any) => u.ID_User === userId);
          if (user && user.Role !== 'creator' && user.cafeId) {
            const userCafe = settings.cafes?.find((c: any) => c.id === user.cafeId);
            if (userCafe) {
              settingsResponse = {
                ...settingsResponse,
                namaToko: userCafe.namaToko,
                alamat: userCafe.alamat,
                telepon: userCafe.telepon,
                pesanFooter: userCafe.pesanFooter,
                logoUrl: userCafe.logoUrl,
              };
            }
          }
        }
      } catch (err) {
        console.error('Error parsing userId in client settings GET:', err);
      }

      return { ok: true, status: 200, data: settingsResponse };
    }

    if (cleanPath === '/settings' && method === 'PUT') {
      const ldb = getLocalDb();
      const settings = ldb.get('settings') || {};
      const users = ldb.get('users') || [];
      const { namaToko, alamat, telepon, pesanFooter, googleSpreadsheetId, googleDriveFolderId, autoSync, logoUrl, actorId } = body;

      const actor = users.find((u: any) => u.ID_User === actorId);

      if (actor && actor.Role !== 'creator' && actor.cafeId) {
        if (!settings.cafes) {
          settings.cafes = [];
        }
        const cafeIndex = settings.cafes.findIndex((c: any) => c.id === actor.cafeId);
        if (cafeIndex !== -1) {
          settings.cafes[cafeIndex] = {
            ...settings.cafes[cafeIndex],
            namaToko: namaToko || settings.cafes[cafeIndex].namaToko,
            alamat: alamat || settings.cafes[cafeIndex].alamat,
            telepon: telepon || settings.cafes[cafeIndex].telepon,
            pesanFooter: pesanFooter || settings.cafes[cafeIndex].pesanFooter,
            logoUrl: logoUrl !== undefined ? logoUrl : settings.cafes[cafeIndex].logoUrl,
          };
        }
      } else {
        // Creator updating global settings
        settings.namaToko = namaToko !== undefined ? namaToko : settings.namaToko;
        settings.alamat = alamat !== undefined ? alamat : settings.alamat;
        settings.telepon = telepon !== undefined ? telepon : settings.telepon;
        settings.pesanFooter = pesanFooter !== undefined ? pesanFooter : settings.pesanFooter;
        settings.googleSpreadsheetId = googleSpreadsheetId !== undefined ? googleSpreadsheetId : settings.googleSpreadsheetId;
        settings.googleDriveFolderId = googleDriveFolderId !== undefined ? googleDriveFolderId : settings.googleDriveFolderId;
        settings.autoSync = autoSync !== undefined ? autoSync : settings.autoSync;
        settings.logoUrl = logoUrl !== undefined ? logoUrl : settings.logoUrl;

        // Sync with active cafe entry
        if (settings.cafes && settings.activeCafeId) {
          const cafeIndex = settings.cafes.findIndex((c: any) => c.id === settings.activeCafeId);
          if (cafeIndex !== -1) {
            settings.cafes[cafeIndex] = {
              ...settings.cafes[cafeIndex],
              namaToko: settings.namaToko,
              alamat: settings.alamat,
              telepon: settings.telepon,
              pesanFooter: settings.pesanFooter,
              logoUrl: settings.logoUrl,
            };
          }
        }
      }

      ldb.set('settings', settings);
      return { ok: true, status: 200, data: settings };
    }

    if (cleanPath === '/cafes' && method === 'GET') {
      const ldb = getLocalDb();
      const settings = ldb.get('settings') || {};
      return { ok: true, status: 200, data: settings.cafes || [] };
    }

    if (cleanPath === '/cafes' && method === 'POST') {
      const ldb = getLocalDb();
      const settings = ldb.get('settings') || {};
      const users = ldb.get('users') || [];
      const { id, namaToko, alamat, telepon, pesanFooter, email, password, actorId } = body;

      const actor = users.find((u: any) => u.ID_User === actorId);
      if (!actor || actor.Role !== 'creator') {
        return { ok: false, status: 403, data: { success: false, message: 'Hanya pembuat aplikasi (Creator) yang dapat mendaftarkan kafe/warung baru.' } };
      }

      if (!id || !namaToko) {
        return { ok: false, status: 400, data: { success: false, message: 'ID dan Nama Kafe wajib diisi.' } };
      }

      if (!settings.cafes) {
        settings.cafes = [];
      }

      const normalizedId = id.toLowerCase().replace(/\s+/g, '-');
      if (settings.cafes.some((c: any) => c.id === normalizedId)) {
        return { ok: false, status: 400, data: { success: false, message: 'ID Kafe sudah terdaftar.' } };
      }

      const newCafe = {
        id: normalizedId,
        namaToko,
        alamat: alamat || '',
        telepon: telepon || '',
        pesanFooter: pesanFooter || 'Terima kasih telah berkunjung!',
        Created_At: new Date().toISOString()
      };

      settings.cafes.push(newCafe);

      if (settings.cafes.length === 1 || !settings.activeCafeId) {
        settings.activeCafeId = normalizedId;
        settings.namaToko = namaToko;
        settings.alamat = alamat || '';
        settings.telepon = telepon || '';
        settings.pesanFooter = pesanFooter || 'Terima kasih telah berkunjung!';
      }

      if (email) {
        const newAdminUser: User = {
          ID_User: `usr_admin_${Date.now()}`,
          Nama: `Admin ${namaToko}`,
          Email: email,
          Role: 'admin',
          Status: 'active',
          Password: password || '123456',
          Created_At: new Date().toISOString(),
          cafeId: normalizedId,
        };
        users.push(newAdminUser);
        ldb.set('users', users);
      }

      ldb.set('settings', settings);

      const logs = ldb.get('activity_log') || [];
      logs.unshift({
        Timestamp: new Date().toISOString(),
        ID_User: actorId,
        Nama_User: actor.Nama,
        Action: 'REGISTER_CAFE',
        Module: 'SETTINGS',
        Description: `Mendaftarkan kafe/warung baru: ${namaToko} (ID: ${normalizedId}) (client-side fallback)`,
      });
      ldb.set('activity_log', logs);

      return { ok: true, status: 200, data: { success: true, cafe: newCafe, cafes: settings.cafes } };
    }

    if (cleanPath === '/cafes/active' && method === 'PUT') {
      const ldb = getLocalDb();
      const settings = ldb.get('settings') || {};
      const users = ldb.get('users') || [];
      const { id, actorId } = body;

      const actor = users.find((u: any) => u.ID_User === actorId);
      if (!actor || actor.Role !== 'creator') {
        return { ok: false, status: 403, data: { success: false, message: 'Hanya pembuat aplikasi (Creator) yang dapat merubah kafe aktif.' } };
      }

      if (!settings.cafes) {
        settings.cafes = [];
      }

      const targetCafe = settings.cafes.find((c: any) => c.id === id);
      if (!targetCafe) {
        return { ok: false, status: 404, data: { success: false, message: 'Kafe tidak ditemukan.' } };
      }

      settings.activeCafeId = id;
      settings.namaToko = targetCafe.namaToko;
      settings.alamat = targetCafe.alamat;
      settings.telepon = targetCafe.telepon;
      settings.pesanFooter = targetCafe.pesanFooter;
      settings.logoUrl = targetCafe.logoUrl || '';

      ldb.set('settings', settings);

      const logs = ldb.get('activity_log') || [];
      logs.unshift({
        Timestamp: new Date().toISOString(),
        ID_User: actorId,
        Nama_User: actor.Nama,
        Action: 'SWITCH_ACTIVE_CAFE',
        Module: 'SETTINGS',
        Description: `Mengubah kafe aktif menjadi: ${targetCafe.namaToko} (ID: ${id}) (client-side fallback)`,
      });
      ldb.set('activity_log', logs);

      return { ok: true, status: 200, data: { success: true, activeCafeId: id, settings } };
    }

    if (cleanPath.startsWith('/cafes/') && !cleanPath.endsWith('/reset') && method === 'DELETE') {
      const parts = cleanPath.split('/');
      const id = parts[2];
      const ldb = getLocalDb();
      const settings = ldb.get('settings') || {};
      const users = ldb.get('users') || [];

      let actorId = '';
      try {
        const urlObj = new URL(path, 'http://localhost');
        actorId = urlObj.searchParams.get('actorId') || '';
      } catch (e) {}

      const actor = users.find((u: any) => u.ID_User === actorId);
      if (!actor || actor.Role !== 'creator') {
        return { ok: false, status: 403, data: { success: false, message: 'Hanya pembuat aplikasi (Creator) yang dapat menghapus kafe.' } };
      }

      if (!settings.cafes) {
        settings.cafes = [];
      }

      const cafeIndex = settings.cafes.findIndex((c: any) => c.id === id);
      if (cafeIndex === -1) {
        return { ok: false, status: 404, data: { success: false, message: 'Kafe tidak ditemukan.' } };
      }

      const targetCafe = settings.cafes[cafeIndex];
      if (settings.activeCafeId === id) {
        return { ok: false, status: 400, data: { success: false, message: 'Anda tidak dapat menghapus kafe yang sedang aktif!' } };
      }

      settings.cafes.splice(cafeIndex, 1);
      ldb.set('settings', settings);

      const logs = ldb.get('activity_log') || [];
      logs.unshift({
        Timestamp: new Date().toISOString(),
        ID_User: actorId,
        Nama_User: actor.Nama,
        Action: 'DELETE_CAFE',
        Module: 'SETTINGS',
        Description: `Menghapus kafe/warung: ${targetCafe.namaToko} (ID: ${id}) (client-side fallback)`,
      });
      ldb.set('activity_log', logs);

      return { ok: true, status: 200, data: { success: true, message: `Kafe ${targetCafe.namaToko} berhasil dihapus.`, cafes: settings.cafes } };
    }

    if (cleanPath.startsWith('/cafes/') && cleanPath.endsWith('/reset') && method === 'POST') {
      const parts = cleanPath.split('/');
      const id = parts[2];
      const ldb = getLocalDb();
      const settings = ldb.get('settings') || {};
      const transactions = ldb.get('transactions') || [];
      const details = ldb.get('transaction_details') || [];
      const users = ldb.get('users') || [];
      const { mode, actorId } = body;

      const actor = users.find((u: any) => u.ID_User === actorId);

      const targetCafe = settings.cafes?.find((c: any) => c.id === id);
      if (!targetCafe && id !== 'default' && id !== settings.activeCafeId) {
        return { ok: false, status: 404, data: { success: false, message: 'Outlet kafe tidak ditemukan.' } };
      }

      const remainingTx = transactions.filter((tx: any) => {
        const txCafeId = tx.cafeId || 'cafe-maissy-coffee';
        return txCafeId !== id;
      });

      const remainingTxIds = new Set(remainingTx.map((tx: any) => tx.ID_Transaksi));
      const remainingDetails = details.filter((det: any) => remainingTxIds.has(det.ID_Transaksi));

      ldb.set('transactions', remainingTx);
      ldb.set('transaction_details', remainingDetails);

      const isFactoryReset = mode === 'factory_reset';
      if (isFactoryReset) {
        if (targetCafe) {
          targetCafe.namaToko = 'Warung / Kafe Baru';
          targetCafe.alamat = 'Alamat Toko Default';
          targetCafe.telepon = '0812-0000-0000';
          targetCafe.pesanFooter = 'Terima kasih telah berkunjung!';
        }
        if (settings.activeCafeId === id) {
          settings.namaToko = 'Warung / Kafe Baru';
          settings.alamat = 'Alamat Toko Default';
          settings.telepon = '0812-0000-0000';
          settings.pesanFooter = 'Terima kasih telah berkunjung!';
        }
        ldb.set('settings', settings);
      }

      const logs = ldb.get('activity_log') || [];
      logs.unshift({
        Timestamp: new Date().toISOString(),
        ID_User: actorId || 'SYSTEM',
        Nama_User: actor ? actor.Nama : 'System',
        Action: isFactoryReset ? 'FACTORY_RESET_CAFE' : 'RESET_CAFE_DATA',
        Module: 'SETTINGS',
        Description: isFactoryReset
          ? `Melakukan KEMBALI KE SETELAN PABRIK untuk kafe: ${targetCafe ? targetCafe.namaToko : id} (client-side fallback)`
          : `Mereset dan menghapus semua data transaksi untuk kafe: ${targetCafe ? targetCafe.namaToko : id} (client-side fallback)`,
      });
      ldb.set('activity_log', logs);

      return {
        ok: true,
        status: 200,
        data: {
          success: true,
          message: isFactoryReset
            ? `Setelan pabrik untuk outlet berhasil dilakukan.`
            : `Semua data transaksi untuk outlet berhasil direset/dikosongkan.`
        }
      };
    }

    // 7. Activity Logs
    if (cleanPath === '/logs' && method === 'GET') {
      const ldb = getLocalDb();
      const list = ldb.get('activity_log');
      list.sort((a: any, b: any) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
      return { ok: true, status: 200, data: list };
    }

    // 8. Transactions
    if (cleanPath === '/transactions' && method === 'GET') {
      const ldb = getLocalDb();
      const transactions = ldb.get('transactions') || [];
      const details = ldb.get('transaction_details') || [];
      
      const urlObj = new URL(path, window.location.origin);
      const userIdParam = urlObj.searchParams.get('userId');
      
      const users = ldb.get('users') || [];
      let targetCafeId = ldb.get('settings')?.activeCafeId || 'cafe-maissy-coffee';
      if (userIdParam) {
        const currentUser = users.find((u: any) => u.ID_User === userIdParam);
        if (currentUser && currentUser.Role !== 'creator' && currentUser.cafeId) {
          targetCafeId = currentUser.cafeId;
        }
      }
      
      const filteredTransactions = transactions.filter((tx: any) => {
        const txCafeId = tx.cafeId || 'cafe-maissy-coffee';
        return txCafeId === targetCafeId;
      });
      
      filteredTransactions.sort((a: any, b: any) => new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime());
      
      const txIds = new Set(filteredTransactions.map((tx: any) => tx.ID_Transaksi));
      const filteredDetails = details.filter((dtl: any) => txIds.has(dtl.ID_Transaksi));
      
      return { ok: true, status: 200, data: { transactions: filteredTransactions, details: filteredDetails } };
    }
    if (cleanPath === '/transactions' && method === 'POST') {
      const ldb = getLocalDb();
      const transactions = ldb.get('transactions') || [];
      const transaction_details = ldb.get('transaction_details') || [];

      let finalTx: any;
      let finalDetails: any[] = [];

      // Handle the new format sent from POSView:
      // { namaPelanggan, items, bayar, kembali, cashierName, actorId, metodeBayar }
      if (body && body.items && Array.isArray(body.items)) {
        const { namaPelanggan, items, bayar, kembali, cashierName, actorId, metodeBayar } = body;

        // Generate Transaction ID (TRX-XXXXX)
        const nextTxNum = transactions.length > 0
          ? Math.max(...transactions.map((t: any) => {
              if (!t.ID_Transaksi) return 0;
              const parts = t.ID_Transaksi.split('-');
              return parts.length > 1 ? (parseInt(parts[1]) || 0) : 0;
            })) + 1
          : 1;
        const txId = `TRX-${String(nextTxNum).padStart(5, '0')}`;

        let totalItem = 0;
        let totalHarga = 0;

        finalDetails = items.map((item: any, idx: number) => {
          const subtotal = item.Harga * item.qty;
          totalItem += item.qty;
          totalHarga += subtotal;

          const dtlId = `DTL-${String(transaction_details.length + 1 + idx).padStart(6, '0')}`;

          return {
            ID_Detail: dtlId,
            ID_Transaksi: txId,
            ID_Menu: item.ID_Menu,
            Nama_Menu: item.Nama_Menu,
            Qty: item.qty,
            Harga_Satuan: item.Harga,
            Subtotal: subtotal,
          };
        });

        const users = ldb.get('users') || [];
        const actor = users.find((u: any) => u.ID_User === actorId) || { Nama: cashierName || 'Kasir' };

        finalTx = {
          ID_Transaksi: txId,
          Tanggal: new Date().toISOString(),
          Nama_Pelanggan: namaPelanggan,
          Total_Item: totalItem,
          Total_Harga: totalHarga,
          Bayar: Number(bayar),
          Kembali: Number(kembali),
          Kasir: cashierName || 'Kasir Maissy',
          PDF_URL: `/api/receipt/${txId}/print`,
          Status: 'Paid',
          Metode_Bayar: metodeBayar || 'TUNAI',
          cafeId: (actor as any).cafeId || ldb.get('settings')?.activeCafeId || 'cafe-maissy-coffee',
        };

        // Add log
        const logs = ldb.get('activity_log') || [];
        logs.unshift({
          Timestamp: new Date().toISOString(),
          ID_User: actorId || 'SYSTEM',
          Nama_User: actor.Nama,
          Action: 'CHECKOUT',
          Module: 'POS',
          Description: `Transaksi ${txId} berhasil dibuat untuk Pelanggan: ${namaPelanggan}. Total: Rp ${totalHarga.toLocaleString('id-ID')} (client-side local db)`,
        });
        ldb.set('activity_log', logs);

      } else {
        // Fallback to legacy format: { transaction, details }
        const { transaction, details } = body || {};
        const txId = transaction?.ID_Transaksi || `tx_${Date.now()}`;
        finalTx = { 
          ...transaction, 
          ID_Transaksi: txId,
          cafeId: transaction?.cafeId || ldb.get('settings')?.activeCafeId || 'cafe-maissy-coffee'
        };
        
        finalDetails = (details || []).map((det: any, idx: number) => {
          const detId = det.ID_Detail || `det_${Date.now()}_${idx}`;
          return { ...det, ID_Transaksi: txId, ID_Detail: detId };
        });
      }

      transactions.unshift(finalTx);
      ldb.set('transactions', transactions);

      transaction_details.push(...finalDetails);
      ldb.set('transaction_details', transaction_details);

      return { ok: true, status: 200, data: { success: true, transaction: finalTx, details: finalDetails } };
    }

    // 9. Analytics report
    if (cleanPath === '/reports/analytics' && method === 'GET') {
      const ldb = getLocalDb();
      const allTransactions: Transaction[] = ldb.get('transactions') || [];
      const allDetails: TransactionDetail[] = ldb.get('transaction_details') || [];
      const menus: Menu[] = ldb.get('menus') || [];

      const urlObj = new URL(path, window.location.origin);
      const userIdParam = urlObj.searchParams.get('userId');
      
      const users = ldb.get('users') || [];
      let targetCafeId = ldb.get('settings')?.activeCafeId || 'cafe-maissy-coffee';
      if (userIdParam) {
        const currentUser = users.find((u: any) => u.ID_User === userIdParam);
        if (currentUser && currentUser.Role !== 'creator' && currentUser.cafeId) {
          targetCafeId = currentUser.cafeId;
        }
      }

      // Filter transactions and details by cafeId
      const transactions = allTransactions.filter((tx: any) => {
        const txCafeId = tx.cafeId || 'cafe-maissy-coffee';
        return txCafeId === targetCafeId;
      });

      const txIds = new Set(transactions.map((tx: any) => tx.ID_Transaksi));
      const details = allDetails.filter((dtl: any) => txIds.has(dtl.ID_Transaksi));

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

      let todaySales = 0;
      let todayOrdersCount = 0;
      let yesterdaySales = 0;
      let totalSalesEver = 0;

      transactions.forEach((tx: any) => {
        const txDate = new Date(tx.Tanggal);
        const amt = tx.Total_Harga || 0;
        totalSalesEver += amt;

        if (txDate >= startOfToday) {
          todaySales += amt;
          todayOrdersCount++;
        } else if (txDate >= startOfYesterday && txDate < startOfToday) {
          yesterdaySales += amt;
        }
      });

      // Daily Sales for last 7 days
      const salesLast7Days: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateString = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        let dayTotal = 0;
        let dayCount = 0;
        
        transactions.forEach((tx: any) => {
          const txDate = new Date(tx.Tanggal);
          if (txDate >= dayStart && txDate < dayEnd) {
            dayTotal += tx.Total_Harga || 0;
            dayCount++;
          }
        });

        salesLast7Days.push({
          date: dateString,
          amount: dayTotal,
          count: dayCount,
        });
      }

      // Categories
      const categoryTotals: { [key: string]: number } = {};
      const itemSalesQuantities: { [key: string]: { name: string; qty: number; total: number } } = {};

      details.forEach((det: any) => {
        const matchingMenu = menus.find(m => m.ID_Menu === det.ID_Menu);
        const rawCategory = matchingMenu ? matchingMenu.Kategori : 'Lainnya';
        
        let category = rawCategory;
        const lower = rawCategory.toLowerCase();
        if (lower === 'coffee' || lower === 'non-coffee' || lower === 'minuman') {
          category = 'Minuman';
        } else if (lower === 'snacks' || lower === 'desserts' || lower === 'makanan') {
          category = 'Makanan';
        }

        categoryTotals[category] = (categoryTotals[category] || 0) + (det.Subtotal || 0);

        if (!itemSalesQuantities[det.ID_Menu]) {
          itemSalesQuantities[det.ID_Menu] = { name: det.Nama_Menu, qty: 0, total: 0 };
        }
        itemSalesQuantities[det.ID_Menu].qty += det.Qty || 0;
        itemSalesQuantities[det.ID_Menu].total += det.Subtotal || 0;
      });

      const categoryDistribution = Object.keys(categoryTotals).map(key => ({
        name: key,
        value: categoryTotals[key],
      }));

      const topSellingItems = Object.keys(itemSalesQuantities)
        .map(key => itemSalesQuantities[key])
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);

      // Today's best selling
      const todayItemSales: { [key: string]: { name: string; qty: number } } = {};
      const todayTxIds = transactions
        .filter((tx: any) => new Date(tx.Tanggal) >= startOfToday)
        .map((tx: any) => tx.ID_Transaksi);

      details.forEach((det: any) => {
        if (todayTxIds.includes(det.ID_Transaksi)) {
          if (!todayItemSales[det.ID_Menu]) {
            todayItemSales[det.ID_Menu] = { name: det.Nama_Menu, qty: 0 };
          }
          todayItemSales[det.ID_Menu].qty += det.Qty || 0;
        }
      });

      let todayBestItem = 'Tidak ada';
      let todayBestQty = 0;
      Object.keys(todayItemSales).forEach(key => {
        if (todayItemSales[key].qty > todayBestQty) {
          todayBestQty = todayItemSales[key].qty;
          todayBestItem = `${todayItemSales[key].name} (${todayBestQty} pcs)`;
        }
      });

      return {
        ok: true,
        status: 200,
        data: {
          summary: {
            todaySales,
            todayOrdersCount,
            yesterdaySales,
            totalSalesEver,
            salesGrowthPct: yesterdaySales > 0 ? ((todaySales - yesterdaySales) / yesterdaySales) * 100 : 0,
            todayBestItem,
          },
          salesLast7Days,
          categoryDistribution,
          topSellingItems,
        }
      };
    }

    // Default 404
    return { ok: false, status: 404, data: { success: false, message: 'Resource not found client-side' } };
  }
};

// --- CLIENT-SIDE RECEIPT GENERATOR ---
// Generates printable thermal layout dynamically in the browser
export function generateReceiptHtml(tx: Transaction, details: TransactionDetail[], settings: any, paperSize: string = '80'): string {
  let widthStyle = '80mm';
  let fontStyle = '12px';
  let paddingStyle = '5mm';

  if (paperSize === '58') {
    widthStyle = '58mm';
    fontStyle = '11px';
    paddingStyle = '2mm';
  } else if (paperSize === 'A4') {
    widthStyle = '190mm';
    fontStyle = '14px';
    paddingStyle = '15mm';
  }

  // Handle cafe settings fallback/override
  let activeSettings = { ...settings };
  if (tx.cafeId && settings.cafes) {
    const txCafe = settings.cafes.find((c: any) => c.id === tx.cafeId);
    if (txCafe) {
      activeSettings = {
        ...activeSettings,
        namaToko: txCafe.namaToko,
        alamat: txCafe.alamat,
        telepon: txCafe.telepon,
        pesanFooter: txCafe.pesanFooter,
      };
    }
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Struk Belanja ${tx.ID_Transaksi}</title>
      <style>
        body {
          font-family: 'Courier New', Courier, monospace;
          width: ${widthStyle};
          margin: 0;
          padding: ${paddingStyle};
          font-size: ${fontStyle};
          color: #000;
          background: #fff;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .header {
          margin-bottom: 5px;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
          margin: 0;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 5px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td {
          padding: 3px 0;
          vertical-align: top;
        }
        .footer {
          margin-top: 15px;
          font-size: 10px;
        }
        @media print {
          body { margin: 0; padding: 0; width: ${widthStyle}; }
          .no-print { display: none; }
        }
        .no-print-btn {
          background: #000;
          color: #fff;
          border: none;
          padding: 8px 16px;
          font-family: sans-serif;
          font-size: 12px;
          cursor: pointer;
          border-radius: 4px;
          margin-bottom: 10px;
          width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 15px;">
        <button class="no-print-btn" onclick="window.print()">Cetak Struk (PDF)</button>
      </div>
      <div class="header text-center">
        <p class="title">${activeSettings.namaToko || 'Maissy Coffee'}</p>
        <p style="margin: 3px 0;">${activeSettings.alamat || ''}</p>
        <p style="margin: 3px 0;">Telp: ${activeSettings.telepon || ''}</p>
      </div>
      
      <div class="divider"></div>
      
      <div>
        <table>
          <tr>
            <td>No: ${tx.ID_Transaksi}</td>
            <td class="text-right">Kasir: ${tx.Kasir}</td>
          </tr>
          <tr>
            <td>Tgl: ${new Date(tx.Tanggal).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td class="text-right">Cust: ${tx.Nama_Pelanggan}</td>
          </tr>
        </table>
      </div>
      
      <div class="divider"></div>
      
      <table>
        <tbody>
          ${details.map((item: TransactionDetail) => `
            <tr>
              <td colspan="2">${item.Nama_Menu}</td>
            </tr>
            <tr>
              <td style="padding-left: 10px;">${item.Qty} x Rp ${(item.Harga_Satuan || 0).toLocaleString('id-ID')}</td>
              <td class="text-right">Rp ${(item.Subtotal || 0).toLocaleString('id-ID')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <table>
        <tr>
          <td>Total Item:</td>
          <td class="text-right">${tx.Total_Item}</td>
        </tr>
        <tr style="font-weight: bold;">
          <td>Grand Total:</td>
          <td class="text-right">Rp ${(tx.Total_Harga || 0).toLocaleString('id-ID')}</td>
        </tr>
        <tr>
          <td>Metode Bayar:</td>
          <td class="text-right" style="font-weight: bold;">${tx.Metode_Bayar || 'TUNAI'}</td>
        </tr>
        <tr>
          <td>Bayar:</td>
          <td class="text-right">Rp ${(tx.Bayar || 0).toLocaleString('id-ID')}</td>
        </tr>
        <tr>
          <td>Kembali:</td>
          <td class="text-right">Rp ${(tx.Kembali || 0).toLocaleString('id-ID')}</td>
        </tr>
      </table>
      
      <div class="divider"></div>
      
      <div class="footer text-center">
        <p style="margin: 5px 0;">${activeSettings.pesanFooter || 'Terima kasih!'}</p>
        <p style="margin: 5px 0; font-size: 8px;">support system By PGW</p>
      </div>
    </body>
    </html>
  `;
}

export function getReceiptUrl(txId: string, paperSize: string = '80'): string {
  if (window.__useClientFirebase) {
    try {
      const ldb = (window as any).__getLocalDbInstance;
      if (ldb) {
        const txs: Transaction[] = ldb.get('transactions');
        const tx = txs.find((t: any) => t.ID_Transaksi === txId);
        if (tx) {
          const details: TransactionDetail[] = ldb.get('transaction_details').filter((d: any) => d.ID_Transaksi === txId);
          const settings = ldb.get('settings');
          const html = generateReceiptHtml(tx, details, settings, paperSize);
          const blob = new Blob([html], { type: 'text/html' });
          return URL.createObjectURL(blob);
        }
      }
    } catch (e) {
      console.error('[Receipt URL] Error creating blob URL:', e);
    }
  }
  return `/api/receipt/${txId}/print?paperSize=${paperSize}`;
}

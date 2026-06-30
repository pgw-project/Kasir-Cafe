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
  }

  return {
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
    // Clean paths like `/api/users/123` to route parameters
    const cleanPath = path.replace(/^\/api/, '');

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
      return { ok: true, status: 200, data: ldb.get('users') };
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

    // 6. CRUD: Settings
    if (cleanPath === '/settings' && method === 'GET') {
      const ldb = getLocalDb();
      let settings = ldb.get('settings');
      if (!settings || !settings.namaToko) {
        settings = {
          namaToko: 'Kafe Maissy Coffee',
          alamat: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
          telepon: '0812-3456-7890',
          pesanFooter: 'Terima kasih telah berkunjung ke Maissy Coffee!',
          googleSpreadsheetId: '1SHeYy5Vb1OaC9R_gTqC0y1-N4VzMaissySpreadsheetID',
          googleDriveFolderId: '1nXzPzQ2lqqaATvNybfTqcYU9lHc2DuG5',
          autoSync: true
        };
        ldb.set('settings', settings);
      }
      return { ok: true, status: 200, data: { success: true, settings } };
    }
    if (cleanPath === '/settings' && method === 'PUT') {
      const ldb = getLocalDb();
      ldb.set('settings', body);
      return { ok: true, status: 200, data: { success: true, settings: body } };
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
      const list = ldb.get('transactions');
      list.sort((a: any, b: any) => new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime());
      return { ok: true, status: 200, data: list };
    }
    if (cleanPath === '/transactions' && method === 'POST') {
      const { transaction, details } = body;
      const ldb = getLocalDb();
      
      const transactions = ldb.get('transactions');
      const transaction_details = ldb.get('transaction_details');

      const txId = transaction.ID_Transaksi || `tx_${Date.now()}`;
      const finalTx = { ...transaction, ID_Transaksi: txId };
      transactions.push(finalTx);
      ldb.set('transactions', transactions);

      for (const det of details) {
        const detId = det.ID_Detail || `det_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const finalDet = { ...det, ID_Transaksi: txId, ID_Detail: detId };
        transaction_details.push(finalDet);
      }
      ldb.set('transaction_details', transaction_details);

      return { ok: true, status: 200, data: { success: true, transaction: finalTx } };
    }

    // 9. Analytics report
    if (cleanPath === '/reports/analytics' && method === 'GET') {
      const ldb = getLocalDb();
      const transactions: Transaction[] = ldb.get('transactions');
      const details: TransactionDetail[] = ldb.get('transaction_details');
      const menus: Menu[] = ldb.get('menus');

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

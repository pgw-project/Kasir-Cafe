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

// Seeding helper to populate client-side Firestore if it's empty
async function ensureSeeded() {
  if (!db) return;
  try {
    const testDoc = await getDoc(doc(db, 'settings', 'global'));
    if (!testDoc.exists()) {
      console.log('[Firebase Client] Firestore is empty. Seeding initial data client-side...');
      const batch = writeBatch(db);

      // Seed Settings
      const initialSettings: Settings = {
        namaToko: 'Kopi Nusantara',
        alamat: 'Jl. Malioboro No. 123, Yogyakarta',
        telepon: '0812-3456-7890',
        pesanFooter: 'Terima Kasih Atas Kunjungan Anda',
        googleSpreadsheetId: '',
        googleDriveFolderId: '',
        autoSync: false
      };
      batch.set(doc(db, 'settings', 'global'), initialSettings);

      // Seed standard Admin User
      const adminUser: User = {
        ID_User: 'user_admin',
        Nama: 'Administrator',
        Email: 'admin@pos.com',
        Password: 'admin',
        Role: 'admin',
        Status: 'active',
        Created_At: new Date().toISOString()
      };
      batch.set(doc(db, 'users', 'user_admin'), adminUser);

      // Seed mock Menu items
      const initialMenus: Menu[] = [
        { ID_Menu: 'menu_1', Nama_Menu: 'Espresso', Kategori: 'Minuman', Harga: 15000, Foto_URL: '', Status: 'Tersedia', Created_At: new Date().toISOString() },
        { ID_Menu: 'menu_2', Nama_Menu: 'Cappuccino', Kategori: 'Minuman', Harga: 22000, Foto_URL: '', Status: 'Tersedia', Created_At: new Date().toISOString() },
        { ID_Menu: 'menu_3', Nama_Menu: 'Roti Bakar Cokelat', Kategori: 'Makanan', Harga: 18000, Foto_URL: '', Status: 'Tersedia', Created_At: new Date().toISOString() },
        { ID_Menu: 'menu_4', Nama_Menu: 'Nasi Goreng Spesial', Kategori: 'Makanan', Harga: 25000, Foto_URL: '', Status: 'Tersedia', Created_At: new Date().toISOString() }
      ];
      initialMenus.forEach(item => {
        batch.set(doc(db, 'menus', item.ID_Menu), item);
      });

      await batch.commit();
      console.log('[Firebase Client] Firestore initial seeding completed.');
    }
  } catch (err: any) {
    if (err && (err.code === 'permission-denied' || (err.message && err.message.includes('permission')))) {
      console.log('[Firebase Client] Direct client-side write is restricted. Relying on backend server-side database synchronization.');
    } else {
      console.warn('[Firebase Client] Optional client-side seeding skipped:', err);
    }
  }
}

// Trigger lazy seeding check
if (db) {
  ensureSeeded().catch(err => console.error('Error ensuring seeded:', err));
}

// --- CLIENT-SIDE REST ROUTER ---
// Replicates Express API logic using direct Firestore access

export const clientFirebaseRouter = {
  handleRequest: async (path: string, method: string, body: any): Promise<any> => {
    if (!db) {
      throw new Error('Firebase Client SDK is not initialized.');
    }

    // Clean paths like `/api/users/123` to route parameters
    const cleanPath = path.replace(/^\/api/, '');

    // 1. Auth: Login
    if (cleanPath === '/auth/login' && method === 'POST') {
      const { email, password } = body;
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: User[] = [];
      usersSnap.forEach(doc => {
        users.push(doc.data() as User);
      });

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
        Description: `Pengguna ${user.Nama} (${user.Role}) berhasil login (client-side fallback).`,
      };
      await setDoc(doc(db, 'activity_log', `log_${Date.now()}`), log);

      const { Password, ...userProfile } = user;
      const mockToken = `token_${user.ID_User}_${Date.now()}`;
      return { ok: true, status: 200, data: { success: true, token: mockToken, user: userProfile } };
    }

    // 2. Auth: Register
    if (cleanPath === '/auth/register' && method === 'POST') {
      const { nama, email, password, role } = body;
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: User[] = [];
      usersSnap.forEach(doc => {
        users.push(doc.data() as User);
      });

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

      await setDoc(doc(db, 'users', newUser.ID_User), newUser);

      // Add log
      const log: ActivityLog = {
        Timestamp: new Date().toISOString(),
        ID_User: newUser.ID_User,
        Nama_User: newUser.Nama,
        Action: 'REGISTER',
        Module: 'AUTH',
        Description: `Staf baru ${newUser.Nama} (${newUser.Role}) didaftarkan.`,
      };
      await setDoc(doc(db, 'activity_log', `log_${Date.now()}`), log);

      return { ok: true, status: 200, data: { success: true, user: newUser } };
    }

    // 3. Auth: Reset Password
    if (cleanPath === '/auth/reset-password' && method === 'POST') {
      const { email, newPassword } = body;
      const usersSnap = await getDocs(collection(db, 'users'));
      let foundUser: User | null = null;
      usersSnap.forEach(docSnap => {
        const u = docSnap.data() as User;
        if (u.Email.toLowerCase() === email.toLowerCase()) {
          foundUser = u;
        }
      });

      if (!foundUser) {
        return { ok: false, status: 404, data: { success: false, message: 'Email tidak ditemukan.' } };
      }

      const updatedUser = { ...foundUser, Password: newPassword };
      await setDoc(doc(db, 'users', (foundUser as User).ID_User), updatedUser);

      return { ok: true, status: 200, data: { success: true, message: 'Kata sandi berhasil diperbarui.' } };
    }

    // 4. CRUD: Users
    if (cleanPath === '/users' && method === 'GET') {
      const snap = await getDocs(collection(db, 'users'));
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      return { ok: true, status: 200, data: list };
    }
    if (cleanPath === '/users' && method === 'POST') {
      const newUser = { ...body, ID_User: body.ID_User || `usr_${Date.now()}` };
      await setDoc(doc(db, 'users', newUser.ID_User), newUser);
      return { ok: true, status: 200, data: { success: true, user: newUser } };
    }
    if (cleanPath.startsWith('/users/') && method === 'PUT') {
      const id = cleanPath.split('/')[2];
      await setDoc(doc(db, 'users', id), body);
      return { ok: true, status: 200, data: { success: true, user: body } };
    }
    if (cleanPath.startsWith('/users/') && method === 'DELETE') {
      const id = cleanPath.split('/')[2];
      await deleteDoc(doc(db, 'users', id));
      return { ok: true, status: 200, data: { success: true } };
    }

    // 5. CRUD: Menus
    if (cleanPath === '/menus' && method === 'GET') {
      const snap = await getDocs(collection(db, 'menus'));
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      return { ok: true, status: 200, data: list };
    }
    if (cleanPath === '/menus' && method === 'POST') {
      const newMenu = { ...body, ID_Menu: body.ID_Menu || `menu_${Date.now()}` };
      await setDoc(doc(db, 'menus', newMenu.ID_Menu), newMenu);
      return { ok: true, status: 200, data: { success: true, menu: newMenu } };
    }
    if (cleanPath.startsWith('/menus/') && method === 'PUT') {
      const id = cleanPath.split('/')[2];
      await setDoc(doc(db, 'menus', id), body);
      return { ok: true, status: 200, data: { success: true, menu: body } };
    }
    if (cleanPath.startsWith('/menus/') && method === 'DELETE') {
      const id = cleanPath.split('/')[2];
      await deleteDoc(doc(db, 'menus', id));
      return { ok: true, status: 200, data: { success: true } };
    }

    // 6. CRUD: Settings
    if (cleanPath === '/settings' && method === 'GET') {
      const docSnap = await getDoc(doc(db, 'settings', 'global'));
      let settings = docSnap.exists() ? docSnap.data() : {
        namaToko: 'Kopi Nusantara',
        alamat: 'Jl. Malioboro No. 123, Yogyakarta',
        telepon: '0812-3456-7890',
        pesanFooter: 'Terima Kasih Atas Kunjungan Anda',
        googleSpreadsheetId: '',
        googleDriveFolderId: '',
        autoSync: false
      };
      return { ok: true, status: 200, data: { success: true, settings } };
    }
    if (cleanPath === '/settings' && method === 'PUT') {
      await setDoc(doc(db, 'settings', 'global'), body);
      return { ok: true, status: 200, data: { success: true, settings: body } };
    }

    // 7. Activity Logs
    if (cleanPath === '/logs' && method === 'GET') {
      const snap = await getDocs(collection(db, 'activity_log'));
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());
      return { ok: true, status: 200, data: list };
    }

    // 8. Transactions
    if (cleanPath === '/transactions' && method === 'GET') {
      const snap = await getDocs(collection(db, 'transactions'));
      const list: any[] = [];
      snap.forEach(d => list.push(d.data()));
      list.sort((a, b) => new Date(b.Tanggal).getTime() - new Date(a.Tanggal).getTime());
      return { ok: true, status: 200, data: list };
    }
    if (cleanPath === '/transactions' && method === 'POST') {
      const { transaction, details } = body;
      
      // Save Transaction
      const txId = transaction.ID_Transaksi || `tx_${Date.now()}`;
      const finalTx = { ...transaction, ID_Transaksi: txId };
      await setDoc(doc(db, 'transactions', txId), finalTx);

      // Save Transaction Details & Update Menu Stock
      const batch = writeBatch(db);
      for (const det of details) {
        const detId = det.ID_Detail || `det_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const finalDet = { ...det, ID_Transaksi: txId, ID_Detail: detId };
        batch.set(doc(db, 'transaction_details', detId), finalDet);

        // Reduce menu stock (no-op since Menu type doesn't track numeric stock in current schema)
      }
      await batch.commit();

      return { ok: true, status: 200, data: { success: true, transaction: finalTx } };
    }

    // 9. Analytics report
    if (cleanPath === '/reports/analytics' && method === 'GET') {
      // Get all transactions
      const txSnap = await getDocs(collection(db, 'transactions'));
      const transactions: Transaction[] = [];
      txSnap.forEach(d => transactions.push(d.data() as Transaction));

      // Get all transaction details
      const detSnap = await getDocs(collection(db, 'transaction_details'));
      const details: TransactionDetail[] = [];
      detSnap.forEach(d => details.push(d.data() as TransactionDetail));

      // Get menus for category lookup
      const menuSnap = await getDocs(collection(db, 'menus'));
      const menus: Menu[] = [];
      menuSnap.forEach(d => menus.push(d.data() as Menu));

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

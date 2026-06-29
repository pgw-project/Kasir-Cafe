/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { User, Menu, Transaction, TransactionDetail, ActivityLog, Settings } from './src/types.js';
import { loadFromFirestore, syncCollection, syncFullDatabase } from './firebase-server.js';

const DB_PATH = path.join(process.cwd(), 'database.json');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Ensure database and uploads folders exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial/Mock Data Generator
function getInitialData() {
  const users: User[] = [
    {
      ID_User: 'USR-001',
      Nama: 'Maissy Owner',
      Email: 'admin@maissy.com',
      Role: 'admin',
      Status: 'active',
      Password: 'admin123', // Simple plain check for ease of evaluation
      Created_At: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_User: 'USR-002',
      Nama: 'Rian Kasir',
      Email: 'kasir@maissy.com',
      Role: 'kasir',
      Status: 'active',
      Password: 'kasir123',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ];

  const menus: Menu[] = [
    {
      ID_Menu: 'MN-001',
      Kategori: 'Minuman',
      Nama_Menu: 'Es Kopi Susu Maissy',
      Harga: 18000,
      Foto_URL: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-002',
      Kategori: 'Minuman',
      Nama_Menu: 'Espresso Double',
      Harga: 15000,
      Foto_URL: 'https://images.unsplash.com/photo-151097252790b-af4f42d91015?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-003',
      Kategori: 'Minuman',
      Nama_Menu: 'Hot Cappuccino',
      Harga: 22000,
      Foto_URL: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-004',
      Kategori: 'Minuman',
      Nama_Menu: 'Ice Caramel Macchiato',
      Harga: 25000,
      Foto_URL: 'https://images.unsplash.com/photo-1595434061149-86575bc89529?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-005',
      Kategori: 'Minuman',
      Nama_Menu: 'Ice Matcha Latte',
      Harga: 22000,
      Foto_URL: 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-006',
      Kategori: 'Minuman',
      Nama_Menu: 'Chocolate Signature',
      Harga: 20000,
      Foto_URL: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-007',
      Kategori: 'Minuman',
      Nama_Menu: 'Ice Lychee Tea',
      Harga: 15000,
      Foto_URL: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-008',
      Kategori: 'Makanan',
      Nama_Menu: 'Butter Croissant',
      Harga: 18000,
      Foto_URL: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-009',
      Kategori: 'Makanan',
      Nama_Menu: 'French Fries Extra',
      Harga: 15000,
      Foto_URL: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      ID_Menu: 'MN-010',
      Kategori: 'Makanan',
      Nama_Menu: 'Choco Lava Cake',
      Harga: 20000,
      Foto_URL: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&q=80&w=200',
      Status: 'Tersedia',
      Created_At: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ];

  const settings: Settings = {
    namaToko: 'Kafe Maissy Coffee',
    alamat: 'Jl. Melati No. 45, Kebayoran Baru, Jakarta Selatan',
    telepon: '0812-3456-7890',
    pesanFooter: 'Terima kasih telah berkunjung ke Maissy Coffee!',
    googleSpreadsheetId: '1SHeYy5Vb1OaC9R_gTqC0y1-N4VzMaissySpreadsheetID',
    googleDriveFolderId: '1nXzPzQ2lqqaATvNybfTqcYU9lHc2DuG5',
    autoSync: true,
  };

  // Generate mock transactions for the last 7 days to populate graphs
  const transactions: Transaction[] = [];
  const transactionDetails: TransactionDetail[] = [];
  const customers = ['Andi', 'Budi', 'Chandra', 'Dewi', 'Eka', 'Ferry', 'Gita', 'Hana', 'Indra', 'Joko'];
  const cashiers = ['Rian Kasir', 'Maissy Owner'];

  let txCounter = 1;
  let detailCounter = 1;

  for (let i = 7; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Number of transactions per day: 3 to 8
    const count = i === 0 ? 4 : Math.floor(Math.random() * 6) + 3;
    
    for (let t = 0; t < count; t++) {
      // Pick random menu items
      const selectedMenus: Menu[] = [];
      const itemQty = Math.floor(Math.random() * 3) + 1; // 1 to 3 items
      for (let m = 0; m < itemQty; m++) {
        const randomMenu = menus[Math.floor(Math.random() * menus.length)];
        if (!selectedMenus.includes(randomMenu)) {
          selectedMenus.push(randomMenu);
        }
      }

      let totalItem = 0;
      let totalHarga = 0;
      const txId = `TRX-${String(txCounter++).padStart(5, '0')}`;

      selectedMenus.forEach((menu) => {
        const qty = Math.floor(Math.random() * 2) + 1;
        const subtotal = menu.Harga * qty;
        totalItem += qty;
        totalHarga += subtotal;

        transactionDetails.push({
          ID_Detail: `DTL-${String(detailCounter++).padStart(6, '0')}`,
          ID_Transaksi: txId,
          ID_Menu: menu.ID_Menu,
          Nama_Menu: menu.Nama_Menu,
          Qty: qty,
          Harga_Satuan: menu.Harga,
          Subtotal: subtotal,
        });
      });

      // Simple payment details
      const bayar = Math.ceil(totalHarga / 10000) * 10000;
      const kembali = bayar - totalHarga;

      transactions.push({
        ID_Transaksi: txId,
        Tanggal: date.toISOString(),
        Nama_Pelanggan: customers[Math.floor(Math.random() * customers.length)],
        Total_Item: totalItem,
        Total_Harga: totalHarga,
        Bayar: bayar,
        Kembali: kembali,
        Kasir: cashiers[Math.floor(Math.random() * cashiers.length)],
        PDF_URL: `/api/receipt/${txId}/print`,
        Status: 'Paid',
      });
    }
  }

  const activityLogs: ActivityLog[] = [
    {
      Timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      ID_User: 'USR-001',
      Nama_User: 'Maissy Owner',
      Action: 'INITIALIZE',
      Module: 'SYSTEM',
      Description: 'Sistem dan basis data berhasil diinisialisasi.',
    }
  ];

  return {
    users,
    menus,
    transactions,
    transaction_details: transactionDetails,
    activity_log: activityLogs,
    settings,
  };
}

// Memory database cache for instant reads
let globalDb: any = null;

// Initialize database from Firestore, with local fallback and cloud migration
async function initDatabase() {
  console.log('[Database] Initializing POS database...');
  try {
    const cloudDb = await loadFromFirestore();
    if (cloudDb) {
      globalDb = cloudDb;
      // Sync local backup file
      fs.writeFileSync(DB_PATH, JSON.stringify(globalDb, null, 2), 'utf-8');
      console.log('[Database] Loaded successfully from Firestore and backed up locally.');
    } else {
      console.log('[Database] Firestore is empty. Performing initial migration/seeding...');
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        globalDb = JSON.parse(data);
      } else {
        globalDb = getInitialData();
        fs.writeFileSync(DB_PATH, JSON.stringify(globalDb, null, 2), 'utf-8');
      }
      // Populate Firestore with initial data in the background
      syncFullDatabase(globalDb).catch(err => {
        console.error('[Database] Failed to populate Firestore:', err);
      });
    }
  } catch (error) {
    console.error('[Database] Error initializing database from Firestore, using local fallback:', error);
    if (fs.existsSync(DB_PATH)) {
      try {
        globalDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      } catch (e) {
        globalDb = getInitialData();
      }
    } else {
      globalDb = getInitialData();
    }
  }
}

// Read database helper (returns cached memory DB for maximum performance)
function readDB() {
  if (!globalDb) {
    try {
      if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        globalDb = JSON.parse(data);
      } else {
        globalDb = getInitialData();
        fs.writeFileSync(DB_PATH, JSON.stringify(globalDb, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Error in synchronous readDB fallback:', error);
      globalDb = getInitialData();
    }
  }
  return globalDb;
}

// Write database helper
function writeDB(data: any, resource?: string) {
  try {
    globalDb = data;
    // Write local backup file synchronously
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');

    // Asynchronously synchronize changes to Firestore
    if (resource) {
      const syncKey = resource;
      const colData = resource === 'settings' ? data.settings : data[resource];
      syncCollection(syncKey, colData).catch(err => {
        console.error(`[Firestore] Failed to async sync collection '${syncKey}':`, err);
      });
    } else {
      syncFullDatabase(data).catch(err => {
        console.error('[Firestore] Failed to async sync full database:', err);
      });
    }

    broadcastToAll({
      type: 'db_update',
      resource: resource || 'all',
      timestamp: Date.now()
    });
    return true;
  } catch (error) {
    console.error('Error writing database:', error);
    return false;
  }
}

// Define custom WebSocket interface
interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  userNama?: string;
  userRole?: string;
  userEmail?: string;
  currentView?: string;
}

const activeSockets = new Set<CustomWebSocket>();
const chatHistory: any[] = [];

function broadcastToAll(message: any) {
  const payload = JSON.stringify(message);
  for (const client of activeSockets) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastPresence() {
  const users: any[] = [];
  const seenUsers = new Set<string>();
  
  for (const client of activeSockets) {
    if (client.readyState === WebSocket.OPEN && client.userId) {
      const key = `${client.userId}-${client.currentView || 'dashboard'}`;
      if (!seenUsers.has(key)) {
        seenUsers.add(key);
        users.push({
          ID_User: client.userId,
          Nama: client.userNama || 'Staff',
          Role: client.userRole || 'Kasir',
          Email: client.userEmail || '',
          currentView: client.currentView || 'POS',
          activeAt: Date.now(),
        });
      }
    }
  }
  
  broadcastToAll({
    type: 'presence',
    users,
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON parsing and bodies
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static serving for local uploads folder
  app.use('/uploads', express.static(UPLOADS_DIR));

  // Initialize DB in background from Firestore to prevent blocking server startup
  initDatabase().catch(err => {
    console.error('[Database] Background database initialization failed:', err);
  });

  // --- API ROUTES ---

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    const user = db.users.find((u: User) => u.Email.toLowerCase() === email.toLowerCase() && u.Status === 'active');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email tidak terdaftar atau akun nonaktif' });
    }

    if (user.Password !== password) {
      return res.status(401).json({ success: false, message: 'Password salah' });
    }

    // Add activity log
    const log: ActivityLog = {
      Timestamp: new Date().toISOString(),
      ID_User: user.ID_User,
      Nama_User: user.Nama,
      Action: 'LOGIN',
      Module: 'AUTH',
      Description: `Pengguna ${user.Nama} (${user.Role}) berhasil login.`,
    };
    db.activity_log.unshift(log);
    writeDB(db);

    // Exclude password from token/profile
    const { Password, ...userProfile } = user;
    const mockToken = `token_${user.ID_User}_${Date.now()}`;

    res.json({ success: true, token: mockToken, user: userProfile });
  });

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { nama, email, password, role } = req.body;
    const db = readDB();

    const existingUser = db.users.find((u: User) => u.Email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const newUser: User = {
      ID_User: `USR-${String(db.users.length + 1).padStart(3, '0')}`,
      Nama: nama,
      Email: email,
      Role: role || 'kasir',
      Status: 'active',
      Password: password,
      Created_At: new Date().toISOString(),
    };

    db.users.push(newUser);

    // Add activity log
    const log: ActivityLog = {
      Timestamp: new Date().toISOString(),
      ID_User: newUser.ID_User,
      Nama_User: newUser.Nama,
      Action: 'REGISTER',
      Module: 'AUTH',
      Description: `Pendaftaran pengguna baru ${nama} sebagai ${newUser.Role} berhasil.`,
    };
    db.activity_log.unshift(log);
    writeDB(db);

    const { Password, ...userProfile } = newUser;
    res.json({ success: true, user: userProfile });
  });

  // Auth: Reset Password
  app.post('/api/auth/reset-password', (req, res) => {
    const { email, newPassword } = req.body;
    const db = readDB();
    const userIndex = db.users.findIndex((u: User) => u.Email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Email tidak ditemukan.' });
    }

    db.users[userIndex].Password = newPassword;

    // Log the action
    const log: ActivityLog = {
      Timestamp: new Date().toISOString(),
      ID_User: db.users[userIndex].ID_User,
      Nama_User: db.users[userIndex].Nama,
      Action: 'RESET_PASSWORD',
      Module: 'AUTH',
      Description: `Mengatur ulang kata sandi untuk akun ${email}.`,
    };
    db.activity_log.unshift(log);
    writeDB(db);

    res.json({ success: true, message: 'Sandi berhasil diatur ulang. Silakan login kembali.' });
  });

  // Users: Get all
  app.get('/api/users', (req, res) => {
    const db = readDB();
    const cleanUsers = db.users.map(({ Password, ...u }: any) => u);
    res.json(cleanUsers);
  });

  // Users: Create User (Admin only action)
  app.post('/api/users', (req, res) => {
    const { nama, email, password, role, status, actorId } = req.body;
    const db = readDB();

    const existingUser = db.users.find((u: User) => u.Email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });
    }

    const newUser: User = {
      ID_User: `USR-${String(db.users.length + 1).padStart(3, '0')}`,
      Nama: nama,
      Email: email,
      Role: role,
      Status: status || 'active',
      Password: password || '123456',
      Created_At: new Date().toISOString(),
    };

    db.users.push(newUser);

    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'CREATE_USER',
      Module: 'USER_MANAGEMENT',
      Description: `Membuat pengguna baru: ${nama} (${role})`,
    });

    writeDB(db);
    res.json({ success: true, user: newUser });
  });

  // Users: Toggle Status / Update User
  app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { nama, email, password, role, status, actorId } = req.body;
    const db = readDB();
    const userIndex = db.users.findIndex((u: User) => u.ID_User === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const oldUser = db.users[userIndex];
    
    // Check if new email is already used by another user
    if (email && email.toLowerCase() !== oldUser.Email.toLowerCase()) {
      const emailExists = db.users.find((u: User) => u.Email.toLowerCase() === email.toLowerCase());
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email sudah terdaftar di pengguna lain.' });
      }
    }

    db.users[userIndex] = {
      ...oldUser,
      Nama: nama !== undefined ? nama : oldUser.Nama,
      Email: email !== undefined ? email : oldUser.Email,
      Password: password !== undefined ? password : oldUser.Password,
      Role: role !== undefined ? role : oldUser.Role,
      Status: status !== undefined ? status : oldUser.Status,
    };

    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'UPDATE_USER',
      Module: 'USER_MANAGEMENT',
      Description: `Mengubah detail pengguna ${oldUser.Nama} (Status: ${db.users[userIndex].Status}, Role: ${db.users[userIndex].Role})`,
    });

    writeDB(db);
    res.json({ success: true, user: db.users[userIndex] });
  });

  // Users: Delete User
  app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const actorId = req.query.actorId || req.body.actorId;
    const db = readDB();
    const userIndex = db.users.findIndex((u: User) => u.ID_User === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const targetUser = db.users[userIndex];
    if (targetUser.ID_User === actorId) {
      return res.status(400).json({ success: false, message: 'Anda tidak dapat menghapus akun Anda sendiri!' });
    }

    db.users.splice(userIndex, 1);

    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId ? String(actorId) : 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'DELETE_USER',
      Module: 'USER_MANAGEMENT',
      Description: `Menghapus pengguna secara permanen: ${targetUser.Nama} (${targetUser.Role})`,
    });

    writeDB(db);
    res.json({ success: true, message: `Pengguna ${targetUser.Nama} berhasil dihapus.` });
  });

  // Menus: Get all
  app.get('/api/menus', (req, res) => {
    const db = readDB();
    res.json(db.menus);
  });

  // Menus: Save / CRUD
  app.post('/api/menus', (req, res) => {
    const { nama, kategori, harga, status, fotoBase64, fotoFileName, actorId } = req.body;
    const db = readDB();

    let finalFotoUrl = 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&q=80&w=200'; // Default

    // Handle upload if base64 provided
    if (fotoBase64) {
      try {
        const matches = fotoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const fileBuffer = Buffer.from(matches[2], 'base64');
          const fileName = `${Date.now()}_${fotoFileName || 'uploaded_image.png'}`;
          const filePath = path.join(UPLOADS_DIR, fileName);
          fs.writeFileSync(filePath, fileBuffer);
          finalFotoUrl = `/uploads/${fileName}`;
          console.log(`Successfully saved uploaded menu photo to ${filePath}`);
        }
      } catch (err) {
        console.error('Error decoding/saving menu photo base64:', err);
      }
    }

    // Generate unique ID_Menu (MN-XXX)
    const nextNum = db.menus.length > 0 
      ? Math.max(...db.menus.map((m: Menu) => parseInt(m.ID_Menu.split('-')[1]) || 0)) + 1 
      : 1;
    const idMenu = `MN-${String(nextNum).padStart(3, '0')}`;

    const newMenu: Menu = {
      ID_Menu: idMenu,
      Kategori: kategori,
      Nama_Menu: nama,
      Harga: Number(harga),
      Foto_URL: finalFotoUrl,
      Status: status || 'Tersedia',
      Created_At: new Date().toISOString(),
    };

    db.menus.push(newMenu);

    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'ADD_MENU',
      Module: 'MENU_MANAGEMENT',
      Description: `Menambahkan menu baru: ${nama} (${kategori}) dengan harga Rp ${Number(harga).toLocaleString('id-ID')}`,
    });

    writeDB(db);
    res.json({ success: true, menu: newMenu });
  });

  app.put('/api/menus/:id', (req, res) => {
    const { id } = req.params;
    const { nama, kategori, harga, status, fotoBase64, fotoFileName, actorId } = req.body;
    const db = readDB();
    const menuIndex = db.menus.findIndex((m: Menu) => m.ID_Menu === id);

    if (menuIndex === -1) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }

    const oldMenu = db.menus[menuIndex];
    let finalFotoUrl = oldMenu.Foto_URL;

    if (fotoBase64) {
      try {
        const matches = fotoBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const fileBuffer = Buffer.from(matches[2], 'base64');
          const fileName = `${Date.now()}_${fotoFileName || 'uploaded_image.png'}`;
          const filePath = path.join(UPLOADS_DIR, fileName);
          fs.writeFileSync(filePath, fileBuffer);
          finalFotoUrl = `/uploads/${fileName}`;
        }
      } catch (err) {
        console.error('Error decoding/saving menu photo base64 during update:', err);
      }
    }

    db.menus[menuIndex] = {
      ...oldMenu,
      Nama_Menu: nama !== undefined ? nama : oldMenu.Nama_Menu,
      Kategori: kategori !== undefined ? kategori : oldMenu.Kategori,
      Harga: harga !== undefined ? Number(harga) : oldMenu.Harga,
      Status: status !== undefined ? status : oldMenu.Status,
      Foto_URL: finalFotoUrl,
    };

    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'UPDATE_MENU',
      Module: 'MENU_MANAGEMENT',
      Description: `Mengubah menu ${oldMenu.Nama_Menu}: Harga Rp ${Number(db.menus[menuIndex].Harga).toLocaleString('id-ID')}, Status: ${db.menus[menuIndex].Status}`,
    });

    writeDB(db);
    res.json({ success: true, menu: db.menus[menuIndex] });
  });

  app.delete('/api/menus/:id', (req, res) => {
    const { id } = req.params;
    const { actorId } = req.query;
    const db = readDB();
    const menuIndex = db.menus.findIndex((m: Menu) => m.ID_Menu === id);

    if (menuIndex === -1) {
      return res.status(404).json({ success: false, message: 'Menu tidak ditemukan' });
    }

    const removedMenu = db.menus[menuIndex];
    db.menus.splice(menuIndex, 1);

    const actor = db.users.find((u: User) => u.ID_User === String(actorId)) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: String(actorId) || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'DELETE_MENU',
      Module: 'MENU_MANAGEMENT',
      Description: `Menghapus menu: ${removedMenu.Nama_Menu}`,
    });

    writeDB(db);
    res.json({ success: true, message: 'Menu berhasil dihapus' });
  });

  // Settings
  app.get('/api/settings', (req, res) => {
    const db = readDB();
    res.json(db.settings);
  });

  app.put('/api/settings', (req, res) => {
    const { namaToko, alamat, telepon, pesanFooter, googleSpreadsheetId, googleDriveFolderId, autoSync, actorId } = req.body;
    const db = readDB();

    db.settings = {
      namaToko: namaToko || db.settings.namaToko,
      alamat: alamat || db.settings.alamat,
      telepon: telepon || db.settings.telepon,
      pesanFooter: pesanFooter || db.settings.pesanFooter,
      googleSpreadsheetId: googleSpreadsheetId || db.settings.googleSpreadsheetId,
      googleDriveFolderId: googleDriveFolderId || db.settings.googleDriveFolderId,
      autoSync: autoSync !== undefined ? autoSync : db.settings.autoSync,
    };

    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: 'System' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'UPDATE_SETTINGS',
      Module: 'SETTINGS',
      Description: `Memperbarui konfigurasi sistem kafe.`,
    });

    writeDB(db);
    res.json({ success: true, settings: db.settings });
  });

  // Logs
  app.get('/api/logs', (req, res) => {
    const db = readDB();
    res.json(db.activity_log.slice(0, 150)); // Return top 150 logs
  });

  // Transactions: Get all with details
  app.get('/api/transactions', (req, res) => {
    const db = readDB();
    res.json({
      transactions: db.transactions,
      details: db.transaction_details,
    });
  });

  // Transactions: Create (POS Checkout)
  app.post('/api/transactions', (req, res) => {
    const { namaPelanggan, items, bayar, kembali, cashierName, actorId, metodeBayar } = req.body;
    const db = readDB();

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Keranjang belanja kosong.' });
    }

    if (!namaPelanggan) {
      return res.status(400).json({ success: false, message: 'Nama pelanggan wajib diisi.' });
    }

    // Generate Transaction ID (TRX-XXXXX)
    const nextTxNum = db.transactions.length > 0
      ? Math.max(...db.transactions.map((t: Transaction) => parseInt(t.ID_Transaksi.split('-')[1]) || 0)) + 1
      : 1;
    const txId = `TRX-${String(nextTxNum).padStart(5, '0')}`;

    let totalItem = 0;
    let totalHarga = 0;

    const newDetails: TransactionDetail[] = items.map((item: any, idx: number) => {
      const subtotal = item.Harga * item.qty;
      totalItem += item.qty;
      totalHarga += subtotal;

      // Unique detail ID
      const dtlId = `DTL-${String(db.transaction_details.length + 1 + idx).padStart(6, '0')}`;

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

    const newTx: Transaction = {
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
    };

    db.transactions.unshift(newTx); // Newest first
    db.transaction_details.push(...newDetails);

    // Add activity log
    const actor = db.users.find((u: User) => u.ID_User === actorId) || { Nama: cashierName || 'Kasir' };
    db.activity_log.unshift({
      Timestamp: new Date().toISOString(),
      ID_User: actorId || 'SYSTEM',
      Nama_User: actor.Nama,
      Action: 'CHECKOUT',
      Module: 'POS',
      Description: `Transaksi ${txId} berhasil dibuat untuk Pelanggan: ${namaPelanggan}. Total: Rp ${totalHarga.toLocaleString('id-ID')}`,
    });

    writeDB(db);
    res.json({ success: true, transaction: newTx, details: newDetails });
  });

  // Receipts Renderer: printable thermal layout
  app.get('/api/receipt/:id/print', (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const tx = db.transactions.find((t: Transaction) => t.ID_Transaksi === id);
    if (!tx) {
      return res.status(404).send('Transaksi tidak ditemukan.');
    }

    const details = db.transaction_details.filter((d: TransactionDetail) => d.ID_Transaksi === id);
    const settings = db.settings;

    const paperSize = req.query.paperSize || '80';
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

    const html = `
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
          <p class="title">${settings.namaToko}</p>
          <p style="margin: 3px 0;">${settings.alamat}</p>
          <p style="margin: 3px 0;">Telp: ${settings.telepon}</p>
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
                <td style="padding-left: 10px;">${item.Qty} x Rp ${item.Harga_Satuan.toLocaleString('id-ID')}</td>
                <td class="text-right">Rp ${item.Subtotal.toLocaleString('id-ID')}</td>
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
            <td class="text-right">Rp ${tx.Total_Harga.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td>Metode Bayar:</td>
            <td class="text-right" style="font-weight: bold;">${tx.Metode_Bayar || 'TUNAI'}</td>
          </tr>
          <tr>
            <td>Bayar:</td>
            <td class="text-right">Rp ${tx.Bayar.toLocaleString('id-ID')}</td>
          </tr>
          <tr>
            <td>Kembali:</td>
            <td class="text-right">Rp ${tx.Kembali.toLocaleString('id-ID')}</td>
          </tr>
        </table>
        
        <div class="divider"></div>
        
        <div class="footer text-center">
          <p style="margin: 5px 0;">${settings.pesanFooter}</p>
          <p style="margin: 5px 0; font-size: 8px;">Diberdayakan oleh Maissy Coffee POS</p>
        </div>
        
        <script>
          // Auto trigger print in printable preview mode
          window.onload = function() {
            // Optional auto print if inside iframe
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  });

  // Aggregate Reporting endpoint for rich charts
  app.get('/api/reports/analytics', (req, res) => {
    const db = readDB();
    const transactions = db.transactions;
    const details = db.transaction_details;

    // Helper for date checks
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

    // 1. Dashboard summary counts
    let todaySales = 0;
    let todayOrdersCount = 0;
    let yesterdaySales = 0;
    let totalSalesEver = 0;

    transactions.forEach((tx: Transaction) => {
      const txDate = new Date(tx.Tanggal);
      totalSalesEver += tx.Total_Harga;

      if (txDate >= startOfToday) {
        todaySales += tx.Total_Harga;
        todayOrdersCount++;
      } else if (txDate >= startOfYesterday && txDate < startOfToday) {
        yesterdaySales += tx.Total_Harga;
      }
    });

    // 2. Sales movement for last 7 days (Daily Sales chart)
    const salesLast7Days: { date: string; amount: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateString = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      let dayTotal = 0;
      let dayCount = 0;
      
      transactions.forEach((tx: Transaction) => {
        const txDate = new Date(tx.Tanggal);
        if (txDate >= dayStart && txDate < dayEnd) {
          dayTotal += tx.Total_Harga;
          dayCount++;
        }
      });

      salesLast7Days.push({
        date: dateString,
        amount: dayTotal,
        count: dayCount,
      });
    }

    // 3. Category distribution (Pie chart)
    const categoryTotals: { [key: string]: number } = {};
    const itemSalesQuantities: { [key: string]: { name: string; qty: number; total: number } } = {};

    details.forEach((det: TransactionDetail) => {
      const matchingMenu = db.menus.find((m: Menu) => m.ID_Menu === det.ID_Menu);
      const rawCategory = matchingMenu ? matchingMenu.Kategori : 'Lainnya';
      
      // Dynamic normalization for legacy categories
      let category = rawCategory;
      const lower = rawCategory.toLowerCase();
      if (lower === 'coffee' || lower === 'non-coffee' || lower === 'minuman') {
        category = 'Minuman';
      } else if (lower === 'snacks' || lower === 'desserts' || lower === 'makanan') {
        category = 'Makanan';
      }

      categoryTotals[category] = (categoryTotals[category] || 0) + det.Subtotal;

      if (!itemSalesQuantities[det.ID_Menu]) {
        itemSalesQuantities[det.ID_Menu] = { name: det.Nama_Menu, qty: 0, total: 0 };
      }
      itemSalesQuantities[det.ID_Menu].qty += det.Qty;
      itemSalesQuantities[det.ID_Menu].total += det.Subtotal;
    });

    const categoryDistribution = Object.keys(categoryTotals).map((key) => ({
      name: key,
      value: categoryTotals[key],
    }));

    // 4. Top 5 Best Selling Items
    const topSellingItems = Object.keys(itemSalesQuantities)
      .map((key) => itemSalesQuantities[key])
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Today's Best Selling Item
    const todayItemSales: { [key: string]: { name: string; qty: number } } = {};
    const todayTransactions = transactions.filter((tx: Transaction) => new Date(tx.Tanggal) >= startOfToday);
    const todayTxIds = todayTransactions.map((tx: Transaction) => tx.ID_Transaksi);

    details.forEach((det: TransactionDetail) => {
      if (todayTxIds.includes(det.ID_Transaksi)) {
        if (!todayItemSales[det.ID_Menu]) {
          todayItemSales[det.ID_Menu] = { name: det.Nama_Menu, qty: 0 };
        }
        todayItemSales[det.ID_Menu].qty += det.Qty;
      }
    });

    let todayBestItem = 'Tidak ada';
    let todayBestQty = 0;
    Object.keys(todayItemSales).forEach((key) => {
      if (todayItemSales[key].qty > todayBestQty) {
        todayBestQty = todayItemSales[key].qty;
        todayBestItem = `${todayItemSales[key].name} (${todayBestQty} pcs)`;
      }
    });

    res.json({
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
    });
  });

  // --- DEV & SPA FALLBACK SETUP ---

  // Detect if we are running in production mode (requires either production env, built assets, or bundled file run)
  const isProd = process.env.NODE_ENV === 'production' || 
                 fs.existsSync(path.join(process.cwd(), 'dist', 'index.html')) ||
                 (typeof __filename !== 'undefined' && __filename.endsWith('server.cjs'));

  // Vite middleware for development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = http.createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket: CustomWebSocket) => {
    socket.isAlive = true;
    activeSockets.add(socket);

    // Set up ping response handler
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    // Send existing chat history to the newly connected client
    socket.send(JSON.stringify({
      type: 'chat_history',
      history: chatHistory,
    }));

    // Broadcast updated presence list
    broadcastPresence();

    socket.on('message', (messageData) => {
      try {
        const data = JSON.parse(messageData.toString());
        
        if (data.type === 'identify') {
          socket.userId = data.user?.ID_User;
          socket.userNama = data.user?.Nama;
          socket.userRole = data.user?.Role;
          socket.userEmail = data.user?.Email;
          socket.currentView = data.currentView || 'POS';
          broadcastPresence();
        } 
        else if (data.type === 'change_view') {
          socket.currentView = data.currentView;
          broadcastPresence();
        } 
        else if (data.type === 'chat') {
          const chatMsg = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            message: data.message,
            user: {
              ID_User: socket.userId || data.user?.ID_User || 'unknown',
              Nama: socket.userNama || data.user?.Nama || 'Staff',
              Role: socket.userRole || data.user?.Role || 'Kasir',
            },
            timestamp: Date.now(),
          };
          chatHistory.push(chatMsg);
          // Keep history to last 50 messages
          if (chatHistory.length > 50) {
            chatHistory.shift();
          }
          broadcastToAll({
            type: 'chat',
            message: chatMsg,
          });
        }
        else if (data.type === 'ping') {
          socket.send(JSON.stringify({ type: 'pong' }));
        }
      } catch (e) {
        console.error('Error handling websocket message:', e);
      }
    });

    socket.on('close', () => {
      activeSockets.delete(socket);
      broadcastPresence();
    });

    socket.on('error', (err) => {
      console.error('Websocket socket error:', err);
      activeSockets.delete(socket);
      broadcastPresence();
    });
  });

  // Keep-alive heartbeat to prune dead sockets
  const interval = setInterval(() => {
    for (const ws of activeSockets) {
      if (ws.isAlive === false) {
        activeSockets.delete(ws);
        ws.terminate();
        broadcastPresence();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Kafe Maissy POS Backend] Running on http://localhost:${PORT}`);
  });
}

startServer();

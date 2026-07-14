/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  ID_User: string;
  Nama: string;
  Email: string;
  Role: 'creator' | 'admin' | 'kasir';
  Status: 'active' | 'inactive';
  Created_At: string;
  Password?: string; // Hashed or plain for simple auth
  cafeId?: string;
}

export interface Menu {
  ID_Menu: string;
  Kategori: string; // 'Makanan', 'Minuman'
  Nama_Menu: string;
  Harga: number;
  Foto_URL: string;
  Status: 'Tersedia' | 'Habis';
  Created_At: string;
  cafeId?: string;
}

export interface Transaction {
  ID_Transaksi: string;
  Tanggal: string;
  Nama_Pelanggan: string;
  Total_Item: number;
  Total_Harga: number;
  Bayar: number;
  Kembali: number;
  Kasir: string;
  PDF_URL: string; // Generated PDF receipt path
  Status: 'Paid' | 'Refunded';
  Metode_Bayar?: 'TUNAI' | 'QRIS';
  cafeId?: string;
}

export interface TransactionDetail {
  ID_Detail: string;
  ID_Transaksi: string;
  ID_Menu: string;
  Nama_Menu: string;
  Qty: number;
  Harga_Satuan: number;
  Subtotal: number;
}

export interface ActivityLog {
  Timestamp: string;
  ID_User: string;
  Nama_User: string;
  Action: string;
  Module: string;
  Description: string;
}

export interface Cafe {
  id: string;
  namaToko: string;
  alamat: string;
  telepon: string;
  pesanFooter: string;
  logoUrl?: string;
  qrisPayload?: string;
  qrisImageUrl?: string;
  Created_At?: string;
}

export interface Settings {
  namaToko: string;
  alamat: string;
  telepon: string;
  pesanFooter: string;
  logoUrl?: string;
  qrisPayload?: string;
  qrisImageUrl?: string;
  googleSpreadsheetId: string;
  googleDriveFolderId: string;
  autoSync: boolean;
  centralServerUrl?: string;
  centralServerSecret?: string;
  centralSyncEnabled?: boolean;
  cafes?: Cafe[];
  activeCafeId?: string;
}

/**
 * Google Apps Script Web App Controller
 * 
 * Instructions:
 * 1. Buka Google Apps Script (https://script.google.com/)
 * 2. Buat proyek baru.
 * 3. Hapus kode bawaan di `Code.gs`, lalu tempelkan seluruh kode dari file ini ke dalam `Code.gs`.
 * 4. Buat file HTML baru di proyek Apps Script Anda, beri nama `index` (sehingga menjadi `index.html`).
 * 5. Buka file `index.html` di Apps Script Anda, hapus semua kodenya, lalu salin dan tempel seluruh isi dari file `index.html` yang ada di folder `dist_gas` proyek Anda ke sana.
 * 6. Klik "Deploy" -> "New deployment".
 * 7. Pilih tipe "Web app".
 * 8. Setel "Execute as" menjadi "Me" (Email Anda), dan setel "Who has access" menjadi "Anyone" (atau sesuai kebutuhan Anda).
 * 9. Klik "Deploy", berikan izin (Authorize) jika diminta, lalu salin URL Web App yang dihasilkan.
 * 10. Di Google Sites, tambahkan blok "Embed" (Sematkan) dan masukkan URL Web App tersebut!
 */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('POS Management Maissy Coffee')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper function jika Anda membutuhkan interaksi server-side tambahan di masa depan.
 * Semua interaksi data utama dalam POS ini sudah terintegrasi langsung ke Firebase Firestore 
 * secara client-side, atau disimpan dengan aman di LocalStorage jika Firestore tidak terkonfigurasi.
 */
function getAppVersion() {
  return "v1.0.0-gas-embedded";
}

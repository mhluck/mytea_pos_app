# MyTea POS - Offline-First

MyTea POS adalah aplikasi kasir mobile pintar yang dirancang khusus untuk operasional bisnis F&B skala UMKM hingga multi-cabang (seperti Kedai Es Teh). Aplikasi ini memprioritaskan kecepatan transaksi tanpa bergantung pada koneksi internet di lapangan melalui arsitektur *Offline-First*, sekaligus memberikan kemudahan pemantauan data terpusat bagi pemilik bisnis (*owner*).

---

## 🚀 Fitur Utama

### 1. Keamanan & Lisensi Bisnis (Hardware Binding)
*   **Device Activation:** Aplikasi dilengkapi sistem penguncian perangkat menggunakan Capacitor Device API. Setiap 1 *booth* kedai fisik terikat dengan 1 *Device ID* unik.
*   **Anti-Piracy:** Aplikasi hanya bisa aktif setelah diverifikasi menggunakan *Activation Code* resmi dari *developer*, mencegah penyebaran atau penggandaan aplikasi secara ilegal.

### 2. Arsitektur Komputasi Lokal (Offline-First)
*   **Zero Latency:** Semua manajemen produk, pembaruan stok, dan pencatatan transaksi diproses langsung di *local storage* perangkat kasir menggunakan database lokal yang responsif.
*   **Lightweight State:** Sistem keranjang belanja disanitasi secara ketat (bebas dari teks gambar Base64 yang membebani memori) untuk menjamin aplikasi *anti-crash* meskipun memproses ratusan item sekaligus di perangkat *mobile*.

### 3. Integrasi Perangkat Keras (Bluetooth Thermal Printer)
*   **Direct Printing:** Komunikasi langsung dengan Printer Thermal Bluetooth untuk mencetak struk belanja secara instan begitu transaksi selesai.
*   **Safe Connection:** Menggunakan penanganan *async/await* terproteksi (`try...catch`) yang mendeteksi status *adapter* Bluetooth secara *real-time* untuk mencegah aplikasi *freeze* atau *crash*.
*   **Cetak Ulang Struk:** Memungkinkan kasir menduplikasi struk belanja secara akurat dari halaman riwayat transaksi 2 hari terakhir.

### 4. Pelaporan Eksekutif Multi-Format
*   **Dynamic PDF Engine:** Menghasilkan dokumen laporan bulanan resmi berformat *Landscape* (A4) secara lokal menggunakan `jspdf-autotable`. Dilengkapi penomoran halaman dinamis dan visualisasi tabel berkode warna (Finansial, Produk Terlaris, dan Detail Transaksi).
*   **Excel Export:** Ekspor rekapitulasi penjualan per baris item secara terstruktur untuk analisis finansial tingkat lanjut.

### 5. Sinkronisasi Cloud Multi-Cabang (Terima Jadi)
*   **1 Owner, 1 Email:** *Owner* yang memiliki banyak cabang cukup menggunakan satu akun email utama untuk memantau seluruh bisnisnya.
*   **Isolated Spreadsheet Webhook:** Data dari tiap-tiap HP cabang dikirim secara aman menggunakan metode HTTP POST berkode `text/plain` (untuk mem-bypass pembatasan CORS). Data akan ditangkap oleh *Google Apps Script Webhook* yang unik untuk digambar secara otomatis ke file Google Sheets cabang masing-masing cabang.

---

## 🛠️ Teknologi yang Digunakan

*   **Frontend Framework:** React.js (JavaScript)
*   **Mobile Wrapper:** Capacitor.js (untuk kompilasi aplikasi *native* Android/iOS)
*   **Local Database:** Dexie.js / IndexedDB (`localStorage` untuk persistent state ringan)
*   **Reporting Libraries:** jsPDF & jsPDF-AutoTable
*   **Backend Serverless & Cloud:** Google Apps Script & Google Sheets

---

## 💻 Cara Menjalankan Proyek (Development)

1. **Clone Repositori**
   ```Bash
   git clone [https://github.com/username/mytea-pos-app.git](https://github.com/username/mytea-pos-app.git)
   cd MyTea_POS_App
   ```

2. **Instalasi Dependencies**
    ```Bash
    npm install
    ```

3. **Jalankan Mode Web Browser**
```Bash
npm run dev
```

4. **Sinkronisasi ke Perangkat Mobile (Capacitor)**
```Bash
npm run build
```

5. **Buka Android Studio / Xcode menggunakan perintah**:
```Bash
npx cap open android
```
---

## ⚙️ Panduan Konfigurasi Sinkronisasi Cloud

Bagi pemilik kedai, integrasi cloud disediakan secara instan (terima jadi):
1. Pengembang akan menyertakan kode Google Apps Script ke dalam Spreadsheet tujuan milik owner.
2. Pengembang menyebarkan script tersebut sebagai Web App untuk mendapatkan URL Webhook.
3. Salin URL Webhook tersebut dan masukkan ke dalam menu Pengaturan (Settings) di aplikasi MyTea POS pada masing-masing perangkat cabang agar fitur 'Sinkronkan Data' dapat bekerja.

Proyek ini dibangun dalam jangka waktu 10 minggu sebagai pemenuhan Tugas Akhir  Mata Kuliah **Capstone 2**.



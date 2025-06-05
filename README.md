# ST4Bot-Whatsapp | WhatsApp Bot dengan Gemini AI dan Jadwal Sholat

Bot WhatsApp ini memiliki fitur untuk berinteraksi dengan Google Gemini AI, menampilkan jadwal sholat, fitur AFK, pesan terjadwal, dan lainnya.

## Prasyarat

Sebelum menjalankan bot, pastikan Anda telah menginstal:

* **Node.js:** [Unduh dan instal Node.js](https://nodejs.org/) (disarankan untuk menggunakan versi LTS).
* **npm (Node Package Manager):** npm biasanya sudah terpasang secara otomatis saat Anda menginstal Node.js.

## Setup

Berikut adalah langkah-langkah untuk menyiapkan dan menjalankan bot:

1.  **Buat Direktori Proyek (Opsional):**
    ```bash
    mkdir nama_bot_whatsapp
    cd nama_bot_whatsapp
    ```
    Ganti `nama_bot_whatsapp` dengan nama yang Anda inginkan untuk proyek Anda.

2.  **Simpan File Bot:**
    * Buat file bernama `index.js` dan salin kode bot WhatsApp Anda ke dalamnya.
    * Buat file bernama `config.js` dan isi dengan konfigurasi bot Anda. Contoh `config.js`:
        ```javascript
        /**
         * Konfigurasi untuk bot WhatsApp ini.
         */
        const config = {
          /**
           * Daftar JID (Nomor WhatsApp dengan format @s.whatsapp.net) dari pemilik bot.
           * Hanya pemilik yang memiliki akses penuh ke semua perintah admin.
           * Contoh: ['628xxxxxxxxxx@s.whatsapp.net']
           */
          ownerJids: ['YOUR_OWNER_JID@s.whatsapp.net'],

          /**
           * Daftar JID dari grup yang diizinkan untuk menggunakan bot (opsional).
           * Jika diisi, bot hanya akan merespons pesan dari chat pribadi atau grup yang ada di daftar ini (dan pemilik).
           * Contoh: ['12036xxxxxxxxxxxxx@g.us']
           */
          allowedGroupJids: [],

          /**
           * JID admin untuk menerima notifikasi penting dari bot (opsional).
           * Contoh: '628zzzzzzzzzzz@s.whatsapp.net'
           */
          adminJidForNotifications: 'YOUR_ADMIN_JID@s.whatsapp.net',

          /**
           * Kunci API untuk mengakses Google Gemini AI.
           * Anda perlu mendapatkan kunci API dari Google Cloud Platform.
           * Lihat: [https://makersuite.google.com/](https://makersuite.google.com/)
           */
          geminiApiKey: 'YOUR_GEMINI_API_KEY',

          /**
           * Versi model Gemini yang akan digunakan.
           * Contoh: 'gemini-pro'
           */
          geminiModelVersion: 'gemini-pro',

          /**
           * Lokasi default untuk mendapatkan jadwal sholat jika pengguna tidak menentukan kota dan negara.
           */
          defaultPrayerLocation: {
            city: 'Medan',
            country: 'Indonesia'
          },

          /**
           * JID atau daftar JID yang akan menerima notifikasi sholat harian secara default (deprecated, lebih baik gunakan perintah /pengingatsholat di chat).
           */
          prayerNotificationJid: [],

          /**
           * Daftar sapaan (huruf kecil) dan respons yang sesuai.
           */
          greetings: {
            'halo': 'Halo! Ada yang bisa saya bantu?',
            'hai': 'Hai juga! 👋',
            'selamat pagi': 'Selamat pagi! Semoga harimu menyenangkan.',
            'assalamualaikum': 'Waalaikumsalam warahmatullahi wabarakatuh.',
            'salam': 'Salam sejahtera! 🙏'
          },

          /**
           * Informasi kontak bot.
           */
          contactInfo: {
            whatsappAdmin: 'Nomor WhatsApp Admin (Contoh: +62 8xxxxxxxxxx)',
            telegram: 'Link Telegram Admin (Contoh: t.me/username)',
            email: 'Alamat Email Admin (Contoh: admin@example.com)',
            website: 'Alamat Website (Contoh: example.com)'
          }
        };

        module.exports = config;
        ```
        **Pastikan untuk mengganti nilai-nilai placeholder (seperti `YOUR_OWNER_JID@s.whatsapp.net`, `YOUR_GEMINI_API_KEY`, dll.) dengan informasi yang benar.**

3.  **Instal Dependensi:**
    Buka terminal atau command prompt di dalam direktori proyek Anda dan jalankan perintah berikut:
    ```bash
    npm install @whiskeysockets/baileys @hapi/boom qrcode-terminal pino fs fluent-ffmpeg ffmpeg-static axios node-schedule @google/generative-ai
    ```
    Ini akan menginstal modul-modul berikut yang dibutuhkan bot:
    * `@whiskeysockets/baileys`: Library utama untuk koneksi WhatsApp.
    * `@hapi/boom`: Utilitas untuk error HTTP.
    * `qrcode-terminal`: Menampilkan kode QR di terminal.
    * `pino`: Logger untuk aplikasi Node.js.
    * `fs`: Modul bawaan Node.js untuk sistem file.
    * `fluent-ffmpeg`: Untuk manipulasi audio dan video (meskipun tidak semua fitur digunakan).
    * `ffmpeg-static`: Menyediakan path ke `ffmpeg` executable.
    * `axios`: Untuk membuat permintaan HTTP (digunakan untuk jadwal sholat).
    * `node-schedule`: Untuk penjadwalan tugas (notifikasi sholat, pesan terjadwal).
    * `@google/generative-ai`: Untuk integrasi dengan Google Gemini AI.

## Menjalankan Bot

1.  **Jalankan Perintah:**
    Di terminal atau command prompt, pastikan Anda berada di direktori proyek dan jalankan perintah:
    ```bash
    node index.js
    ```

2.  **Pindai Kode QR:**
    Kode QR akan muncul di terminal. Buka WhatsApp di ponsel Anda, pilih **WhatsApp Web/Desktop** atau **Perangkat tertaut**, dan pindai kode QR tersebut.

3.  **Bot Berjalan:**
    Setelah berhasil dipindai, bot akan terhubung dan Anda akan melihat pesan `Opened connection` di terminal. Anda sekarang dapat berinteraksi dengan bot melalui chat WhatsApp Anda.

## Catatan Penting

* Bot memerlukan koneksi internet yang stabil agar dapat terus berjalan.
* Jangan menutup jendela terminal atau command prompt saat bot sedang aktif.
* Jika terjadi masalah autentikasi atau koneksi terputus, Anda mungkin perlu menghapus folder `baileys_auth_info` yang dibuat oleh bot dan memindai kode QR lagi.

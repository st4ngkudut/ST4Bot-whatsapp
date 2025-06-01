# ST4Bot-whatsapp
Gemini AI bot di whatsapp

# WhatsApp Bot dengan Gemini AI dan Stiker

Bot WhatsApp ini memiliki berbagai fitur, termasuk integrasi dengan Google Gemini untuk menjawab pertanyaan, kemampuan membuat dan memanipulasi stiker, kontrol admin, dan lainnya.

## Fitur Utama

* **🤖 AI Chatting (Gemini):** Tanyakan pertanyaan apa saja dan bot akan mencoba menjawabnya menggunakan Google Gemini AI. Gunakan perintah `!ask <pertanyaan>`.
* **🛡️ Kontrol Admin:** Admin yang terdaftar dapat mengaktifkan dan menonaktifkan bot menggunakan perintah `!bot on` dan `!bot off`.
* **✨ Stiker:**
    * Otomatis membuat stiker dari gambar, video, dan GIF yang dikirim.
    * Membuat stiker dengan mengirim gambar/video/GIF dengan caption `!sticker`.
    * Membuat stiker dengan membalas gambar/video/GIF dengan perintah `!sticker`.
    * Mengubah stiker menjadi gambar dengan membalas stiker menggunakan perintah `!image`.
* **🖼️ Lainnya:**
    * Mengirim pesan "pong" dengan perintah `!ping` (khusus admin).
    * Menampilkan daftar perintah bot dengan perintah `!menu`.

## Prasyarat

Sebelum Anda dapat menjalankan bot ini, Anda perlu memastikan bahwa Anda memiliki:

* **Node.js** (versi LTS direkomendasikan): Unduh dan instal dari [situs resmi Node.js](https://nodejs.org/).
* **npm** (biasanya terinstal dengan Node.js) atau **yarn**: Jika Anda lebih suka menggunakan yarn, instal dengan `npm install -g yarn`.
* **Akun Google Cloud:** Anda memerlukan **API key Google Gemini**. Buat proyek di [Google Cloud AI Platform](https://console.cloud.google.com/vertex-ai/generative/language) dan dapatkan API key.

## Instalasi

Berikut adalah langkah-langkah untuk menginstal dan menjalankan bot ini:

1.  **Clone Repository (opsional):** Jika Anda menghosting kode ini di GitHub, clone repository ke komputer atau server Anda:
    ```bash
    git clone <URL_REPOSITORY_ANDA>
    cd <NAMA_FOLDER_REPOSITORY>
    ```

2.  **Konfigurasi File `.env`:**
    * Buat file bernama `.env` di direktori project Anda.
    * Tambahkan informasi berikut ke dalam file `.env`, ganti nilai dengan informasi Anda:
        ```dotenv
        GOOGLE_API_KEY=YOUR_GOOGLE_GEN_AI_API_KEY
        ADMIN_NUMBERS=YOUR_ADMIN_PHONE_NUMBER,ANOTHER_ADMIN_PHONE_NUMBER
        BOT_NUMBER=YOUR_BOT_PHONE_NUMBER
        GEMINI_MODEL=gemini-pro
        PORT=3000
        ```
        Pastikan Anda mengganti `YOUR_...` dengan nilai yang sesuai.

3.  **Konfigurasi File `config/config.json`:**
    * Buat folder bernama `config` di direktori project Anda jika belum ada.
    * Di dalam folder `config`, buat file bernama `config.json`.
    * Tambahkan konfigurasi berikut, sesuaikan sesuai keinginan Anda:
        ```json
        {
            "name": "NamaBotAnda",
            "author": "AuthorAnda",
            "prefix": "!",
            "timezone": "Asia/Jakarta",
            "groups": true,
            "log": true
        }
        ```

4.  **Instal Dependensi:**
    * Navigasi ke direktori project di terminal Anda.
    * Jalankan perintah berikut untuk menginstal semua dependensi:
        ```bash
        npm install
        ```
        atau jika Anda menggunakan yarn:
        ```bash
        yarn install
        ```

## Menjalankan Bot

Ada dua cara utama untuk menjalankan bot ini:

### Menggunakan Node.js

1.  Di terminal Anda, pastikan Anda berada di direktori project bot.
2.  Jalankan perintah:
    ```bash
    node bot.js
    ```

### Menggunakan PM2 (Direkomendasikan untuk produksi)

1.  Jika Anda belum menginstal PM2, instal secara global: `npm install pm2 -g` atau `yarn global add pm2`.
2.  Jalankan bot dengan PM2:
    ```bash
    pm2 start bot.js --name whatsapp-bot
    ```
3.  Untuk melihat status bot: `pm2 status`.
4.  Untuk melihat log bot: `pm2 logs whatsapp-bot`.
5.  Untuk mengaktifkan restart otomatis saat server reboot: `pm2 startup` (ikuti instruksi yang diberikan), lalu `pm2 save`.

## Penggunaan Perintah

Berikut adalah daftar perintah yang dapat Anda gunakan setelah bot berjalan:

* `!menu`: Menampilkan daftar perintah bot.
* `!ask <pertanyaan>`: Ajukan pertanyaan kepada Gemini AI.
* `!ping`: Mengirim pesan "pong" (khusus admin).
* `!bot on` (admin): Mengaktifkan bot.
* `!bot off` (admin): Menonaktifkan bot.
* Kirim gambar/video/GIF: Akan otomatis diubah menjadi stiker.
* Kirim gambar/video/GIF dengan caption `!sticker`: Mengubah media menjadi stiker.
* Balas gambar/video/GIF dengan `!sticker`: Mengubah media yang dibalas menjadi stiker.
* Balas stiker dengan `!image`: Mengubah stiker menjadi gambar.

## Kontribusi

Anda dipersilakan untuk berkontribusi pada project ini. Fork repository dan buat pull request dengan perubahan yang Anda ajukan.

## Lisensi

[MIT](LICENSE) - Anda dapat menambahkan informasi lisensi di sini jika Anda memilikinya.

---

Pastikan untuk mengganti `<URL_REPOSITORY_ANDA>` dan `<NAMA_FOLDER_REPOSITORY>` dengan informasi yang sesuai untuk project Anda. Anda juga dapat menyesuaikan bagian fitur dan penggunaan perintah sesuai dengan perkembangan bot Anda.

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
   * Lihat: https://makersuite.google.com/
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

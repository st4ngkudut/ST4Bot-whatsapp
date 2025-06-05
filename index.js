const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    // downloadContentFromMessage // Diimpor tapi tidak digunakan dalam kode yang diberikan. Pertimbangkan untuk menghapus jika tidak digunakan.
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
// const path = require('path'); // Diimpor tapi tidak digunakan. Pertimbangkan untuk menghapus jika tidak digunakan.
const fs = require('fs');
// const sharp = require('sharp'); // Diimpor tapi tidak digunakan. Pertimbangkan untuk menghapus jika tidak digunakan.
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const axios = require('axios');
const schedule = require('node-schedule');

// ===============================================================
// Impor konfigurasi dari file config.js
const config = require('./config');
// ===============================================================

// Impor dan Inisialisasi Gemini AI
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
// ===============================================================
// Menggunakan versi model dari config.js
const model = genAI.getGenerativeModel({ model: config.geminiModelVersion });
// ===============================================================

ffmpeg.setFfmpegPath(ffmpegStatic);

// --- Variabel Global untuk Fitur AFK ---
let isAfk = false; // Status AFK bot
let afkMessage = ""; // Pesan AFK yang akan dikirim
let afkStartTime = null; // Waktu saat mode AFK diaktifkan
let afkReason = ""; // Alasan AFK spesifik
let defaultAfkMessage = "Mohon maaf, saat ini saya sedang tidak aktif."; // Pesan AFK default
// --- Trigger untuk mematikan mode AFK (Anda bisa memindahkannya ke config.js jika diinginkan) ---
const AFK_OFF_TRIGGER = "/kembali"; // Ganti dengan trigger yang Anda inginkan

// ownerJids sekarang diambil dari config
const ownerJids = config.ownerJids;

// --- Variabel Global untuk Jadwal Sholat ---
let currentPrayerJobs = {}; // Objek untuk menyimpan job scheduler sholat

// --- Variabel Global untuk Pesan Terjadwal ---
const scheduledMessages = {}; // Objek untuk menyimpan pesan yang dijadwalkan (sementara, tidak persisten)
const dailyScheduledMessages = {}; // Objek untuk menyimpan pesan yang dijadwalkan harian

// --- Variabel Global untuk Fitur On/Off Bot ---
let isBotEnabled = true; // Status bot, true = aktif, false = non-aktif

// --- Variabel Global untuk Cek Info Pengguna ---
const cekInfoQueue = {}; // Objek untuk menyimpan permintaan cek info

/**
 * @function cleanUpFiles
 * @description Menghapus file-file yang diberikan dari sistem file jika ada.
 * @param {...string} files - Daftar path file yang akan dihapus.
 */
const cleanUpFiles = (...files) => {
    files.forEach(file => {
        if (file && fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`Cleaned up: ${file}`);
        }
    });
};

/**
 * @async
 * @function getPrayerTimes
 * @description Mengambil jadwal waktu sholat untuk kota dan negara yang ditentukan menggunakan Aladhan API.
 * @param {string} city - Nama kota untuk mencari jadwal sholat.
 * @param {string} country - Kode negara (misalnya, 'ID' untuk Indonesia).
 * @returns {Promise<object|null>} - Objek berisi waktu sholat jika berhasil, null jika gagal.
 */
async function getPrayerTimes(city, country) {
    try {
        // Aladhan API 'timingsByCity' endpoint dapat langsung mengambil timestamp untuk hari ini.
        // Tidak perlu mengekstrak tahun, bulan, hari secara eksplisit untuk panggilan API ini.
        // 'Math.floor(Date.now() / 1000)' menyediakan timestamp saat ini dalam detik, sesuai kebutuhan API.
        const url = `http://api.aladhan.com/v1/timingsByCity/${Math.floor(Date.now() / 1000)}?city=${city}&country=${country}&method=2`; // method=2 (ISNA)

        console.log(`Fetching prayer times from: ${url}`);
        const response = await axios.get(url);

        if (response.data && response.data.data) {
            console.log(`Prayer times fetched for ${city}, ${country}:`, response.data.data.timings);
            return response.data.data.timings;
        }
        return null;
    } catch (error) {
        console.error('Error fetching prayer times:', error.message);
        // Jika `sock` tidak tersedia secara global di sini, Anda perlu meneruskannya sebagai argumen,
        // atau mengembalikan error dan menanganinya di fungsi pemanggil (`scheduleDailyPrayerNotifications`).
        // Untuk saat ini, diasumsikan `sock` mungkin tersedia secara global setelah `connectToWhatsApp`.
        if (config.adminJidForNotifications) {
            // await sock.sendMessage(config.adminJidForNotifications, { text: `Error fetching prayer times for ${city}, ${country}: ${error.message}` });
        }
        return null;
    }
}

/**
 * @async
 * @function schedulePrayerNotifications
 * @description Menjadwalkan notifikasi harian untuk setiap waktu sholat ke target JID yang ditentukan.
 * @param {object} sockInstance - Instance dari socket WhatsApp untuk mengirim pesan.
 * @param {string} targetJid - JID (user atau group) yang akan menerima notifikasi.
 */
async function schedulePrayerNotifications(sockInstance, targetJid) {
    if (typeof targetJid !== 'string') {
        console.error('Error: targetJid bukan string:', targetJid);
        if (config.adminJidForNotifications) {
            await sockInstance.sendMessage(config.adminJidForNotifications, { text: `Error: targetJid untuk notifikasi sholat bukan string. Nilai: ${targetJid}` });
        }
        return; // Hentikan fungsi jika targetJid bukan string
    }

    // Batalkan semua job yang sudah ada sebelumnya untuk target JID ini (jika ada)
    for (const jobName in currentPrayerJobs) {
        if (jobName.startsWith(`prayer-${targetJid}-`)) {
            currentPrayerJobs[jobName].cancel();
            console.log(`Cancelled existing prayer job: ${jobName}`);
            delete currentPrayerJobs[jobName];
        }
    }

    const { city, country } = config.defaultPrayerLocation;
    const prayerTimes = await getPrayerTimes(city, country);

    if (!prayerTimes) {
        const errorMessage = `Gagal mendapatkan jadwal sholat untuk ${city}, ${country}. Notifikasi sholat tidak dijadwalkan untuk ${targetJid}.`;
        console.error(errorMessage);
        console.log(`[schedulePrayerNotifications] Error sending message (prayerTimes fail): targetJid - ${targetJid}`);
        if (config.adminJidForNotifications && config.adminJidForNotifications !== targetJid) { // Hindari mengirim error ke target yang sama
            await sockInstance.sendMessage(config.adminJidForNotifications, { text: errorMessage });
        } else if (targetJid) {
            await sockInstance.sendMessage(targetJid, { text: errorMessage });
        }
        return;
    }

    const today = new Date();
    const prayers = [
        { name: 'Subuh', time: prayerTimes.Fajr.split(' ')[0] },
        { name: 'Dzuhur', time: prayerTimes.Dhuhr.split(' ')[0] },
        { name: 'Ashar', time: prayerTimes.Asr.split(' ')[0] },
        { name: 'Maghrib', time: prayerTimes.Maghrib.split(' ')[0] },
        { name: 'Isya', time: prayerTimes.Isha.split(' ')[0] },
    ];

    console.log(`Scheduling prayer notifications for ${city}, ${country} to ${targetJid}...`);

    for (const prayer of prayers) {
        const [hours, minutes] = prayer.time.split(':').map(Number);
        // Untuk membuat pengingat harian, gunakan ekspresi cron.
        // Ini akan membuat job yang berjalan setiap hari pada waktu sholat yang ditentukan.
        const cronExpression = `${minutes} ${hours} * * *`; // Cron untuk setiap hari pada waktu tertentu

        const jobName = `prayer-${targetJid}-${prayer.name.toLowerCase()}`;
        const job = schedule.scheduleJob(jobName, cronExpression, async () => {
            const message = `🔔 *Waktu Sholat ${prayer.name} telah tiba!* 🔔\n\nYuk, segera tunaikan sholat. Semoga Allah menerima amal ibadah kita.`;
            console.log(`[schedulePrayerNotifications] Sending prayer notification for ${prayer.name} to ${targetJid}`);
            await sockInstance.sendMessage(targetJid, { text: message });
            console.log(`Sent prayer notification for ${prayer.name} to ${targetJid}`);
        });
        currentPrayerJobs[jobName] = job;
        console.log(`Scheduled ${prayer.name} notification daily at ${prayer.time} for ${targetJid}`);
    }

    console.log(`[schedulePrayerNotifications] Sending success message (chat): targetJid - ${targetJid}`);
    // Pesan sukses ini dikomentari, aktifkan jika diinginkan.
    // if (targetJid && config.adminJidForNotifications !== targetJid) {
    //     await sockInstance.sendMessage(targetJid, { text: `✅ Pengingat sholat harian telah diaktifkan untuk chat ini (${city}, ${country}).` });
    // } else if (config.adminJidForNotifications === targetJid) {
    //     console.log(`[schedulePrayerNotifications] Sending success message (admin): targetJid - ${targetJid}`);
    //     await sockInstance.sendMessage(config.adminJidForNotifications, { text: `✅ Pengingat sholat harian (default) telah diaktifkan untuk bot (${city}, ${country}).` });
    // }
}

/**
 * @async
 * @function scheduleDailyPrayerNotifications
 * @deprecated Fungsi ini sudah usang. Gunakan `schedulePrayerNotifications` secara langsung.
 * @description Menjadwalkan notifikasi harian untuk setiap waktu sholat berdasarkan lokasi default di konfigurasi (khusus untuk JID yang diatur di config).
 * @param {object} sockInstance - Instance dari socket WhatsApp untuk mengirim pesan.
 */
async function scheduleDailyPrayerNotifications(sockInstance) {
    console.warn("Fungsi scheduleDailyPrayerNotifications sudah deprecated. Gunakan schedulePrayerNotifications sebagai gantinya.");
    if (config.prayerNotificationJid && Array.isArray(config.prayerNotificationJid)) {
        for (const jid of config.prayerNotificationJid) { // Gunakan for...of untuk iterasi array
            await schedulePrayerNotifications(sockInstance, jid); // Await setiap panggilan untuk kontrol alur yang lebih baik
        }
    } else if (config.prayerNotificationJid) { // Tangani kasus JID tunggal jika bukan array
        await schedulePrayerNotifications(sockInstance, config.prayerNotificationJid);
    } else {
        console.warn('prayerNotificationJid tidak diatur di config. Notifikasi sholat tidak akan dikirim.');
        if (config.adminJidForNotifications) {
            await sockInstance.sendMessage(config.adminJidForNotifications, { text: 'Peringatan: `prayerNotificationJid` tidak diatur di `config.js`. Notifikasi sholat tidak akan dikirim (fungsi deprecated). Gunakan perintah `/pengingatsholat` di chat yang diinginkan.' });
        }
    }
}


/**
 * @async
 * @function scheduleMessage
 * @description Menjadwalkan pesan untuk dikirim pada waktu yang ditentukan.
 * @param {object} sockInstance - Instance dari socket WhatsApp untuk mengirim pesan.
 * @param {string} senderJid - JID pengirim perintah.
 * @param {string} message - Teks lengkap pesan yang berisi perintah dan detail penjadwalan (format: /schedule [YYYY-MM-DD HH:mm] [JID Penerima] [Isi Pesan]).
 */
async function scheduleMessage(sockInstance, senderJid, message) {
    const parts = message.split(' ');
    // Perintah yang diharapkan adalah '/schedule', bukan '/sholat'.
    // Pastikan deskripsi format cocok dengan penggunaan aktual.
    if (parts.length < 5) {
        return await sockInstance.sendMessage(senderJid, { text: 'Format perintah salah. Gunakan: */schedule [YYYY-MM-DD HH:mm] [JID Penerima] [Isi Pesan]*' });
    }

    const dateTimeStr = parts[1] + ' ' + parts[2];
    const recipientJid = parts[3];
    const messageContent = parts.slice(4).join(' ');

    const scheduledTime = new Date(dateTimeStr);

    if (isNaN(scheduledTime.getTime())) { // Gunakan getTime() untuk pemeriksaan validitas tanggal yang lebih kuat
        return await sockInstance.sendMessage(senderJid, { text: 'Format tanggal dan waktu tidak valid. Gunakan format:YYYY-MM-DD HH:mm' });
    }

    if (scheduledTime <= new Date()) {
        return await sockInstance.sendMessage(senderJid, { text: 'Waktu yang dijadwalkan harus di masa depan.' });
    }

    const jobId = Date.now().toString(); // Membuat ID unik untuk job ini
    scheduledMessages[jobId] = schedule.scheduleJob(scheduledTime, async () => {
        try {
            await sockInstance.sendMessage(recipientJid, { text: messageContent });
            await sockInstance.sendMessage(senderJid, { text: `Pesan terjadwal berhasil dikirim ke ${recipientJid} pada ${new Date().toLocaleString()}` });
            delete scheduledMessages[jobId]; // Hapus job setelah selesai
            console.log(`Pesan terjadwal berhasil dikirim ke ${recipientJid}`);
        } catch (error) {
            console.error('Gagal mengirim pesan terjadwal:', error);
            await sockInstance.sendMessage(senderJid, { text: `Gagal mengirim pesan terjadwal ke ${recipientJid}. Error: ${error.message}` });
        }
    });

    await sockInstance.sendMessage(senderJid, { text: `Pesan Anda akan dijadwalkan untuk dikirim ke ${recipientJid} pada ${scheduledTime.toLocaleString()}.` });
    console.log(`Pesan dijadwalkan untuk ${recipientJid} pada ${scheduledTime.toLocaleString()}`);
}

/**
 * @async
 * @function scheduleDailyMessage
 * @description Menjadwalkan pesan untuk dikirim setiap hari pada waktu yang ditentukan.
 * @param {object} sockInstance - Instance dari socket WhatsApp untuk mengirim pesan.
 * @param {string} senderJid - JID pengirim perintah.
 * @param {string} message - Teks lengkap pesan yang berisi perintah dan detail penjadwalan harian (format: /dailyschedule [HH:mm] [JID Penerima] [Isi Pesan]).
 */
async function scheduleDailyMessage(sockInstance, senderJid, message) {
    const parts = message.split(' ');
    if (parts.length < 4) {
        return await sockInstance.sendMessage(senderJid, { text: 'Format perintah salah. Gunakan: */dailyschedule [HH:mm] [JID Penerima] [Isi Pesan]*' });
    }

    const timeStr = parts[1];
    const recipientJid = parts[2];
    const messageContent = parts.slice(3).join(' ');

    const [hours, minutes] = timeStr.split(':').map(Number);

    if (isNaN(hours) || hours < 0 || hours > 23 || isNaN(minutes) || minutes < 0 || minutes > 59) {
        return await sockInstance.sendMessage(senderJid, { text: 'Format waktu tidak valid. Gunakan format HH:mm (contoh: 09:30 atau 17:00)' });
    }

    const cronExpression = `${minutes} ${hours} * * *`; // Cron untuk setiap hari pada waktu tertentu

    const jobId = `daily-${Date.now()}`;
    dailyScheduledMessages[jobId] = schedule.scheduleJob(cronExpression, async () => {
        try {
            await sockInstance.sendMessage(recipientJid, { text: messageContent });
            console.log(`Pesan harian terjadwal berhasil dikirim ke ${recipientJid} pada ${new Date().toLocaleTimeString()}`);
        } catch (error) {
            console.error('Gagal mengirim pesan harian terjadwal:', error);
            // Sebaiknya beri tahu pengirim/admin jika pesan harian gagal.
            // Namun, untuk pesan harian, mengirim pesan error *setiap* kali gagal bisa menjadi spam.
            // Pertimbangkan untuk mencatat error atau mengirim notifikasi hanya ke admin jika itu kritis.
            // await sockInstance.sendMessage(senderJid, { text: `Gagal mengirim pesan harian terjadwal ke ${recipientJid}. Error: ${error.message}` });
        }
    });

    await sockInstance.sendMessage(senderJid, { text: `Pesan harian Anda akan dijadwalkan untuk dikirim ke ${recipientJid} setiap hari pada pukul ${timeStr}.` });
    console.log(`Pesan harian dijadwalkan untuk ${recipientJid} setiap hari pada pukul ${timeStr}`);
}


/**
 * @async
 * @function connectToWhatsApp
 * @description Menghubungkan ke WhatsApp menggunakan library baileys dan menangani berbagai event koneksi dan pesan.
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
    const { version } = await fetchLatestBaileysVersion();
    console.log(`Using Baileys version: ${version}`);

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Bot WhatsApp', 'Desktop', '3.0']
    });

    /**
     * @event connection.update
     * @description Menangani pembaruan status koneksi WhatsApp (misalnya, kode QR, koneksi terputus, terbuka).
     */
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.badAuth || reason === DisconnectReason.loggedOut) {
                console.log('Bad Auth Token or Logged Out. Please Delete Session and Scan Again.');
                fs.rmSync('baileys_auth_info', { recursive: true, force: true });
                connectToWhatsApp();
            } else if ([
                DisconnectReason.connectionClosed,
                DisconnectReason.connectionLost,
                DisconnectReason.connectionSuperseded,
                DisconnectReason.restartRequired,
                DisconnectReason.timedOut
            ].includes(reason)) {
                console.log('Connection closed/lost/restart required/timed out. Reconnecting....');
                connectToWhatsApp();
            } else {
                console.log('Unknown DisconnectReason: ' + reason);
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
            // --- JADWALKAN NOTIFIKASI SHOLAT SAAT KONEKSI TERBUKA (DEFAULT) ---
            // Disarankan untuk memanggil `schedulePrayerNotifications` secara langsung untuk setiap JID
            // yang ingin Anda aktifkan, daripada mengandalkan `scheduleDailyPrayerNotifications` yang sudah usang.
            // Contoh:
            // if (config.prayerNotificationJid) {
            //     if (Array.isArray(config.prayerNotificationJid)) {
            //         for (const jid of config.prayerNotificationJid) {
            //             await schedulePrayerNotifications(sock, jid);
            //         }
            //     } else {
            //         await schedulePrayerNotifications(sock, config.prayerNotificationJid);
            //     }
            // }
            await scheduleDailyPrayerNotifications(sock); // Ini akan menangani penjadwalan awal
            // Log JID bot setelah koneksi berhasil
            console.log('Bot JID:', sock.user.id);
            // --- SEND INITIAL NOTIFICATION ---
            if (config.adminJidForNotifications) {
                await sock.sendMessage(config.adminJidForNotifications, { text: '✅ Bot is online!' });
                console.log(`[NOTIFICATION] Sent "Bot is online!" to ${config.adminJidForNotifications}`);
            }
        }
    });

    /**
     * @event messages.upsert
     * @description Menangani pesan masuk, memproses perintah, dan merespons.
     */
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (msg.key.remoteJid !== 'status@broadcast' && msg.message) {
            const senderJid = msg.key.remoteJid;
            // Dapatkan teks pesan dari extendedTextMessage (untuk balasan) atau conversation (untuk pesan langsung)
            const messageText = msg.message.extendedTextMessage?.text || msg.message.conversation || '';
            const isOwner = config.ownerJids.includes(senderJid); // Mengambil dari config.ownerJids

            // Menentukan apakah pesan berasal dari chat pribadi
            const isPrivateChat = senderJid.endsWith('@s.whatsapp.net');
            // Menentukan apakah pesan berasal dari grup yang diizinkan
            const isInAllowedGroup = config.allowedGroupJids.includes(senderJid); // Mengambil dari config.allowedGroupJids
            // Menentukan apakah bot harus memproses pesan ini
            const shouldProcess = isPrivateChat || isInAllowedGroup || isOwner; // Owner selalu bisa akses

            const timestamp = new Date().toLocaleTimeString();
            console.log(`[IN] ${timestamp} | Dari: ${senderJid} | Teks: ${messageText} | Owner: ${isOwner} | Proses: ${shouldProcess}`);

            // --- Fitur On/Off Bot ---
            if (!isBotEnabled && !isOwner && !messageText.toLowerCase().startsWith('/boton')) {
                // Jika bot dinonaktifkan dan pengirim bukan owner, dan ini bukan perintah /boton, abaikan.
                return;
            }

            // --- Jika pesan tidak seharusnya diproses, hentikan di sini ---
            if (!shouldProcess) {
                console.log(`[INFO] ${timestamp} | Mengabaikan pesan dari ${senderJid} (bukan chat pribadi atau grup yang diizinkan).`);
                return;
            }

            const lowerCaseMessage = messageText.toLowerCase();

            // --- Fitur AFK (Away From Keyboard) ---
            // Logika AFK ini berlaku untuk semua, tetapi hanya owner yang bisa mengontrolnya
            if (lowerCaseMessage.startsWith('/afk')) {
                if (isOwner) { // Hanya owner yang bisa mengaktifkan/menonaktifkan AFK
                    const parts = messageText.split(' ');
                    // Jika ada alasan setelah /afk
                    if (parts.length > 1) {
                        isAfk = true;
                        afkStartTime = Date.now();
                        afkReason = parts.slice(1).join(' ');
                        afkMessage = `Mohon maaf, saat ini saya sedang tidak aktif. Alasan: ${afkReason}.`;
                        await sock.sendMessage(senderJid, { text: `Mode AFK diaktifkan: ${afkMessage}` });
                        console.log(`[AFK] ${timestamp} | Diaktifkan | Alasan: ${afkReason}`);
                    } else { // Jika hanya /afk tanpa alasan, gunakan pesan default
                        isAfk = true;
                        afkStartTime = Date.now();
                        afkReason = "Tidak ada alasan spesifik."; // Atur alasan default
                        afkMessage = `${defaultAfkMessage}`; // Gunakan pesan default
                        await sock.sendMessage(senderJid, { text: `Mode AFK diaktifkan: ${afkMessage}` });
                        console.log(`[AFK] ${timestamp} | Diaktifkan | Alasan: Default`);
                    }
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }
            // Perintah untuk melihat status AFK
            else if (lowerCaseMessage === '/statusafk') {
                if (isOwner) {
                    if (isAfk) {
                        const durationAfkMinutes = afkStartTime ? Math.floor((Date.now() - afkStartTime) / (1000 * 60)) : 0;
                        await sock.sendMessage(senderJid, { text: `Bot sedang dalam mode AFK.\nAlasan: ${afkReason}\nSejak: ${durationAfkMinutes} menit yang lalu.` });
                    } else {
                        await sock.sendMessage(senderJid, { text: 'Bot tidak sedang dalam mode AFK.' });
                    }
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }
            // Perintah untuk mematikan AFK
            else if (lowerCaseMessage === AFK_OFF_TRIGGER.toLowerCase()) {
                if (isOwner && isAfk) {
                    isAfk = false;
                    afkReason = "";
                    afkStartTime = null;
                    await sock.sendMessage(senderJid, { text: 'Mode AFK dinonaktifkan. Bot kembali aktif.' });
                    console.log(`[AFK] ${timestamp} | Dinonaktifkan | Owner: ${senderJid}`);
                } else if (isOwner && !isAfk) {
                    await sock.sendMessage(senderJid, { text: 'Bot saat ini tidak dalam mode AFK.' });
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }

            // --- Logika Deteksi dan Respon AFK untuk PENGGUNA LAIN ---
            // Ini akan merespons setiap orang yang bukan owner saat AFK aktif
            // DAN HANYA JIKA PESAN DITERIMA DI CHAT PRIBADI
            if (isAfk && !isOwner && !msg.key.fromMe && isPrivateChat) { // Tambahkan isPrivateChat di sini
                const durationAfkMinutes = afkStartTime ? Math.floor((Date.now() - afkStartTime) / (1000 * 60)) : 0;
                const timeAfk = ` (AFK sejak ${durationAfkMinutes} menit yang lalu)`;
                await sock.sendMessage(senderJid, { text: afkMessage + timeAfk }, { quoted: msg });
                return; // Penting: Hentikan pemrosesan lebih lanjut
            }

            const greetings = config.greetings;
            if (greetings && greetings[lowerCaseMessage]) {
                await sock.sendMessage(senderJid, { text: greetings[lowerCaseMessage] });
            } else if (lowerCaseMessage === 'menu' || lowerCaseMessage === 'help') {
                let adminCommands = `
*Perintah Admin:*
 - */afk [alasan]*: Mode AFK
 - */statusafk:* Status AFK
 - *${AFK_OFF_TRIGGER}:* Nonaktifkan AFK
 - */cekinfo [balas pesan/JID]:* Info pengguna
 - */boton:* Aktifkan bot
 - */botoff:* Nonaktifkan bot
 - */schedule [YYYY-MM-DD HH:mm] [JID] [Pesan]*
 - */dailyschedule [HH:mm] [JID] [Pesan]*
`;
                // Tambahkan pemeriksaan isOwner sebelum menampilkan perintah admin kepada non-owner.
                if (!isOwner) {
                    adminCommands = "\n(Fitur Admin: Tersedia untuk pemilik bot)";
                }

                await sock.sendMessage(senderJid, { text: `✨ *Menu Bot* ✨

*Perintah Pengguna:*
 - *Sapaan:* halo, hai, salam, dll.
 - *Menu/Help:* Tampilkan menu
 - *Info:* Informasi bot
 - *Ping:* Cek latensi
 - */gemini [pertanyaan]*: Tanya AI
 - */sholat [kota], [negara]*: Jadwal sholat
 - */pengingatsholat:* Aktifkan pengingat sholat

${adminCommands}` });
            } else if (lowerCaseMessage === 'info') {
                // Menggunakan informasi kontak dari config.js
                await sock.sendMessage(senderJid, { text: `👋 *Info Bot Kami* 👋\n\nAdmin: ${config.contactInfo.whatsappAdmin}\nTelegram: ${config.contactInfo.telegram}\nEmail: ${config.contactInfo.email}\nWebsite: ${config.contactInfo.website}` });
            }
            else if (lowerCaseMessage === 'ping') {
                const startTime = Date.now();
                await sock.sendMessage(senderJid, { text: 'Pong!' });
                const endTime = Date.now();
                await sock.sendMessage(senderJid, { text: `Latensi: ${endTime - startTime} ms` });
            }
            // --- FUNGSI GEMINI AI ---
            else if (lowerCaseMessage.startsWith('/gemini ')) {
                const query = messageText.substring('/gemini '.length).trim();
                if (query) {
                    await sock.sendMessage(senderJid, { text: '🔍 Sedang berpikir... Mohon tunggu sebentar.' });
                    try {
                        const result = await model.generateContent(query);
                        const response = await result.response;
                        const text = response.text();
                        await sock.sendMessage(senderJid, { text: `*Respon dari Gemini AI:*\n\n${text}` });
                    } catch (error) {
                        console.error('Error calling Gemini AI:', error);
                        if (error.response && error.response.status === 429) {
                            await sock.sendMessage(senderJid, { text: 'Maaf, saya terlalu banyak menerima permintaan. Coba lagi sebentar lagi.' });
                        } else if (error.message.includes('API key not valid')) {
                            await sock.sendMessage(senderJid, { text: 'Maaf, API Key Gemini AI tidak valid atau belum diatur. Mohon cek konfigurasi bot.' });
                        } else if (error.response && error.response.status === 404) { // Periksa error.response.status untuk error Axios
                            await sock.sendMessage(senderJid, { text: 'Maaf, terjadi masalah koneksi dengan layanan Gemini AI (Endpoint tidak ditemukan). Pastikan API Key Anda benar dan model tersedia.' });
                        }
                        else {
                            await sock.sendMessage(senderJid, { text: 'Maaf, terjadi kesalahan saat menghubungi Gemini AI. Silakan coba lagi nanti.' });
                        }
                    }
                } else {
                    await sock.sendMessage(senderJid, { text: 'Mohon sertakan pertanyaan Anda setelah */gemini*. Contoh: */gemini Siapa penemu lampu?*' });
                }
            }
            // --- FUNGSI JADWAL SHOLAT (Mendapatkan dan Menampilkan) ---
            else if (lowerCaseMessage.startsWith('/sholat ')) {
                const query = messageText.substring('/sholat '.length).trim();
                const [city, country] = query.split(',').map(s => s.trim());

                if (city && country) {
                    await sock.sendMessage(senderJid, { text: `⏳ Mencari jadwal sholat untuk ${city}, ${country}...` });
                    const prayerTimes = await getPrayerTimes(city, country);
                    if (prayerTimes) {
                        const message = `*Jadwal Sholat untuk ${city}, ${country} Hari Ini:*\n\n` +
                                        `Subuh: ${prayerTimes.Fajr}\n` +
                                        `Dzuhur: ${prayerTimes.Dhuhr}\n` +
                                        `Ashar: ${prayerTimes.Asr}\n` +
                                        `Maghrib: ${prayerTimes.Maghrib}\n` +
                                        `Isya: ${prayerTimes.Isha}\n\n` +
                                        `_Sumber: Aladhan API_`;
                        await sock.sendMessage(senderJid, { text: message });
                    } else {
                        await sock.sendMessage(senderJid, { text: `Maaf, gagal mendapatkan jadwal sholat untuk ${city}, ${country}. Pastikan nama kota dan negara benar.` });
                    }
                } else {
                    await sock.sendMessage(senderJid, { text: 'Format perintah salah. Gunakan: */sholat [kota], [negara]*. Contoh: */sholat Jakarta, Indonesia*' });
                }
            }
            // --- FUNGSI PESAN TERJADWAL ---
            else if (lowerCaseMessage.startsWith('/schedule ')) {
                if (isOwner) { // Hanya owner yang bisa menjadwalkan pesan
                    await scheduleMessage(sock, senderJid, messageText);
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }
            // --- FUNGSI PESAN TERJADWAL HARIAN ---
            else if (lowerCaseMessage.startsWith('/dailyschedule')) {
                if (isOwner) { // Hanya owner yang bisa menjadwalkan pesan harian
                    await scheduleDailyMessage(sock, senderJid, messageText);
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }
            // --- FITUR PENGINGAT SHOLAT ---
            else if (lowerCaseMessage === '/pengingatsholat') {
                // Siapapun bisa mengaktifkan pengingat sholat untuk chat mereka
                await schedulePrayerNotifications(sock, senderJid);
                await sock.sendMessage(senderJid, { text: `✅ Pengingat sholat harian telah diaktifkan untuk chat ini (${config.defaultPrayerLocation.city}, ${config.defaultPrayerLocation.country}).` });
            }
            // --- FITUR CEK INFO PENGGUNA (KHUSUS PEMILIK) ---
            else if (lowerCaseMessage.startsWith('/cekinfo')) {
                if (isOwner) {
                    let targetJid;
                    // Periksa apakah perintah adalah balasan dari pesan lain
                    if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo && msg.message.extendedTextMessage.contextInfo.participant) {
                        targetJid = msg.message.extendedTextMessage.contextInfo.participant;
                    }
                    // Jika tidak ada balasan, periksa apakah JID diberikan langsung dalam perintah
                    else {
                        const parts = messageText.split(' ');
                        if (parts.length > 1 && parts[1].includes('@s.whatsapp.net')) {
                            targetJid = parts[1];
                        }
                    }

                    if (targetJid) {
                        try {
                            await sock.presenceSubscribe(targetJid); // Berlangganan kehadiran
                            cekInfoQueue[senderJid] = targetJid; // Simpan JID target untuk event pembaruan kehadiran
                            await sock.sendMessage(senderJid, { text: '⏳ Sedang mengambil info pengguna...' }, { quoted: msg });
                        } catch (error) {
                            console.error('Gagal mendapatkan info pengguna:', error);
                            await sock.sendMessage(senderJid, { text: 'Gagal mengambil info pengguna.', quoted: msg });
                        }
                    } else {
                        await sock.sendMessage(senderJid, { text: 'Balas pesan pengguna yang ingin Anda cek infonya, atau berikan JID pengguna. Contoh: */cekinfo 6281234567890@s.whatsapp.net*', quoted: msg });
                    }
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }
            // --- FITUR ON/OFF BOT (KHUSUS PEMILIK) ---
            else if (lowerCaseMessage === '/boton') {
                if (isOwner) {
                    isBotEnabled = true;
                    await sock.sendMessage(senderJid, { text: '✅ Bot diaktifkan kembali.' });
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, perintah ini hanya untuk pemilik bot.' });
                }
            } else if (lowerCaseMessage === '/botoff') {
                if (isOwner) {
                    isBotEnabled = false;
                    await sock.sendMessage(senderJid, { text: '❌ Bot dinonaktifkan.' });
                } else {
                    await sock.sendMessage(senderJid, { text: 'Maaf, fitur ini hanya untuk pemilik bot.' });
                }
            }
        }
    });

    /**
     * @event creds.update
     * @description Menyimpan kredensial autentikasi saat diperbarui.
     */
    sock.ev.on('creds.update', saveCreds);

    /**
     * @event presence.update
     * @description Menangani pembaruan kehadiran pengguna (online, offline, mengetik, merekam) dan merespons permintaan '/cekinfo'.
     */
    sock.ev.on('presence.update', async ({ id, presences }) => {
        // Periksa apakah ID ini adalah target dari antrian 'cekInfo'
        for (const requesterJid in cekInfoQueue) {
            if (cekInfoQueue[requesterJid] === id) {
                const presenceData = presences[id];
                let statusText = 'Tidak diketahui';
                if (presenceData) {
                    if (presenceData.lastKnownPresence === 'available') {
                        statusText = 'Online';
                    } else if (presenceData.lastKnownPresence === 'unavailable') {
                        statusText = 'Offline';
                    } else if (presenceData.lastKnownPresence === 'composing') {
                        statusText = 'Sedang mengetik...';
                    } else if (presenceData.lastKnownPresence === 'recording') {
                        statusText = 'Sedang merekam suara...';
                    }
                }

                // Coba ambil nama pengguna dari cache atau fetch
                let userName = id;
                try {
                    // Ambil info kontak lengkap (termasuk nama tampilan)
                    const contact = await sock.fetchContactById(id);
                    if (contact && contact.notify) {
                        userName = contact.notify; // Nama dari buku kontak
                    } else if (contact && contact.verifiedName) {
                        userName = contact.verifiedName; // Nama verifikasi bisnis
                    } else if (contact && contact.name) {
                        userName = contact.name; // Nama yang diatur sendiri oleh pengguna
                    }
                } catch (e) {
                    console.log(`Could not fetch contact name for ${id}: ${e.message}`);
                }

                await sock.sendMessage(requesterJid, {
                    text: `*Info Pengguna:*\n` +
                        `JID: ${id}\n` +
                        `Nama: ${userName}\n` +
                        `Status: ${statusText}`
                });
                delete cekInfoQueue[requesterJid]; // Hapus dari antrian setelah info dikirim
                break; // Keluar dari loop setelah menemukan dan memproses
            }
        }
    });
}

// Jalankan fungsi untuk menghubungkan ke WhatsApp
connectToWhatsApp();

// ===============================
// ARi4kaa_give - ГОТОВЫЙ TWITCH БОТ (ИСПРАВЛЕН)
// Функции:
// - Проверка пользователей (!check ник)
// - Лог чата
// - Тест команд (!ping, !testwin)
// - Подключение к нескольким каналам
// ===============================

require('dotenv').config();
const tmi = require('tmi.js');
const axios = require('axios');

// ================= НАСТРОЙКИ =================
const BOT_USERNAME = 'ari4kaa_give'; // ВАЖНО: lowercase!
const CHANNELS = ['ari4kaa', 'otoru_', 'csgopstv']; // каналы (всегда lowercase)

// из .env
const OAUTH = process.env.TWITCH_OAUTH; // oauth:xxxx
const CLIENT_ID = process.env.CLIENT_ID;
const APP_ACCESS_TOKEN = process.env.APP_ACCESS_TOKEN;

// база сообщений
const userStats = {};

// ================= TWITCH BOT =================
const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: BOT_USERNAME,
        password: OAUTH
    },
    channels: CHANNELS
});

client.connect().then(() => {
    console.log(`🤖 Бот ${BOT_USERNAME} подключен ко всем каналам`);
}).catch(console.error);

// ================= ОБРАБОТКА СООБЩЕНИЙ =================
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    const username = tags['display-name'];
    const userLogin = tags.username; // lowercase логин
    const channelName = channel.replace('#', '');

    console.log(`[${channelName}] ${username}: ${message}`);

    // ===== СТАТИСТИКА ПОЛЬЗОВАТЕЛЯ =====
    if (!userStats[userLogin]) {
        userStats[userLogin] = {
            totalMessages: 0,
            firstMessage: new Date(),
            channels: {}
        };
    }

    userStats[userLogin].totalMessages++;

    if (!userStats[userLogin].channels[channelName]) {
        userStats[userLogin].channels[channelName] = 0;
    }
    userStats[userLogin].channels[channelName]++;

    const msg = message.toLowerCase();

    // ================= КОМАНДЫ =================

    // ТЕСТ РАБОТЫ БОТА
    if (msg === '!ping') {
        client.say(channel, `@${username} бот работает ✅`);
        return;
    }

    // ТЕСТ ПОБЕДИТЕЛЯ
    if (msg === '!testwin') {
        client.say(channel, `🎉 @${username} ПОБЕДИЛ В РОЗЫГРЫШЕ!`);
        return;
    }

    // ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ
    if (msg.startsWith('!check')) {
        const args = msg.split(' ');
        const target = args[1];

        if (!target) {
            client.say(channel, '❗ Использование: !check ник');
            return;
        }

        await checkUser(channel, target);
    }
});

// ================= ПРОВЕРКА ПОЛЬЗОВАТЕЛЯ =================
async function checkUser(channel, username) {
    try {
        const response = await axios.get(
            `https://api.twitch.tv/helix/users?login=${username}`,
            {
                headers: {
                    'Client-ID': CLIENT_ID,
                    'Authorization': `Bearer ${APP_ACCESS_TOKEN}`
                }
            }
        );

        if (!response.data.data.length) {
            client.say(channel, `❌ Пользователь ${username} не найден`);
            return;
        }

        const userData = response.data.data[0];
        const createdAt = new Date(userData.created_at);
        const daysOld = Math.floor((Date.now() - createdAt) / (1000 * 60 * 60 * 24));

        const stats = userStats[username] || {
            totalMessages: 0,
            channels: {}
        };

        let risk = 0;
        let reasons = [];

        if (daysOld < 7) {
            risk += 40;
            reasons.push('новый аккаунт');
        }

        if (stats.totalMessages === 0) {
            risk += 40;
            reasons.push('нет сообщений в чате');
        }

        if (stats.totalMessages > 0 && stats.totalMessages <= 2) {
            risk += 20;
            reasons.push('очень низкая активность');
        }

        const verdict = risk >= 70
            ? '❌ Высокий риск твинка/бота'
            : risk >= 40
            ? '⚠️ Подозрительный аккаунт'
            : '✅ Похож на реального зрителя';

        const resultMsg = `🔎 ${username} | Возраст: ${daysOld}д | Сообщений: ${stats.totalMessages} | Риск: ${risk}% → ${verdict}`;
        client.say(channel, resultMsg);

    } catch (error) {
        console.error('Ошибка API:', error.message);
        client.say(channel, '⚠️ Ошибка проверки пользователя (API)');
    }
}

process.on('uncaughtException', (err) => {
    console.error('Критическая ошибка:', err);
});

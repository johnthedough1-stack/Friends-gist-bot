const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const pino = require('pino');

const PHONE_NUMBER = process.env.PHONE_NUMBER;

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState('./auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing code
  if (!state.creds.registered) {
    if (!PHONE_NUMBER) {
      console.log('❌ PHONE_NUMBER is not set.');
      console.log('Set it in your environment variables.');
      return;
    }

    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER);
      console.log('\n🔐 YOUR WHATSAPP PAIRING CODE:');
      console.log(code);
      console.log('\nOpen WhatsApp → Linked Devices → Link a device → Link with phone number');
    } catch (error) {
      console.error('❌ Pairing failed:', error);
    }
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('✅ FRIENDS AND GIST BOT CONNECTED!');
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut;

      console.log('⚠️ Connection closed.');

      if (shouldReconnect) {
        console.log('🔄 Reconnecting...');
        startBot();
      } else {
        console.log('❌ Logged out. Pair again.');
      }
    }
  });

  // Messages
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message || msg.key.fromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    console.log(`📩 Message: ${text}`);

    if (text.toLowerCase() === '.ping') {
      await sock.sendMessage(msg.key.remoteJid, {
        text: '🏓 Pong!\nFriends & Gist Bot is alive 😎'
      });
    }

    if (text.toLowerCase() === '.menu') {
      await sock.sendMessage(msg.key.remoteJid, {
        text:
`╭━━━〔 🤖 FRIENDS & GIST 〕━━━╮

┃ ⚡ .ping
┃ 📋 .menu
┃ 😂 .joke
┃ 🎮 .truth
┃ 🔥 .dare
┃ 👀 .wyr
┃ 🤖 .ai

╰━━━━━━━━━━━━━━━━━━━━━━╯`
      });
    }
  });
}

startBot();

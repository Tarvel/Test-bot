const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');

console.log('🚀 Initializing WhatsApp bot...');

// --- Express setup ---
const app = express();
let latestQR = null;

app.get('/', (req, res) => {
    res.send('✅ WhatsApp bot is running. Visit /qr to get the QR code.');
});

app.get('/qr', (req, res) => {
    if (!latestQR) {
        return res.send('⚠️ QR not generated yet. Please wait and refresh.');
    }
    // Render QR as image using free API
    res.send(`<h2>Scan this QR with WhatsApp</h2>
              <img src="https://api.qrserver.com/v1/create-qr-code/?data=${latestQR}&size=300x300"/>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🌐 Express server running on port ${PORT}`);
});

// --- WhatsApp client setup ---
const client = new Client({
    authStrategy: new LocalAuth(),
    takeoverOnConflict: true,
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Generate QR for login
client.on('qr', (qr) => {
    latestQR = qr;
    console.log('📲 Scan this QR Code with WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Ready event
client.on('ready', () => {
    console.log('✅ Client is ready and running');
});

// Listen for new messages
client.on('message_create', async (message) => {
    console.log(`📩 Message: "${message.body}" from ${message.from}`);

    if (message.from === 'status@broadcast') return; // ignore status updates

    const chat = await message.getChat();
    if (!chat.isGroup) return; // only respond in groups

    console.log('👥 Group chat:', chat.name);

    if (message.body !== '/everyone') return; // only trigger on /everyone command

    const participants = chat.participants;

    // ✅ Figure out the sender correctly
    let senderId;
    if (message.fromMe) {
        senderId = client.info.wid._serialized; // your own account ID
    } else {
        senderId = message.author; // in groups, this is the real sender
    }

    const sender = participants.find(p => p.id._serialized === senderId);

    if (!sender?.isAdmin) {
        console.log('❌ Sender is not an admin, ignoring.');
        return;
    }

    // Fetch contacts for mentions
    const contactPromises = participants.map(p => client.getContactById(p.id._serialized));
    const contacts = (await Promise.all(contactPromises))
        .filter(c => c.id.user !== client.info.wid.user); // exclude the bot itself

    try {
        // Typing indicator
        chat.sendStateTyping();

        // Send message with mentions
        await chat.sendMessage('Hello everyone!', {
            mentions: contacts
        });

        console.log('✅ Message sent with mentions');
        chat.clearState();
    } catch (error) {
        console.error('⚠️ Error sending message:', error);
    }
});

// Handle disconnection
client.on('disconnected', (reason) => {
    console.log('⚠️ Client was logged out:', reason);
    process.exit(1); // let Railway restart it
});

// Keep session alive
setInterval(() => {
    client.sendPresenceAvailable();
}, 300000); // every 5 minutes

// Initialize the client
client.initialize();

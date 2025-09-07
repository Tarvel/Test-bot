const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const express = require("express");

console.log("🚀 Initializing WhatsApp bot...");

// Express server for Railway health check
const app = express();
const PORT = process.env.PORT || 8080;
app.get("/", (req, res) => res.send("✅ WhatsApp bot is running"));
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("baileys_auth");

  const sock = makeWASocket({
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);

  // ✅ Handle QR manually
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;
    if (qr) {
      console.log("📱 Scan this QR to log in:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      console.log("✅ WhatsApp connection established!");
    }
    if (connection === "close") {
      console.log("⚠️ Connection closed, reconnecting...");
      startBot();
    }
  });

  // When messages arrive
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.remoteJid === "status@broadcast") return;

    const from = msg.key.remoteJid;
    const body =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      "";

    console.log(`📩 Message: "${body}" from ${from}`);

    // Only work in groups
    if (!from.endsWith("@g.us")) return;

    if (body === "/everyone") {
      // Get group metadata
      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants;

      // Find sender
      const sender = msg.key.participant || msg.key.remoteJid;
      const senderInfo = participants.find((p) => p.id === sender);

      if (!senderInfo?.admin) {
        console.log("❌ Sender is not an admin, ignoring.");
        return;
      }

      // Build mentions
      const mentions = participants.map((p) => p.id);
      const text = "Hello everyone!";

      await sock.sendMessage(from, {
        text,
        mentions,
      });

      console.log("✅ Message sent with mentions");
    }
  });
}

startBot();

const express = require("express");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");

const app = express();
const PORT = process.env.PORT || 8080;

let currentQR = null; // Store QR temporarily

(async () => {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Disable broken ASCII QR
  });

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, qr } = update;

    if (qr) {
      currentQR = qr; // Save the latest QR
      console.log("📱 New QR generated. Open /qr in browser to scan.");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp bot connected and running!");
      currentQR = null; // Clear QR once logged in
    }
  });

  // Save creds automatically
  sock.ev.on("creds.update", saveCreds);

  // Example listener
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    console.log(`📩 Message from ${from}: ${text}`);

    if (text?.toLowerCase() === "/ping") {
      await sock.sendMessage(from, { text: "🏓 Pong!" });
    }
  });
})();

// Serve QR code as PNG
app.get("/qr", async (req, res) => {
  if (!currentQR) {
    return res.send("✅ No QR available. Bot may already be logged in.");
  }
  res.setHeader("Content-Type", "image/png");
  res.send(await qrcode.toBuffer(currentQR));
});

// Keep Railway container alive
app.get("/", (req, res) => res.send("🚀 WhatsApp Bot is running"));

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

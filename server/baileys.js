const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const AUTH_DIR = path.join(__dirname, 'baileys_auth_info');

let sock = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, QR_READY, CONNECTED
let qrCodeDataUrl = '';
let connectedPhone = '';
let broadcastFn = null;

// Initialize or reconnect to WhatsApp
async function initBaileys(broadcast = null) {
  if (broadcast) {
    broadcastFn = broadcast;
  }

  // If already connected or connecting, return
  if (connectionStatus === 'CONNECTED' || connectionStatus === 'CONNECTING') {
    return;
  }

  connectionStatus = 'CONNECTING';
  notifyStatusChange();

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    // Create the socket connection
    sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'warn' }),
      printQRInTerminal: true // Diagnostics in CLI
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'QR_READY';
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr);
        } catch (err) {
          console.error('[Baileys] Error generating QR Data URL:', err);
        }
        notifyStatusChange();
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`[Baileys] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
        
        connectionStatus = 'DISCONNECTED';
        qrCodeDataUrl = '';
        connectedPhone = '';
        notifyStatusChange();

        if (shouldReconnect) {
          // Short delay before reconnecting
          setTimeout(() => {
            initBaileys();
          }, 5000);
        }
      } else if (connection === 'open') {
        connectionStatus = 'CONNECTED';
        qrCodeDataUrl = '';
        // Extract phone number from user JID
        const userJid = sock.user.id;
        connectedPhone = userJid.split(':')[0] || userJid.split('@')[0] || '';
        console.log(`[Baileys] Connected successfully! Phone number: ${connectedPhone}`);
        notifyStatusChange();
      }
    });

    // Save credentials on credentials update
    sock.ev.on('creds.update', saveCreds);

  } catch (err) {
    console.error('[Baileys] Initialization failed:', err);
    connectionStatus = 'DISCONNECTED';
    qrCodeDataUrl = '';
    connectedPhone = '';
    notifyStatusChange();
  }
}

// Send updates to Admin Panel via WebSocket
function notifyStatusChange() {
  if (broadcastFn) {
    broadcastFn({
      type: 'WA_STATUS_UPDATE',
      data: getBaileysStatus()
    });
  }
}

function getBaileysStatus() {
  return {
    status: connectionStatus,
    qrCodeDataUrl: connectionStatus === 'QR_READY' ? qrCodeDataUrl : '',
    phone: connectedPhone
  };
}

// Log out and clean session files
async function disconnectBaileys() {
  console.log('[Baileys] Logging out and deleting session...');
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // ignore
    }
    try {
      sock.end();
    } catch (e) {
      // ignore
    }
  }

  sock = null;
  connectionStatus = 'DISCONNECTED';
  qrCodeDataUrl = '';
  connectedPhone = '';

  // Delete the auth directory
  if (fs.existsSync(AUTH_DIR)) {
    try {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      console.log('[Baileys] Session folder deleted.');
    } catch (err) {
      console.error('[Baileys] Error deleting session folder:', err);
    }
  }

  notifyStatusChange();
  
  // Reconnect immediately to trigger new QR code
  setTimeout(() => {
    initBaileys();
  }, 2000);
}

// Send standard text message using Baileys socket
async function sendBaileysMessage(phone, text) {
  if (connectionStatus !== 'CONNECTED' || !sock) {
    throw new Error('WhatsApp linked device is not connected.');
  }

  // Format phone number to E.164
  let formattedPhone = phone.trim().replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone;
  }

  const jid = `${formattedPhone}@s.whatsapp.net`;
  console.log(`[Baileys] Dispatching message to ${jid}`);
  
  const result = await sock.sendMessage(jid, { text: text });
  return result;
}

module.exports = {
  initBaileys,
  getBaileysStatus,
  disconnectBaileys,
  sendBaileysMessage
};

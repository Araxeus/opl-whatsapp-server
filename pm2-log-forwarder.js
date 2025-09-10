// pm2-log-forwarder.js

import dgram from 'node:dgram';
import os from 'node:os';
import pm2 from 'pm2';

if (process.argv.length < 3) {
    console.error(
        'Usage: pm2 start pm2-log-forwarder.js --name log-forwarder -- <SYSLOG_IP:PORT>',
    );
    process.exit(1);
}

const [SYSLOG_IP, SYSLOG_PORT] = process.argv[2].split(':');

if (!SYSLOG_IP || !SYSLOG_PORT) {
    console.error(
        'Invalid SYSLOG_IP:PORT format. Example: logs3.papertrailapp.com:21435',
    );
    process.exit(1);
}

console.log(`🚀 Forwarding PM2 logs to ${SYSLOG_IP}:${SYSLOG_PORT}`);

const HOSTNAME = os.hostname();
const client = dgram.createSocket('udp4');

/** Send a single line as a syslog message with optional blockId */
function sendLine(appName, line, blockId = null) {
    if (!line) return;

    const pri = 134; // local0.info
    const timestamp = new Date().toISOString();
    const msg = blockId ? `${line} [blockId:${blockId}]` : line;

    const syslog = `<${pri}>1 ${timestamp} ${HOSTNAME} ${appName} - - - ${msg}`;
    client.send(Buffer.from(syslog), SYSLOG_PORT, SYSLOG_IP, err => {
        if (err) console.error('Failed to send log:', err.message);
    });
}

/** Split multi-line PM2 packet and assign blockId if needed */
function forwardPacket(appName, packetData) {
    const lines = String(packetData)
        .split(/\r?\n/)
        .filter(l => l.trim() !== '');
    if (lines.length === 0) return;

    // Only assign blockId for multi-line blocks
    const blockId = lines.length > 1 ? randomUUID().slice(0, 8) : null;

    for (const line of lines) {
        sendLine(appName, line, blockId);
    }
}

function start() {
    pm2.connect(err => {
        if (err) {
            console.error('PM2 connect error:', err.message);
            setTimeout(start, 2000);
            return;
        }

        pm2.launchBus((err, bus) => {
            if (err) {
                console.error('PM2 bus error:', err.message);
                setTimeout(start, 2000);
                return;
            }

            console.log(
                '✅ PM2 → SolarWinds forwarder started (multi-line safe).',
            );

            bus.on('log:out', packet =>
                forwardPacket(packet.process?.name || 'pm2-app', packet.data),
            );

            bus.on('log:err', packet =>
                forwardPacket(packet.process?.name || 'pm2-app', packet.data),
            );

            bus.on('process:event', packet =>
                sendLine(
                    packet.process?.name || 'pm2-app',
                    `[pm2-event] ${packet.event}`,
                ),
            );
        });
    });
}

start();

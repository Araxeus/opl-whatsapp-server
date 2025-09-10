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

/** Send a single raw log line over UDP */
function sendRaw(appName, rawLine) {
    if (!rawLine) return;
    // Build a minimal syslog header + raw message
    const pri = 134; // facility=local0, severity=informational
    const timestamp = new Date().toISOString();
    const syslog = `<${pri}>1 ${timestamp} ${HOSTNAME} ${appName} - - - ${rawLine}`;
    client.send(Buffer.from(syslog), SYSLOG_PORT, SYSLOG_IP);
}

/** Hook into PM2 bus and forward logs */
function start() {
    pm2.connect(err => {
        if (err) {
            console.error('❌ PM2 connect error:', err.message);
            setTimeout(start, 2000);
            return;
        }

        pm2.launchBus((err, bus) => {
            if (err) {
                console.error('❌ PM2 bus error:', err.message);
                setTimeout(start, 2000);
                return;
            }

            console.log(
                '✅ PM2 → SolarWinds forwarder started (raw passthrough).',
            );

            bus.on('log:out', packet => {
                sendRaw(packet.process?.name || 'pm2-app', packet.data);
            });

            bus.on('log:err', packet => {
                sendRaw(packet.process?.name || 'pm2-app', packet.data);
            });

            // bus.on('process:event', packet => {
            //     sendRaw(
            //         packet.process?.name || 'pm2-app',
            //         `[pm2-event] ${packet.event}`,
            //     );
            // });
        });
    });
}

start();

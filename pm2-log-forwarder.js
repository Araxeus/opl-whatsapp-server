// pm2-log-forwarder.js

import dgram from 'node:dgram';
import os from 'node:os';
import pm2 from 'pm2';

if (process.argv.length < 3) {
    console.error('Usage: pm2 start pm2-log-forwarder.js --name log-forwarder -- <SYSLOG_IP:PORT>');
    process.exit(1);
}

const [SYSLOG_IP, SYSLOG_PORT] = process.argv[2].split(':');

if (!SYSLOG_IP || !SYSLOG_PORT) {
    console.error('Invalid SYSLOG_IP:PORT format. Example: logs3.papertrailapp.com:21435');
    process.exit(1);
}

console.log(`🚀 Forwarding PM2 logs to ${SYSLOG_IP}:${SYSLOG_PORT}`);

const BATCH_SIZE = 20;
const FLUSH_INTERVAL = 1000; // ms

const HOSTNAME = os.hostname();
const client = dgram.createSocket('udp4');
const logBuffer = [];

// Build RFC 5424 syslog message
function formatSyslog(appName, _level, message) {
    const PRI = 134; // <134> = facility:local0, severity:informational
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const structuredData = '-'; // no structured data
    return `<${PRI}>1 ${timestamp} ${HOSTNAME} ${appName} ${pid} - ${structuredData} ${message.trim()}`;
}

// Send logs in buffer
function flushLogs() {
    if (logBuffer.length === 0) return;
    const batch = logBuffer.splice(0, BATCH_SIZE);

    for (const log of batch) {
        client.send(Buffer.from(log), SYSLOG_PORT, SYSLOG_IP, err => {
            if (err) console.error('❌ Failed to send log:', err.message);
        });
    }
}

// Periodic flushing
setInterval(flushLogs, FLUSH_INTERVAL).unref();

function forwardLog(appName, level, message) {
    const cleanMsg = message.replace(/\n+$/, ''); // remove trailing newlines
    logBuffer.push(formatSyslog(appName, level, cleanMsg));
    if (logBuffer.length >= BATCH_SIZE) flushLogs();
}

// Connect to PM2 and start listening
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

            console.log('✅ PM2 → SolarWinds log forwarder started.');

            bus.on('log:out', packet =>
                forwardLog(packet.process.name, 'INFO', packet.data),
            );

            bus.on('log:err', packet =>
                forwardLog(packet.process.name, 'ERR', packet.data),
            );

            bus.on('process:event', packet =>
                forwardLog(
                    packet.process.name,
                    'EVENT',
                    JSON.stringify(packet),
                ),
            );
        });
    });
}

// Handle uncaught errors gracefully
process.on('uncaughtException', err => {
    console.error('❌ Uncaught exception:', err);
});
process.on('unhandledRejection', reason => {
    console.error('❌ Unhandled rejection:', reason);
});

start();

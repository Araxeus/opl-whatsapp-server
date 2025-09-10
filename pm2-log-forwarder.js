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

const BATCH_SIZE = 20;
const FLUSH_INTERVAL = 1000;

const HOSTNAME = os.hostname();
const client = dgram.createSocket('udp4');
const logBuffer = [];

/**
 * Syslog severity levels (RFC 5424)
 * 0 = Emergency, 1 = Alert, 2 = Critical, 3 = Error
 * 4 = Warning, 5 = Notice, 6 = Informational, 7 = Debug
 */
function getPri(severity) {
    const FACILITY = 16; // local0
    return FACILITY * 8 + severity;
}

function formatSyslog(appName, severity, message) {
    const PRI = getPri(severity);
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const structuredData = '-';

    // Build JSON payload for easier parsing
    const payload = JSON.stringify({
        timestamp,
        host: HOSTNAME,
        app: appName,
        pid,
        severity,
        message: message.trim(),
    });

    return `<${PRI}>1 ${timestamp} ${HOSTNAME} ${appName} ${pid} - ${structuredData} ${payload}`;
}

function flushLogs() {
    if (logBuffer.length === 0) return;
    const batch = logBuffer.splice(0, BATCH_SIZE);
    for (const log of batch) {
        client.send(Buffer.from(log), SYSLOG_PORT, SYSLOG_IP, err => {
            if (err) console.error('❌ Failed to send log:', err.message);
        });
    }
}

setInterval(flushLogs, FLUSH_INTERVAL).unref();

function forwardLog(appName, severity, message) {
    const cleanMsg = message.replace(/\n+$/, '');
    logBuffer.push(formatSyslog(appName, severity, cleanMsg));
    if (logBuffer.length >= BATCH_SIZE) flushLogs();
}

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
                '✅ PM2 → SolarWinds log forwarder started (JSON mode).',
            );

            bus.on(
                'log:out',
                packet => forwardLog(packet.process.name, 6, packet.data), // Informational
            );

            bus.on(
                'log:err',
                packet => forwardLog(packet.process.name, 3, packet.data), // Error
            );

            bus.on(
                'process:event',
                packet =>
                    forwardLog(packet.process.name, 5, JSON.stringify(packet)), // Notice
            );
        });
    });
}

// Capture forwarder issues as well
process.on('uncaughtException', err => {
    forwardLog(
        'log-forwarder',
        2,
        `Uncaught exception: ${err.stack || err.message || err}`,
    );
});
process.on('unhandledRejection', reason => {
    forwardLog('log-forwarder', 4, `Unhandled rejection: ${reason}`);
});

start();

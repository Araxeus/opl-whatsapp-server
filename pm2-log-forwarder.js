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
const FLUSH_INTERVAL = 1000; // ms for batched UDP send
const MULTILINE_TIMEOUT = 300; // ms fallback - will rarely be used because we mostly rely on pattern detection

/// STATE
const HOSTNAME = os.hostname();
const client = dgram.createSocket('udp4');
const logBuffer = []; // batched syslog messages ready to send
const multilineBuffers = {}; // per-app buffers: { appName: { lines: [], timer, severity, justCreated } }

/**
 * Regex to detect start-of-log lines from your app.
 * Matches: [01:07:01.000] INFO (1109): ...
 * Captures the level token (INFO/WARN/ERROR/DEBUG/etc) in group 1.
 */
const LOG_LINE_START_RE =
    /^\[(\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?)\]\s+([A-Za-z]+)\b/;

/** Map textual level to syslog severity */
function mapLevelFromToken(token, fallback = 6) {
    if (!token) return fallback;
    const t = token.toUpperCase();
    if (t.includes('ERROR') || t === 'ERR') return 3; // error
    if (t.includes('CRIT') || t === 'CRITICAL') return 2;
    if (t.includes('WARN') || t === 'WARNING') return 4;
    if (t.includes('NOTICE') || t === 'NOTICE') return 5;
    if (t.includes('DEBUG')) return 7;
    if (t.includes('INFO')) return 6;
    return fallback;
}

/** RFC5424 PRI (facility local0 = 16) */
function getPri(severity) {
    const FACILITY = 16;
    return FACILITY * 8 + severity;
}

/** Build the syslog line containing a JSON payload (so SolarWinds can parse structured fields) */
function formatSyslog(appName, severity, message) {
    const PRI = getPri(severity);
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const structuredData = '-';

    const payload = JSON.stringify({
        timestamp,
        host: HOSTNAME,
        app: appName,
        pid,
        severity,
        message: message.trimEnd(),
    });

    return `<${PRI}>1 ${timestamp} ${HOSTNAME} ${appName} ${pid} - ${structuredData} ${payload}`;
}

/** Periodic sender for buffered UDP packets */
function flushLogs() {
    if (logBuffer.length === 0) return;
    const batch = logBuffer.splice(0, BATCH_SIZE);
    for (const syslogMsg of batch) {
        client.send(Buffer.from(syslogMsg), SYSLOG_PORT, SYSLOG_IP, err => {
            if (err) {
                console.error('❌ Failed to send log:', err.message || err);
            }
        });
    }
}
setInterval(flushLogs, FLUSH_INTERVAL).unref();

/** enqueue a syslog message (batched) */
function forwardLog(appName, severity, message) {
    logBuffer.push(formatSyslog(appName || 'unknown-app', severity, message));
    if (logBuffer.length >= BATCH_SIZE) flushLogs();
}

/** flush the per-app multiline buffer immediately */
function flushAppBufferImmediate(appName) {
    const buf = multilineBuffers[appName];
    if (!buf || buf.lines.length === 0) return;
    const combined = buf.lines.join('\n');
    forwardLog(appName, buf.severity || 6, combined);
    // clear buffer & timer
    if (buf.timer) {
        clearTimeout(buf.timer);
        buf.timer = null;
    }
    buf.lines = [];
    buf.justCreated = false;
}

/** schedule fallback flush for a buffer (in case pattern detection misses) */
function scheduleBufferTimeout(appName) {
    const buf = multilineBuffers[appName];
    if (!buf) return;
    if (buf.timer) clearTimeout(buf.timer);
    buf.timer = setTimeout(() => {
        if (buf.lines.length > 0) {
            const combined = buf.lines.join('\n');
            forwardLog(appName, buf.severity || 6, combined);
            buf.lines = [];
        }
        buf.timer = null;
        buf.justCreated = false;
    }, MULTILINE_TIMEOUT);
}

/**
 * Core: process incoming packet data from PM2 for a given app.
 * Uses the start-line regex to decide whether to start a new message or append.
 * Does immediate flush when a new start-line is detected (prevents mid-object timestamps).
 */
function processIncoming(appName, pmHintSeverity, rawData) {
    // normalize to string and split into lines
    const text = String(rawData || '');
    if (text.length === 0) return;

    const lines = text.split(/\r?\n/);
    // track which buffers we created in this packet and whether they got continuations
    const createdThisPacket = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === '') continue; // ignore empty lines

        const m = line.match(LOG_LINE_START_RE);
        if (m) {
            // start-of-log detected
            const token = m[2];
            const severity = mapLevelFromToken(token, pmHintSeverity);

            // flush any existing buffer for this app first (a new start means previous message ended)
            if (
                multilineBuffers[appName] &&
                multilineBuffers[appName].lines.length > 0
            ) {
                flushAppBufferImmediate(appName);
            }

            // start a new buffer
            multilineBuffers[appName] = multilineBuffers[appName] || {};
            multilineBuffers[appName].lines = [line];
            multilineBuffers[appName].severity = severity;
            multilineBuffers[appName].justCreated = true;
            createdThisPacket.add(appName);
            // schedule fallback timeout in case there's continuation after this packet
            scheduleBufferTimeout(appName);
        } else {
            // continuation line — append to existing buffer if exists, otherwise start a buffer (fallback)
            if (!multilineBuffers[appName]) {
                multilineBuffers[appName] = {
                    lines: [],
                    timer: null,
                    severity: pmHintSeverity,
                    justCreated: false,
                };
            }
            multilineBuffers[appName].lines.push(line);
            multilineBuffers[appName].justCreated = false; // mark as having continuation
            // ensure we have a timeout scheduled to flush if no more lines arrive
            scheduleBufferTimeout(appName);
        }
    }

    // After processing the whole packet: any newly-created buffers in this packet that didn't get continuation
    // (i.e., justCreated === true) are flushed immediately because the packet ended and there's no continuation in it.
    // This avoids waiting on the timeout when logs are high-throughput and each line is a separate entry.
    for (const app of createdThisPacket) {
        const buf = multilineBuffers[app];
        if (buf?.justCreated) {
            flushAppBufferImmediate(app);
        }
    }
}

/** PM2 start & bus hookup */
function start() {
    pm2.connect(err => {
        if (err) {
            console.error('❌ PM2 connect error:', err.message || err);
            setTimeout(start, 2000);
            return;
        }

        pm2.launchBus((err, bus) => {
            if (err) {
                console.error('❌ PM2 bus error:', err.message || err);
                setTimeout(start, 2000);
                return;
            }

            console.log(
                '✅ PM2 → SolarWinds log forwarder started (smart multiline).',
            );

            bus.on('log:out', packet => {
                // packet.process.name, packet.data
                processIncoming(
                    packet.process?.name || 'unknown-app',
                    6,
                    packet.data,
                );
            });

            bus.on('log:err', packet => {
                processIncoming(
                    packet.process?.name || 'unknown-app',
                    3,
                    packet.data,
                );
            });

            bus.on('process:event', packet => {
                const {
                    event,
                    manually,
                    at,
                    process: {
                        name,
                        pm_id,
                        status,
                        restart_time,
                        unstable_restarts,
                        exit_code,
                        pm_uptime,
                        version,
                        node_version,
                    } = {},
                } = packet;

                const cleanEvent = {
                    timestamp: new Date(at).toISOString(),
                    event,
                    manually,
                    app: name,
                    pm_id,
                    status,
                    restart_time,
                    unstable_restarts,
                    exit_code,
                    pm_uptime,
                    version,
                    node_version,
                };

                forwardLog(
                    name || 'unknown-app',
                    5,
                    JSON.stringify(cleanEvent),
                );
            });
        });
    });
}

/** Capture forwarder errors as syslog as well */
process.on('uncaughtException', err => {
    try {
        forwardLog(
            'log-forwarder',
            2,
            `Uncaught exception: ${err?.stack ? err.stack : String(err)}`,
        );
    } catch (e) {
        console.error('fatal uncaughtException:', err, e);
    }
});
process.on('unhandledRejection', reason => {
    try {
        forwardLog(
            'log-forwarder',
            4,
            `Unhandled rejection: ${String(reason)}`,
        );
    } catch (e) {
        console.error('fatal unhandledRejection:', reason, e);
    }
});

start();

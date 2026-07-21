import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'vanilla_backup/data/settings.json');

async function getAdminSettings() {
    // 1. Try Supabase
    if (supabase) {
        try {
            const { data, error } = await supabase.from('settings').select('*').eq('id', 1).single();
            if (!error && data) {
                return {
                    adminUsername: data.admin_username || 'admin',
                    adminPassword: data.admin_password || '$2b$10$0kCJFB1RDThWNYoZVeSJiurjsZQBowOXXRue38YcxnQl2hUN5Fat.'
                };
            }
        } catch (e) {
            console.error('Supabase settings query error inside login API:', e);
        }
    }

    // 2. Fall back to local backup settings file
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const fileData = fs.readFileSync(SETTINGS_FILE, 'utf8');
            const settings = JSON.parse(fileData);
            return {
                adminUsername: settings.adminUsername || 'admin',
                adminPassword: settings.adminPassword || '$2b$10$0kCJFB1RDThWNYoZVeSJiurjsZQBowOXXRue38YcxnQl2hUN5Fat.'
            };
        }
    } catch (e) {
        console.error('File fallback settings query error inside login API:', e);
    }

    // 3. Fallback defaults
    return {
        adminUsername: 'admin',
        adminPassword: '$2b$10$0kCJFB1RDThWNYoZVeSJiurjsZQBowOXXRue38YcxnQl2hUN5Fat.' // pizzas778
    };
}

export async function POST(req) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username and password are required' }, { status: 400 });
        }

        const settings = await getAdminSettings();

        const isUsernameValid = username.trim().toLowerCase() === settings.adminUsername.toLowerCase();
        const isPasswordValid = bcrypt.compareSync(password, settings.adminPassword);

        if (!isUsernameValid || !isPasswordValid) {
            return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
        }

        // Set secure HTTP-only session cookie
        const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        
        // Save session locally / mock
        // Note: Next.js edge compatibility doesn't require global states if we encrypt or set a simple signed cookie.
        // We will set a session cookie with value 'active' or 'admin' and encrypt/obfuscate it.
        const cookieStore = await cookies();
        cookieStore.set('sid', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 2 // 2 hours
        });

        // Store active session in Supabase metadata if desired, but cookie session identifier check is enough for MVP.
        return NextResponse.json({ success: true });
    } catch (e) {
        console.error('Login API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

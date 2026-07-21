import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileExtension = path.extname(file.name) || '.jpg';
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${fileExtension}`;

        // 1. Try Supabase Storage
        if (supabase) {
            try {
                const { data, error } = await supabase.storage
                    .from('roof-photos')
                    .upload(uniqueFilename, buffer, {
                        contentType: file.type || 'image/jpeg',
                        upsert: true
                    });

                if (!error && data) {
                    // Fetch public URL
                    const { data: urlData } = supabase.storage
                        .from('roof-photos')
                        .getPublicUrl(uniqueFilename);
                    
                    if (urlData?.publicUrl) {
                        return NextResponse.json({ success: true, url: urlData.publicUrl });
                    }
                } else if (error) {
                    console.error('Supabase storage upload error:', error);
                }
            } catch (e) {
                console.error('Supabase storage exception:', e);
            }
        }

        // 2. Fall back to local filesystem storage in public/uploads/
        try {
            const uploadDir = path.join(process.cwd(), 'public/uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const localPath = path.join(uploadDir, uniqueFilename);
            fs.writeFileSync(localPath, buffer);

            // Construct local relative public URL
            const localUrl = `/uploads/${uniqueFilename}`;
            return NextResponse.json({ success: true, url: localUrl });
        } catch (e) {
            console.error('Local filesystem upload write error:', e);
            return NextResponse.json({ success: false, error: 'Failed to write file locally' }, { status: 500 });
        }
    } catch (e) {
        console.error('Upload API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}


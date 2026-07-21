import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAuth } from '@/lib/auth';
import { calculateEstimate } from '@/lib/estimate';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

const LEADS_FILE = path.join(process.cwd(), 'vanilla_backup/data/leads.json');

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || '');

async function getContractorEmail() {
    if (supabase) {
        try {
            const { data } = await supabase.from('settings').select('contractor_email').eq('id', 1).single();
            if (data?.contractor_email) return data.contractor_email;
        } catch (e) {
            console.error('Error fetching contractor email from settings:', e);
        }
    }
    return 'isaaqabukar1@gmail.com';
}

export async function GET(req) {
    try {
        const authenticated = await checkAuth();
        if (!authenticated) {
            return NextResponse.json({ error: 'Unauthorized session' }, { status: 401 });
        }

        let leads = [];

        if (supabase) {
            try {
                const { data, error } = await supabase.from('leads').select('*').order('date', { ascending: false });
                if (!error && data) {
                    leads = data.map(row => {
                        // Parse serialized wizard fields from motivation if present
                        let extraData = {};
                        try {
                            if (row.motivation && row.motivation.startsWith('{')) {
                                extraData = JSON.parse(row.motivation);
                            }
                        } catch (e) {}

                        return {
                            id: row.id,
                            name: row.name,
                            email: row.email,
                            phone: row.phone,
                            address: row.address,
                            zip: row.zip,
                            size: row.size || row.roof_size,
                            material: row.material,
                            price: row.price,
                            stories: row.stories,
                            status: row.status || 'New',
                            date: row.date,
                            // Extracted properties
                            propertyType: extraData.propertyType || 'Residential',
                            condition: row.age || 'Good',
                            service: extraData.service || 'Replacement',
                            timeline: extraData.timeline || 'Under 1 month',
                            insurance: extraData.insurance || 'Cash / Direct Financing',
                            roofAge: extraData.roofAge || '10 - 20 years',
                            pitch: extraData.pitch || 'Standard',
                            estimateDetails: extraData.estimate || null,
                            appointment: extraData.appointment || null
                        };
                    });
                    return NextResponse.json(leads);
                }
            } catch (e) {
                console.error('Supabase fetch leads error:', e);
            }
        }

        // Local filesystem fallback
        try {
            if (fs.existsSync(LEADS_FILE)) {
                const fileData = fs.readFileSync(LEADS_FILE, 'utf8');
                leads = JSON.parse(fileData);
                return NextResponse.json(leads);
            }
        } catch (e) {
            console.error('File fallback read leads error:', e);
        }

        return NextResponse.json([]);
    } catch (e) {
        console.error('Leads GET API error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { name, email, phone, address, propertyType, stories, roofSize, condition, service, material, timeline, insurance, roofAge, pitch } = body;

        // Validation
        if (!name || !email || !address || !roofSize || !material) {
            return NextResponse.json({ success: false, error: 'Required fields are missing' }, { status: 400 });
        }

        // Calculate estimate
        const estimateResult = calculateEstimate({
            material,
            stories,
            condition,
            service,
            property_type: propertyType,
            roof_size: roofSize,
            pitch,
            roof_age: roofAge
        });

        const meanPrice = Math.round((estimateResult.minPrice + estimateResult.maxPrice) / 2);
        const uniqueId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Serialize extra parameters to remain fully compatible with existing DB table schema
        const motivationPayload = JSON.stringify({
            propertyType,
            service,
            timeline,
            insurance,
            roofAge,
            pitch,
            estimate: estimateResult
        });

        const leadData = {
            name,
            email,
            phone: phone || '',
            address,
            zip: '34652', // default fallback
            size: parseInt(roofSize),
            material,
            price: meanPrice,
            motivation: motivationPayload, // holds extra json metadata
            age: condition,                 // holds condition value
            stories: stories.toString(),
            status: 'New',
            date: new Date().toISOString()
        };

        let savedLead = null;

        if (supabase) {
            try {
                const { data, error } = await supabase.from('leads').insert([leadData]).select();
                if (!error && data && data.length > 0) {
                    savedLead = data[0];
                } else if (error) {
                    console.error('Supabase insert lead error:', error);
                }
            } catch (e) {
                console.error('Supabase write lead exception:', e);
            }
        }

        // Filesystem fallback caching if Supabase writes fail
        if (!savedLead) {
            leadData.id = 'RQ-' + uniqueId;
            try {
                let localLeads = [];
                if (fs.existsSync(LEADS_FILE)) {
                    const data = fs.readFileSync(LEADS_FILE, 'utf8');
                    localLeads = JSON.parse(data);
                }
                localLeads.unshift(leadData);
                fs.writeFileSync(LEADS_FILE, JSON.stringify(localLeads, null, 2), 'utf8');
                savedLead = leadData;
            } catch (e) {
                console.error('Local leads caching write error:', e);
                savedLead = leadData; // carry on to email even if storage write failed
            }
        }

        const contractorEmail = await getContractorEmail();
        const leadId = savedLead.id || 'RQ-' + uniqueId;

        // Email templates
        const homeownerHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #6366f1;">QUOTRAMAX</h2>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
                <p>Hello <strong>${name}</strong>,</p>
                <p>Thank you for requesting an estimate. We have processed your roof parameters and generated your preliminary calculation.</p>
                
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #10b981;">
                    <span style="font-size: 0.9rem; color: #64748b;">Estimated Project Price Range</span>
                    <h3 style="margin: 5px 0 0 0; color: #0f172a; font-size: 1.5rem;">$${estimateResult.minPrice.toLocaleString()} - $${estimateResult.maxPrice.toLocaleString()}</h3>
                    <p style="margin: 5px 0 0 0; font-size: 0.8rem; color: #64748b;">* This is a preliminary estimate, not a final quote. Final pricing requires an in-person physical inspection.</p>
                </div>

                <h3>Project Details Summary:</h3>
                <ul>
                    <li><strong>Address:</strong> ${address}</li>
                    <li><strong>Service Type:</strong> ${service}</li>
                    <li><strong>Roof Material:</strong> ${material}</li>
                    <li><strong>Stories:</strong> ${stories} Story</li>
                </ul>

                <p>Our roofing professionals have been notified and will reach out to you shortly to schedule your free physical slope measurement check.</p>
                <p>Best regards,<br>The Quotramax Estimator Team</p>
            </div>
        `;

        const contractorHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #6366f1;">QUOTRAMAX: New Lead Alert!</h2>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
                <p>A new pre-qualified homeowner has completed your estimator funnel:</p>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Name:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${email}">${email}</a></td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${phone || 'Not provided'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Address:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${address}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Est. Roof Size:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${roofSize.toLocaleString()} sq ft</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Material Style:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${material}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Condition & Stories:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${condition} / ${stories} Story</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Generated Range:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #10b981; font-weight: bold;">$${estimateResult.minPrice.toLocaleString()} - $${estimateResult.maxPrice.toLocaleString()}</td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 2px solid #e2e8f0;">
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 40%;">Project Timeline:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #6366f1; font-weight: bold;">${timeline}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Funding / Insurance:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${insurance}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Current Roof Age:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${roofAge}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Slope Pitch:</td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${pitch} Slope</td>
                    </tr>
                </table>

                <div style="margin-top: 30px; text-align: center;">
                    <a href="${req.headers.get('origin') || ''}/login" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Contractor Dashboard</a>
                </div>
            </div>
        `;

        // Send emails
        try {
            await resend.emails.send({
                from: 'Quotramax Onboarding <onboarding@resend.dev>',
                to: email,
                subject: 'Your Preliminary Roof Estimate Summary - Quotramax',
                html: homeownerHtml
            });

            await resend.emails.send({
                from: 'Quotramax Lead Alert <onboarding@resend.dev>',
                to: contractorEmail,
                subject: `New Lead: ${name} - ${address}`,
                html: contractorHtml
            });
        } catch (e) {
            console.error('Resend API dispatch errors:', e);
        }

        return NextResponse.json({ success: true, leadId });
    } catch (e) {
        console.error('Leads POST API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

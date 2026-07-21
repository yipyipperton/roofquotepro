import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateEstimate } from '@/lib/estimate';
import fs from 'fs';
import path from 'path';

const LEADS_FILE = path.join(process.cwd(), 'vanilla_backup/data/leads.json');

async function findLeadById(id) {
    if (supabase) {
        try {
            const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
            if (!error && data) {
                return data;
            }
        } catch (e) {
            console.error('Supabase fetch lead by ID error:', e);
        }
    }

    // Try local filesystem fallback
    try {
        if (fs.existsSync(LEADS_FILE)) {
            const fileData = fs.readFileSync(LEADS_FILE, 'utf8');
            const leads = JSON.parse(fileData);
            const lead = leads.find(l => l.id === id);
            if (lead) return lead;
        }
    } catch (e) {
        console.error('File fallback read lead by ID error:', e);
    }

    return null;
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const lead = await findLeadById(id);

        if (!lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        // Parse serialized wizard fields from motivation if present
        let extraData = {};
        try {
            if (lead.motivation && lead.motivation.startsWith('{')) {
                extraData = JSON.parse(lead.motivation);
            }
        } catch (e) {}

        // Recalculate estimate if not saved in extraData
        const stories = lead.stories || '1';
        const condition = lead.age || 'Good';
        const material = lead.material || 'Asphalt shingles';
        const size = lead.size || lead.roof_size || 2000;
        const propertyType = extraData.propertyType || 'Residential';
        const service = extraData.service || 'Replacement';

        const estimate = extraData.estimate || calculateEstimate({
            material,
            stories,
            condition,
            service,
            property_type: propertyType,
            roof_size: size
        });

        const mappedLead = {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            address: lead.address,
            zip: lead.zip || '34652',
            size,
            material,
            price: lead.price || Math.round((estimate.minPrice + estimate.maxPrice) / 2),
            stories,
            status: lead.status || 'New',
            date: lead.date,
            propertyType,
            condition,
            service,
            photos: extraData.photos || [],
            estimate
        };

        return NextResponse.json(mappedLead);
    } catch (e) {
        console.error('Single lead GET API error:', e);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const { status, scheduleInspection, appointment } = await req.json();

        const lead = await findLeadById(id);
        if (!lead) {
            return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
        }

        let updatedStatus = status || lead.status;
        if (scheduleInspection || appointment) {
            updatedStatus = 'Inspection Scheduled';
        }

        // Parse existing motivation metadata to append appointment details
        let extraData = {};
        try {
            if (lead.motivation && lead.motivation.startsWith('{')) {
                extraData = JSON.parse(lead.motivation);
            }
        } catch (e) {}

        if (appointment) {
            extraData.appointment = appointment; // { date, time }
        }

        const updatedMotivation = JSON.stringify(extraData);
        let success = false;

        if (supabase) {
            try {
                const { error } = await supabase.from('leads').update({ 
                    status: updatedStatus,
                    motivation: updatedMotivation
                }).eq('id', id);
                
                if (!error) success = true;
                else console.error('Supabase patch update error:', error);
            } catch (e) {
                console.error('Supabase patch lead status exception:', e);
            }
        }

        // Sync or fallback filesystem updates
        try {
            if (fs.existsSync(LEADS_FILE)) {
                const fileData = fs.readFileSync(LEADS_FILE, 'utf8');
                const leads = JSON.parse(fileData);
                const leadIndex = leads.findIndex(l => l.id === id);
                if (leadIndex !== -1) {
                    leads[leadIndex].status = updatedStatus;
                    leads[leadIndex].motivation = updatedMotivation;
                    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
                    success = true;
                }
            }
        } catch (e) {
            console.error('Local JSON leads patch sync error:', e);
        }

        // Dispatch Resend email alert to contractor if appointment is scheduled
        if (appointment && success) {
            try {
                const { Resend } = require('resend');
                const resend = new Resend(process.env.RESEND_API_KEY || '');
                const contractorEmail = await getContractorEmail();

                const appointmentHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <h2 style="color: #6366f1;">📅 Inspection Appointment Scheduled!</h2>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <p>Homeowner <strong>${lead.name}</strong> has confirmed their inspection date and time slot:</p>
                        
                        <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #6366f1;">
                            <p style="margin: 0; font-weight: bold; color: #0f172a;">Date: ${new Date(appointment.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            <p style="margin: 5px 0 0 0; font-weight: bold; color: #6366f1;">Time Slot: ${appointment.time}</p>
                        </div>

                        <h3>Customer Details:</h3>
                        <ul>
                            <li><strong>Name:</strong> ${lead.name}</li>
                            <li><strong>Address:</strong> ${lead.address}</li>
                            <li><strong>Email:</strong> ${lead.email}</li>
                            <li><strong>Phone:</strong> ${lead.phone || 'Not provided'}</li>
                        </ul>
                    </div>
                `;

                await resend.emails.send({
                    from: 'Quotramax Scheduling <onboarding@resend.dev>',
                    to: contractorEmail,
                    subject: `📅 Appointment: ${lead.name} - ${appointment.date}`,
                    html: appointmentHtml
                });
            } catch (e) {
                console.error('Resend dispatch error for scheduled appointment:', e);
            }
        }

        return NextResponse.json({ success });
    } catch (e) {
        console.error('Single lead PATCH API error:', e);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

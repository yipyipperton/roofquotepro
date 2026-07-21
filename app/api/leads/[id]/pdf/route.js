import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateEstimate } from '@/lib/estimate';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
            console.error('Supabase fetch lead by ID for PDF error:', e);
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
        console.error('File fallback read lead by ID for PDF error:', e);
    }

    return null;
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const lead = await findLeadById(id);

        if (!lead) {
            return new Response('Estimate not found', { status: 404 });
        }

        // Parse serialized wizard fields from motivation if present
        let extraData = {};
        try {
            if (lead.motivation && lead.motivation.startsWith('{')) {
                extraData = JSON.parse(lead.motivation);
            }
        } catch (e) {}

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

        // Initialize PDF Document
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
        
        const page = pdfDoc.addPage([612, 792]); // Letter size (8.5 x 11 inches)
        
        // Colors
        const primaryColor = rgb(0.09, 0.15, 0.27); // Dark navy
        const accentColor = rgb(0.38, 0.40, 0.94);  // Indigo
        const grayColor = rgb(0.40, 0.45, 0.55);    // Slate gray
        const greenColor = rgb(0.06, 0.70, 0.45);   // Emerald green
        const borderLightColor = rgb(0.88, 0.90, 0.93); // Light border gray

        // Title / Header
        page.drawText('QUOTRAMAX', { x: 50, y: 730, size: 22, font: helveticaBold, color: accentColor });
        page.drawText('Instant Preliminary Estimate Report', { x: 50, y: 712, size: 10, font: helveticaOblique, color: grayColor });

        const dateStr = new Date(lead.date || Date.now()).toISOString().split('T')[0];
        page.drawText(`Estimate ID: ${id}`, { x: 400, y: 730, size: 10, font: helveticaBold, color: primaryColor });
        page.drawText(`Date Issued: ${dateStr}`, { x: 400, y: 712, size: 10, font: helveticaFont, color: grayColor });

        // Divider
        page.drawLine({ start: { x: 50, y: 695 }, end: { x: 562, y: 695 }, thickness: 1, color: borderLightColor });

        // Customer Info
        page.drawText('CUSTOMER & PROPERTY DETAILS', { x: 50, y: 670, size: 11, font: helveticaBold, color: primaryColor });
        
        page.drawText('Name:', { x: 50, y: 650, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(lead.name, { x: 130, y: 650, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Email:', { x: 50, y: 630, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(lead.email, { x: 130, y: 630, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Phone:', { x: 340, y: 630, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(lead.phone || 'Not provided', { x: 390, y: 630, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Address:', { x: 50, y: 610, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(lead.address, { x: 130, y: 610, size: 9, font: helveticaFont, color: primaryColor });

        // Divider
        page.drawLine({ start: { x: 50, y: 590 }, end: { x: 562, y: 590 }, thickness: 1, color: borderLightColor });

        // Project Specs
        page.drawText('PROJECT SPECIFICATIONS', { x: 50, y: 565, size: 11, font: helveticaBold, color: primaryColor });

        page.drawText('Stories:', { x: 50, y: 545, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(`${stories} Story`, { x: 140, y: 545, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Material Style:', { x: 200, y: 545, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(material, { x: 290, y: 545, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Roof Size:', { x: 420, y: 545, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(`${size.toLocaleString()} sq ft`, { x: 490, y: 545, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Property Type:', { x: 50, y: 525, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(propertyType, { x: 140, y: 525, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Desired Service:', { x: 200, y: 525, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(service, { x: 290, y: 525, size: 9, font: helveticaFont, color: primaryColor });

        page.drawText('Current Condition:', { x: 420, y: 525, size: 9, font: helveticaBold, color: grayColor });
        page.drawText(condition, { x: 510, y: 525, size: 9, font: helveticaFont, color: primaryColor });

        // Divider
        page.drawLine({ start: { x: 50, y: 505 }, end: { x: 562, y: 505 }, thickness: 1, color: borderLightColor });

        // Estimate Box
        page.drawRectangle({
            x: 50,
            y: 400,
            width: 512,
            height: 80,
            color: rgb(0.96, 0.97, 0.99),
            borderColor: borderLightColor,
            borderWidth: 1
        });

        page.drawText('ESTIMATED BUDGET RANGE', { x: 70, y: 455, size: 10, font: helveticaBold, color: grayColor });
        page.drawText(`$${estimate.minPrice.toLocaleString()} - $${estimate.maxPrice.toLocaleString()}`, {
            x: 70, y: 420, size: 24, font: helveticaBold, color: greenColor
        });

        // Price breakdown list
        page.drawText('COST BREAKDOWN ESTIMATE', { x: 50, y: 360, size: 11, font: helveticaBold, color: primaryColor });

        page.drawText('Premium Materials:', { x: 50, y: 340, size: 9, font: helveticaFont, color: grayColor });
        page.drawText(`$${estimate.breakdown.materials.toLocaleString()}`, { x: 220, y: 340, size: 9, font: helveticaBold, color: primaryColor });

        page.drawText('Install Labor & Rigging:', { x: 50, y: 320, size: 9, font: helveticaFont, color: grayColor });
        page.drawText(`$${estimate.breakdown.labor.toLocaleString()}`, { x: 220, y: 320, size: 9, font: helveticaBold, color: primaryColor });

        page.drawText('Permits, Debris & Safety Fees:', { x: 50, y: 300, size: 9, font: helveticaFont, color: grayColor });
        page.drawText(`$${estimate.breakdown.fees.toLocaleString()}`, { x: 220, y: 300, size: 9, font: helveticaBold, color: primaryColor });

        // Pricing explanation factors
        page.drawText('PRICING FACTORS DETECTED', { x: 300, y: 360, size: 11, font: helveticaBold, color: primaryColor });
        let currentY = 340;
        for (const factor of estimate.factors) {
            page.drawText(`- ${factor}`, { x: 300, y: currentY, size: 8, font: helveticaFont, color: grayColor });
            currentY -= 15;
        }

        // Disclaimer at bottom
        page.drawRectangle({
            x: 50,
            y: 90,
            width: 512,
            height: 50,
            color: rgb(0.99, 0.95, 0.95),
            borderColor: rgb(0.95, 0.85, 0.85),
            borderWidth: 1
        });
        
        page.drawText('IMPORTANT NOTICE:', { x: 65, y: 125, size: 8, font: helveticaBold, color: rgb(0.8, 0.1, 0.1) });
        page.drawText('This is a preliminary budget estimate based on standard regional variables and digital measurements.', {
            x: 65, y: 112, size: 8, font: helveticaFont, color: primaryColor
        });
        page.drawText('It does not constitute a final binding contract. Final pricing requires a physical on-site inspection.', {
            x: 65, y: 100, size: 8, font: helveticaFont, color: primaryColor
        });

        // Save PDF to buffer
        const pdfBytes = await pdfDoc.save();

        return new Response(pdfBytes, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Quotramax_Estimate_${id}.pdf"`,
                'Content-Length': pdfBytes.length.toString()
            }
        });
    } catch (e) {
        console.error('PDF generation API error:', e);
        return new Response('Internal Server Error', { status: 500 });
    }
}

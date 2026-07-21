// Deterministic Pricing Engine for Quotramax Estimator
export function calculateEstimate(lead) {
    const material = lead.material || 'Asphalt shingles';
    const stories = lead.stories || '1';
    const condition = lead.condition || 'Good';
    const service = lead.service || 'Replacement';
    const propertyType = lead.property_type || 'Residential';
    const roofSize = parseInt(lead.roof_size) || 2000;
    
    // New parameters
    const pitch = lead.pitch || 'Standard'; // Flat, Standard, Steep
    const roofAge = lead.roof_age || '10 - 20 years';

    // Base installed costs per sq ft (reflecting 2025/2026 market averages)
    let baseMatRate = 4.50; // Asphalt shingles ($5.00 - $13.00 installed range)
    let laborRate = 2.50;
    
    if (material.toLowerCase().includes('metal')) {
        baseMatRate = 8.00;
        laborRate = 4.50; // Metal installation is more technical ($12.50/sq ft base installed)
    } else if (material.toLowerCase().includes('tile')) {
        baseMatRate = 12.00;
        laborRate = 6.00; // Heavy tiles require extra labor ($18.00/sq ft base installed)
    } else if (material.toLowerCase().includes('other')) {
        baseMatRate = 6.00;
        laborRate = 3.50;
    }

    // Story accessibility multipliers
    let storyMult = 1.0;
    if (stories === '2') storyMult = 1.20;
    else if (stories === '3' || stories === '3+') storyMult = 1.40;

    // Wear condition multipliers
    let conditionMult = 1.0;
    if (condition.toLowerCase() === 'poor' || roofAge === '20+ years') conditionMult = 1.15; // rotten wood decking buffer
    else if (condition.toLowerCase() === 'fair') conditionMult = 1.05;

    let propertyMult = 1.0;
    if (propertyType.toLowerCase() === 'commercial') propertyMult = 1.25;

    // Localized repair area factor logic
    const isRepair = service.toLowerCase() === 'repair';
    
    // For repairs, we calculate costs on a localized patch area (typically 8% of total roof size, capped between 100 and 400 sq ft)
    const activeArea = isRepair 
        ? Math.min(400, Math.max(100, Math.round(roofSize * 0.08))) 
        : roofSize;

    // Pitch slope area factors & hazard multipliers
    let slopeFactor = 1.15; // standard slope
    let pitchLaborMultiplier = 1.0;

    if (pitch === 'Flat') {
        slopeFactor = 1.00;
    } else if (pitch === 'Steep') {
        slopeFactor = 1.35; // steep slope area expansion
        pitchLaborMultiplier = 1.30; // 30% steep hazard scaffolding surcharge
    }

    // Calculations based on active surface area
    const surfaceArea = Math.round(activeArea * slopeFactor);

    let materialsCost = surfaceArea * baseMatRate;
    let laborCost = surfaceArea * laborRate * storyMult * propertyMult * pitchLaborMultiplier;
    
    // Apply condition multipliers
    materialsCost *= conditionMult;
    laborCost *= conditionMult;

    // Disposal and safety fees
    let debrisFees = surfaceArea * 0.50; 
    let permitsFees = (materialsCost + laborCost) * 0.08;

    // For repairs, add a flat mobilization / contractor overhead minimum charge ($650 standard)
    const mobilizationFee = isRepair ? 650 : 0;

    let total = materialsCost + laborCost + debrisFees + permitsFees + mobilizationFee;

    const minPrice = Math.round((total * 0.90) / 100) * 100;
    const maxPrice = Math.round((total * 1.10) / 100) * 100;

    // Generate pricing factors dynamically
    const factors = [];
    if (isRepair) {
        factors.push(`Localized leak repair patch targeting approximately ${surfaceArea.toLocaleString()} sq ft of roof wear area.`);
        factors.push("Contractor Mobilization Fee: Includes minimum crew dispatch and localized leak troubleshooting setup.");
    } else {
        factors.push(`Complete tear-off and replacement of ${surfaceArea.toLocaleString()} sq ft of roof surface area.`);
    }
    factors.push(`Stories Elevation: ${stories} story safety height setups.`);
    factors.push(`Material Style: High-performance ${material} base rates.`);
    factors.push(`Slope Pitch: ${pitch} slope design factors (${slopeFactor}x area multiplier).`);
    
    if (pitch === 'Steep') {
        factors.push("Steep Hazard Pay: Includes 30% steep access scaffolding & safety rigging setups.");
    }
    if (condition.toLowerCase() === 'poor' || roofAge === '20+ years') {
        factors.push("Decking Warning: Includes 15% structural buffer for rotten wood re-sheathing.");
    }
    if (propertyType.toLowerCase() === 'commercial') {
        factors.push("Commercial Compliance: Includes commercial-grade compliance and safety setup.");
    }

    // Recommended Next Steps
    const nextSteps = [
        "Perform physical core scan to inspect deck wood integrity.",
        "Take digital satellite slope photos to verify exact slope angles.",
        "Review architectural color shingle options (Charcoal, Hickory, Pewter).",
        "Discuss financing or insurance claim support during physical measurement."
    ];

    const summary = `Based on the information provided, your preliminary ${service.toLowerCase()} estimate is between $${minPrice.toLocaleString()} and $${maxPrice.toLocaleString()}. Final pricing requires an in-person inspection.`;

    return {
        minPrice,
        maxPrice,
        summary,
        factors,
        nextSteps,
        breakdown: {
            materials: Math.round(materialsCost),
            labor: Math.round(laborCost),
            fees: Math.round(permitsFees + debrisFees + mobilizationFee)
        }
    };
}

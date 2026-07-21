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

    // Rates configuration
    let baseMatRate = 3.60; // Asphalt shingles
    if (material.toLowerCase().includes('metal')) baseMatRate = 5.80;
    else if (material.toLowerCase().includes('tile')) baseMatRate = 8.50;
    else if (material.toLowerCase().includes('other')) baseMatRate = 4.80;

    const laborRate = 1.75;

    // Story accessibility multipliers
    let storyMult = 1.0;
    if (stories === '2') storyMult = 1.20;
    else if (stories === '3' || stories === '3+') storyMult = 1.40;

    // Wear condition multipliers
    let conditionMult = 1.0;
    if (condition.toLowerCase() === 'poor' || roofAge === '20+ years') conditionMult = 1.15; // rotten wood buffer
    else if (condition.toLowerCase() === 'fair') conditionMult = 1.05;

    let propertyMult = 1.0;
    if (propertyType.toLowerCase() === 'commercial') propertyMult = 1.25;

    // Pitch slope area factors & hazard multipliers
    let slopeFactor = 1.15; // standard slope
    let pitchLaborMultiplier = 1.0;

    if (pitch === 'Flat') {
        slopeFactor = 1.00;
    } else if (pitch === 'Steep') {
        slopeFactor = 1.35; // steep slope area expansion
        pitchLaborMultiplier = 1.30; // 30% steep hazard scaffolding surcharge
    }

    // Calculations based on surface area
    const surfaceArea = Math.round(roofSize * slopeFactor);

    let materialsCost = surfaceArea * baseMatRate;
    let laborCost = surfaceArea * laborRate * storyMult * propertyMult * pitchLaborMultiplier;
    let debrisFees = surfaceArea * 0.40; // dump fees

    // Apply condition multipliers
    materialsCost *= conditionMult;
    laborCost *= conditionMult;

    // Permits & safety setups
    const permitsFees = (materialsCost + laborCost) * 0.08;

    let total = materialsCost + laborCost + debrisFees + permitsFees;

    // Adjust if service is a localized repair
    let isRepair = service.toLowerCase() === 'repair';
    if (isRepair) {
        total = total * 0.22; // average repair ratio
    }

    const minPrice = Math.round((total * 0.90) / 100) * 100;
    const maxPrice = Math.round((total * 1.10) / 100) * 100;

    // Generate pricing factors dynamically
    const factors = [];
    if (isRepair) {
        factors.push("Localized leak repair scope based on specified surface wear area.");
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
            materials: Math.round(materialsCost * (isRepair ? 0.22 : 1)),
            labor: Math.round(laborCost * (isRepair ? 0.22 : 1)),
            fees: Math.round(permitsFees * (isRepair ? 0.22 : 1) + debrisFees * (isRepair ? 0.22 : 1))
        }
    };
}

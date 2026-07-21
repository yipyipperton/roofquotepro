// Deterministic Pricing Engine for Quotramax Estimator
export function calculateEstimate(lead) {
    const material = lead.material || 'Asphalt shingles';
    const stories = lead.stories || '1';
    const condition = lead.condition || 'Good';
    const service = lead.service || 'Replacement';
    const propertyType = lead.property_type || 'Residential';
    const roofSize = parseInt(lead.roof_size) || 2000;

    // Rates configuration (standard regional defaults)
    let baseMatRate = 3.60; // Asphalt shingles
    if (material.toLowerCase().includes('metal')) baseMatRate = 5.80;
    else if (material.toLowerCase().includes('tile')) baseMatRate = 8.50;
    else if (material.toLowerCase().includes('other')) baseMatRate = 4.80;

    const laborRate = 1.75;

    // Multipliers
    let storyMult = 1.0;
    if (stories === '2') storyMult = 1.20;
    else if (stories === '3' || stories === '3+') storyMult = 1.40;

    let conditionMult = 1.0;
    if (condition.toLowerCase() === 'poor') conditionMult = 1.15; // 15% deck buffer
    else if (condition.toLowerCase() === 'fair') conditionMult = 1.05; // 5% repair prep

    let propertyMult = 1.0;
    if (propertyType.toLowerCase() === 'commercial') propertyMult = 1.25; // commercial safety & compliance

    // Calculations based on surface area
    const slopeFactor = 1.15; // average slope pitch factor
    const surfaceArea = Math.round(roofSize * slopeFactor);

    let materialsCost = surfaceArea * baseMatRate;
    let laborCost = surfaceArea * laborRate * storyMult * propertyMult;
    let debrisFees = surfaceArea * 0.40; // dump fees

    // Apply condition multiplier
    materialsCost *= conditionMult;
    laborCost *= conditionMult;

    // Permits & compliance
    const permitsFees = (materialsCost + laborCost) * 0.08;

    let total = materialsCost + laborCost + debrisFees + permitsFees;

    // Adjust if service is a repair (localized repairs typically average 15-30% of a full replacement)
    let isRepair = service.toLowerCase() === 'repair';
    if (isRepair) {
        total = total * 0.22; // average repair ratio
    }

    const minPrice = Math.round((total * 0.90) / 100) * 100;
    const maxPrice = Math.round((total * 1.10) / 100) * 100;

    // Generate pricing factors dynamically
    const factors = [];
    if (isRepair) {
        factors.push("Localized leak repair scope based on specified 'Fair' or 'Poor' surface wear area.");
    } else {
        factors.push(`Complete tear-off and replacement of ${surfaceArea.toLocaleString()} sq ft of roof surface area.`);
    }
    factors.push(`Building Height: ${stories} story height accessibility safety setups.`);
    factors.push(`Material Style: High-performance ${material} base pricing rates.`);
    if (condition.toLowerCase() === 'poor') {
        factors.push("Condition Warning: Includes 15% buffer allowance for deck wood rot / structural re-sheathing.");
    }
    if (propertyType.toLowerCase() === 'commercial') {
        factors.push("Commercial Compliance: Includes commercial-grade permits, scaffolding, and safety compliance.");
    }

    // Recommended Next Steps
    const nextSteps = [
        "Schedule an in-person physical inspection to scan for deck wood rot.",
        "Perform precision digital satellite slope measurements to finalize dimensions.",
        "Choose custom shingles color styles and options (Charcoal, Slate, Hickory, etc.).",
        "Select warranty package protection plans (Lifetime Workmanship vs. Standard)."
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

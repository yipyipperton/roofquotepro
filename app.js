// Quotramax - Client Intake Portal Logic

// Application State
let appState = {
    currentStep: 1,
    formData: {
        name: '',
        email: '',
        phone: '',
        address: '',
        zip: '',
        coords: null,
        size: 2400, // Default average roof size
        material: 'asphalt',
        pitch: 'medium',
        stories: '1',
        livingArea: 2000,
        photoName: 'Default Demo House',
        photoSize: 'N/A'
    },
    pricingConfig: {}, // Loaded dynamically from server /api/settings
    fallbackPoints: [],
    isGoogleMapLoaded: false
};

// Google Maps global instances
let gMap = null;
let gPolygon = null;
let gDrawingManager = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    initNavigation();
    initIntakeForm();
    initMapDrawing();
    initSlider();
    initRealtimeCalculator();
});

// 1. API GET: Fetch pricing configurations from server
async function loadSettings() {
    try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to load settings from server');
        appState.pricingConfig = await response.json();
    } catch (err) {
        console.error('Error loading settings:', err);
        // Fallback default pricing in case server fails to respond
        appState.pricingConfig = {
            rateAsphalt: 1.50,
            rateMetal: 3.20,
            rateSlate: 5.80,
            rateInstall: 1.75,
            multSteep: 1.30,
            mult2Story: 1.20,
            mult3Story: 1.40,
            gmapsApiKey: ''
        };
    }
}

// 2. VIEW NAVIGATION
function initNavigation() {
    const btnPortal = document.getElementById('btn-portal-view');
    const intakeSection = document.getElementById('intake-portal');
    const loadingSection = document.getElementById('ai-loading-screen');
    const dashboardSection = document.getElementById('quote-dashboard');

    btnPortal.addEventListener('click', () => {
        [intakeSection, loadingSection, dashboardSection].forEach(sec => {
            sec.classList.remove('active');
            sec.style.display = 'none';
        });
        intakeSection.style.display = 'block';
        setTimeout(() => intakeSection.classList.add('active'), 50);
        resetFlow();
    });
}

// 3. MULTI-STEP INTAKE FORM NAVIGATION
function initIntakeForm() {
    const btnPropertyNext = document.getElementById('btn-property-next');
    const btnBasicsPrev = document.getElementById('btn-basics-prev');
    const btnBasicsNext = document.getElementById('btn-basics-next');
    const btnContactPrev = document.getElementById('btn-contact-prev');
    const btnContactSubmit = document.getElementById('btn-contact-submit');

    const stepProperty = document.getElementById('step-property');
    const stepBasics = document.getElementById('step-basics');
    const stepContact = document.getElementById('step-contact');

    // Sync home-size range slider and numeric input in Step 2
    const homeSizeRange = document.getElementById('home-size');
    const homeSizeNum = document.getElementById('home-size-num');
    const homeSizeVal = document.getElementById('home-size-val');

    function syncHomeSize(value) {
        let val = parseInt(value) || 2000;
        if (val < 1000) val = 1000;
        if (val > 5000) val = 5000;
        homeSizeRange.value = val;
        homeSizeNum.value = val;
        homeSizeVal.textContent = val.toLocaleString();
        appState.formData.livingArea = val;
    }

    if (homeSizeRange && homeSizeNum && homeSizeVal) {
        homeSizeRange.addEventListener('input', (e) => {
            syncHomeSize(e.target.value);
        });
        homeSizeNum.addEventListener('input', (e) => {
            syncHomeSize(e.target.value);
        });
    }

    // Sync material cards and form material dropdown selects
    const roofMaterialSelect = document.getElementById('roof-material');
    const miniCards = document.querySelectorAll('.mini-card');
    
    if (roofMaterialSelect && miniCards.length > 0) {
        roofMaterialSelect.addEventListener('change', (e) => {
            const selectedVal = e.target.value;
            miniCards.forEach(card => {
                const clickAttr = card.getAttribute('onclick') || '';
                if (clickAttr.includes(selectedVal)) {
                    card.classList.add('active');
                } else {
                    card.classList.remove('active');
                }
            });
        });

        miniCards.forEach(card => {
            card.addEventListener('click', () => {
                miniCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
            });
        });
    }

    function updateStepIndicator(step) {
        document.querySelectorAll('.progress-step').forEach(indicator => {
            const stepNum = parseInt(indicator.dataset.step);
            indicator.classList.remove('active', 'completed');
            if (stepNum === step) {
                indicator.classList.add('active');
            } else if (stepNum < step) {
                indicator.classList.add('completed');
            }
        });
    }

    function switchStep(fromStepEl, toStepEl, stepNum) {
        fromStepEl.classList.remove('active');
        setTimeout(() => {
            fromStepEl.style.display = 'none';
            toStepEl.style.display = 'block';
            setTimeout(() => {
                toStepEl.classList.add('active');
                updateStepIndicator(stepNum);
                appState.currentStep = stepNum;
            }, 50);
        }, 300);
    }

    // Step 1: Basics Next Click (goes to Step 2: Property Location)
    btnBasicsNext.addEventListener('click', () => {
        appState.formData.stories = document.getElementById('roof-stories').value;
        appState.formData.age = document.getElementById('roof-age').value;
        appState.formData.material = document.getElementById('roof-material').value;
        appState.formData.livingArea = parseInt(document.getElementById('home-size').value) || 2000;

        switchStep(stepBasics, stepProperty, 2);
    });

    // Step 2: Property Back Click (goes to Step 1: Basics)
    const btnPropertyPrev = document.getElementById('btn-property-prev');
    if (btnPropertyPrev) {
        btnPropertyPrev.addEventListener('click', () => {
            switchStep(stepProperty, stepBasics, 1);
        });
    }

    // Step 2: Property Next Click (goes to Step 3: Contact Details)
    btnPropertyNext.addEventListener('click', () => {
        const address = document.getElementById('cust-address').value.trim();
        const zip = document.getElementById('cust-zip').value.trim();
        const motivation = document.getElementById('cust-motivation').value;

        if (!address || !zip) {
            alert('Please enter your property address and ZIP Code.');
            return;
        }

        if (!/^\d{5}$/.test(zip)) {
            alert('Please enter a valid 5-digit ZIP Code.');
            return;
        }

        appState.formData.address = address;
        appState.formData.zip = zip;
        appState.formData.motivation = motivation;

        switchStep(stepProperty, stepContact, 3);
    });

    // Step 3: Contact Back Click (goes to Step 2: Property Location)
    btnContactPrev.addEventListener('click', () => {
        switchStep(stepContact, stepProperty, 2);
    });

    btnContactSubmit.addEventListener('click', () => {
        const name = document.getElementById('cust-name').value.trim();
        const email = document.getElementById('cust-email').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();

        if (!name || !email || !phone) {
            alert('Please fill out your name, email, and phone number.');
            return;
        }

        appState.formData.name = name;
        appState.formData.email = email;
        appState.formData.phone = phone;

        startAILoader();
    });
}

// 4. MAP DRAWING INTEGRATION
// 4. MAP DRAWING INTEGRATION
function initMapDrawing() {
    // Automatic selection is pre-computed, no manual drawing needed.
}

function loadIntakeMap(address, zip, isFallback = false) {
    const apiKey = appState.pricingConfig.gmapsApiKey;
    const mapCanvas = document.getElementById('map-canvas');

    if (!isFallback && apiKey && apiKey.trim() !== '' && apiKey !== 'YOUR_GMAPS_API_KEY_ENVIRONMENT_VARIABLE') {
        loadGoogleMapScript(apiKey, address, zip);
    } else {
        appState.isGoogleMapLoaded = false;
        // Fallback/Demo mode displays static map with SVG outline overlay
        mapCanvas.innerHTML = `
            <svg viewBox="0 0 400 300" class="demo-auto-polygon-overlay" style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index: 10;">
                <polygon points="110,85 290,70 310,205 130,220" fill="rgba(99, 102, 241, 0.22)" stroke="#6366f1" stroke-width="3" />
            </svg>
            <div class="map-center-pin-overlay">
                <svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="icon-pin" style="width: 38px; height: 38px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3" fill="#ef4444"/>
                </svg>
            </div>
        `;
        mapCanvas.classList.add('fallback-bg');
        appState.formData.size = 2400; // Reset size to standard default
    }
}

function loadGoogleMapScript(apiKey, address, zip) {
    // Intercept Google Maps API key restriction or auth failures
    window.gm_authFailure = () => {
        console.warn("Google Maps API auth failure. Reverting to demo mode.");
        appState.isGoogleMapLoaded = false;

        // If currently displaying Step 2 outline, hot-swap to demo fallback layout
        if (appState.currentStep === 2) {
            loadIntakeMap(appState.formData.address, appState.formData.zip, true);
        }
    };

    if (window.google && window.google.maps) {
        appState.isGoogleMapLoaded = true;
        initGoogleMap(address, zip);
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMapsCallback`;
    script.async = true;
    script.defer = true;
    
    window.initGoogleMapsCallback = () => {
        appState.isGoogleMapLoaded = true;
        initGoogleMap(address, zip);
    };
    document.head.appendChild(script);
}

function initGoogleMap(address, zip) {
    const mapCanvas = document.getElementById('map-canvas');
    mapCanvas.classList.remove('fallback-bg');
    mapCanvas.innerHTML = '';

    const geocoder = new google.maps.Geocoder();
    const query = `${address}, ${zip}`;

    geocoder.geocode({ address: query }, (results, status) => {
        if (status !== 'OK' || !results[0]) {
            console.warn("Geocoding failed or denied. Falling back to demo mode. Status:", status);
            appState.isGoogleMapLoaded = false;
            loadIntakeMap(address, zip, true);
            return;
        }

        const center = results[0].geometry.location;

        gMap = new google.maps.Map(mapCanvas, {
            zoom: 20, // Close satellite rooftop view
            center: center,
            mapTypeId: 'satellite',
            tilt: 0,
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: 'greedy' // Enable mobile/desktop panning to align roof
        });

        // Glowing indigo polygon overlay representing scanned roof footprint
        const roofPolygon = new google.maps.Polygon({
            strokeColor: '#6366f1',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            fillColor: '#6366f1',
            fillOpacity: 0.22,
            map: gMap
        });

        // Dynamically compute and adjust polygon boundary center coordinates
        const updatePolygonCenter = (newCenter) => {
            const lat = newCenter.lat ? newCenter.lat() : newCenter.lat;
            const lng = newCenter.lng ? newCenter.lng() : newCenter.lng;

            // Bounding offset sizes representing average roof footprint
            const offsetLat = 0.00010;
            const offsetLng = 0.00012;

            const roofCoords = [
                { lat: lat + offsetLat, lng: lng - offsetLng }, // top-left
                { lat: lat + offsetLat, lng: lng + offsetLng }, // top-right
                { lat: lat - offsetLat, lng: lng + offsetLng }, // bottom-right
                { lat: lat - offsetLat, lng: lng - offsetLng }  // bottom-left
            ];
            roofPolygon.setPaths(roofCoords);
        };

        // Render initial footprint center
        updatePolygonCenter(center);

        // Keep outline polygon locked to map center dynamically as roofer pans/drags the view
        gMap.addListener('center_changed', () => {
            updatePolygonCenter(gMap.getCenter());
        });

        appState.formData.size = 2400; // Reset size to standard default
    });
}

// 5. SPEED-UP AI LOADER SIMULATION
function startAILoader() {
    const intakeSection = document.getElementById('intake-portal');
    const loadingSection = document.getElementById('ai-loading-screen');
    const progressFill = document.getElementById('progress-fill');
    const loadingPercent = document.getElementById('loading-percent');
    const statusLogs = document.getElementById('status-logs').children;

    intakeSection.classList.remove('active');
    setTimeout(() => {
        intakeSection.style.display = 'none';
        loadingSection.style.display = 'block';
        setTimeout(() => loadingSection.classList.add('active'), 50);
    }, 300);

    let progress = 0;
    const duration = 5000;
    const intervalTime = 50;
    const totalSteps = duration / intervalTime;
    const progressPerStep = 100 / totalSteps;
    const circleCircumference = 314.159;

    const interval = setInterval(() => {
        progress += progressPerStep;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            saveLeadAndNavigate();
        }

        loadingPercent.textContent = Math.round(progress) + '%';
        const offset = circleCircumference - (progress / 100) * circleCircumference;
        progressFill.style.strokeDashoffset = offset;

        const currentLogIdx = Math.min(Math.floor((progress / 100) * statusLogs.length), statusLogs.length - 1);
        for (let i = 0; i < statusLogs.length; i++) {
            statusLogs[i].classList.remove('active');
            if (i < currentLogIdx) {
                statusLogs[i].classList.add('completed');
            } else if (i === currentLogIdx) {
                statusLogs[i].classList.add('active');
            }
        }
    }, intervalTime);
}

// 6. CALCULATE COST AND SAVE LEAD ON SERVER
function calculateQuote(size, material, pitch, stories, useDirectSize = false) {
    const cfg = appState.pricingConfig;
    
    let calculatedSize = size;
    if (!useDirectSize) {
        const storiesCount = parseInt(stories) || 1;
        const livingArea = parseInt(appState.formData.livingArea) || 2000;
        calculatedSize = Math.round((livingArea / storiesCount) * 1.35);
        // Sync back to state size
        appState.formData.size = calculatedSize;
    }

    let baseMatRate = cfg.rateAsphalt;
    if (material === 'metal') baseMatRate = cfg.rateMetal;
    else if (material === 'slate') baseMatRate = cfg.rateSlate;

    const laborRate = cfg.rateInstall;

    let pitchMult = 1.0;
    if (pitch === 'steep') pitchMult = cfg.multSteep;

    let storyMult = 1.0;
    if (stories === '2') storyMult = cfg.mult2Story;
    else if (stories === '3') storyMult = cfg.mult3Story;

    let materialsCost = calculatedSize * baseMatRate * pitchMult;
    let laborCost = calculatedSize * laborRate * pitchMult * storyMult;

    // Apply 10% deck integrity / wood replacement buffer if active leak or over 20 years old
    if (appState.formData.motivation === 'leak' || appState.formData.age === 'old') {
        materialsCost *= 1.10;
        laborCost *= 1.10;
    }

    const permitsFees = (materialsCost + laborCost) * 0.10;
    const totalCost = materialsCost + laborCost + permitsFees;

    return {
        materials: Math.round(materialsCost),
        labor: Math.round(laborCost),
        fees: Math.round(permitsFees),
        total: Math.round(totalCost)
    };
}

async function saveLeadAndNavigate() {
    const loadingSection = document.getElementById('ai-loading-screen');
    const dashboardSection = document.getElementById('quote-dashboard');

    const info = appState.formData;
    const pricing = calculateQuote(info.size, info.material, info.pitch, info.stories, false);

    const newLead = {
        date: new Date().toISOString().split('T')[0],
        name: info.name,
        email: info.email,
        phone: info.phone,
        address: info.address,
        size: info.size,
        material: info.material,
        price: pricing.total,
        motivation: info.motivation,
        age: info.age,
        stories: info.stories,
        livingArea: info.livingArea,
        status: 'sent',
        honeypot: document.getElementById('honeypot-field') ? document.getElementById('honeypot-field').value : ''
    };

    try {
        await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLead)
        });
    } catch (err) {
        console.error('Error dispatching lead to server:', err);
    }

    document.getElementById('res-address').textContent = info.address;
    document.getElementById('adj-size').value = info.size;
    document.getElementById('adj-size-val').textContent = info.size.toLocaleString() + ' sq ft';
    document.getElementById('adj-material').value = info.material;

    updateDashboardPricingDisplay(pricing);

    loadingSection.classList.remove('active');
    setTimeout(() => {
        loadingSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        setTimeout(() => dashboardSection.classList.add('active'), 50);
        
        const smsAlert = document.getElementById('sms-alert');
        smsAlert.style.display = 'flex';
        setTimeout(() => {
            smsAlert.style.opacity = '0';
            setTimeout(() => smsAlert.style.display = 'none', 400);
        }, 6000);
    }, 300);
}

function updateDashboardPricingDisplay(pricing) {
    const minRange = Math.round(pricing.total * 0.95);
    const maxRange = Math.round(pricing.total * 1.05);

    document.getElementById('res-price-range').textContent = `$${minRange.toLocaleString()} - $${maxRange.toLocaleString()}`;
    document.getElementById('val-materials').textContent = `$${pricing.materials.toLocaleString()}`;
    document.getElementById('val-labor').textContent = `$${pricing.labor.toLocaleString()}`;
    document.getElementById('val-fees').textContent = `$${pricing.fees.toLocaleString()}`;
    document.getElementById('val-total').textContent = `$${pricing.total.toLocaleString()}`;
}

// 7. REAL-TIME ADJUSTERS ON DASHBOARD
function initRealtimeCalculator() {
    const adjSize = document.getElementById('adj-size');
    const adjSizeVal = document.getElementById('adj-size-val');
    const adjMaterial = document.getElementById('adj-material');

    function updateCalculator() {
        const size = parseInt(adjSize.value);
        const material = adjMaterial.value;
        const pitch = appState.formData.pitch;
        const stories = appState.formData.stories;

        adjSizeVal.textContent = size.toLocaleString() + ' sq ft';
        
        const pricing = calculateQuote(size, material, pitch, stories, true);
        updateDashboardPricingDisplay(pricing);

        const labelAfter = document.querySelector('.label-after');
        if (material === 'asphalt') {
            labelAfter.textContent = 'AFTER (NEW CHARCOAL ROOF)';
        } else if (material === 'metal') {
            labelAfter.textContent = 'AFTER (NEW SEAM METAL ROOF)';
        } else if (material === 'slate') {
            labelAfter.textContent = 'AFTER (NEW SLATE TILE ROOF)';
        }
    }

    adjSize.addEventListener('input', updateCalculator);
    adjMaterial.addEventListener('change', updateCalculator);

    document.getElementById('btn-restart-flow').addEventListener('click', () => {
        document.getElementById('btn-portal-view').click();
    });

    document.getElementById('btn-schedule-inspect').addEventListener('click', () => {
        alert('Thank you! A project manager has been notified. We will call you within 1 hour to schedule your in-person roof inspection.');
    });

    document.getElementById('btn-download-pdf').addEventListener('click', () => {
        window.print();
    });
}

// 8. BEFORE/AFTER SLIDER INTERACTION
function initSlider() {
    const container = document.getElementById('slider-container');
    const overlay = document.getElementById('slider-overlay');
    const handle = document.getElementById('slider-handle');

    let isSliding = false;

    function moveSlider(clientX) {
        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left;
        
        let percent = (x / rect.width) * 100;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;

        overlay.style.width = percent + '%';
        handle.style.left = percent + '%';
    }

    handle.addEventListener('mousedown', () => isSliding = true);
    window.addEventListener('mouseup', () => isSliding = false);
    container.addEventListener('mousemove', (e) => {
        if (!isSliding) return;
        moveSlider(e.clientX);
    });

    handle.addEventListener('touchstart', () => isSliding = true);
    window.addEventListener('touchend', () => isSliding = false);
    container.addEventListener('touchmove', (e) => {
        if (!isSliding) return;
        if (e.touches && e.touches[0]) {
            moveSlider(e.touches[0].clientX);
        }
    });

    container.addEventListener('click', (e) => {
        if (e.target.closest('#slider-handle')) return;
        moveSlider(e.clientX);
    });
}

// 9. CLEAN RECOVERY RESET FLOW
function resetFlow() {
    document.getElementById('step-basics').style.display = 'none';
    document.getElementById('step-contact').style.display = 'none';
    
    const stepProperty = document.getElementById('step-property');
    stepProperty.style.display = 'block';
    setTimeout(() => stepProperty.classList.add('active'), 50);

    document.getElementById('cust-address').value = '';
    document.getElementById('cust-zip').value = '';
    document.getElementById('cust-motivation').value = 'leak';
    document.getElementById('roof-stories').value = '1';
    document.getElementById('roof-age').value = 'new';
    document.getElementById('roof-material').value = 'asphalt';
    document.getElementById('home-size').value = 2000;
    document.getElementById('home-size-num').value = 2000;
    document.getElementById('home-size-val').textContent = '2,000';
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-email').value = '';
    document.getElementById('cust-phone').value = '';

    appState.currentStep = 1;
    appState.formData = {
        name: '',
        email: '',
        phone: '',
        address: '',
        zip: '',
        size: 2200,
        material: 'asphalt',
        pitch: 'medium',
        stories: '1',
        livingArea: 2000,
        motivation: 'leak',
        age: 'new'
    };

    document.querySelectorAll('.progress-step').forEach(indicator => {
        indicator.classList.remove('active', 'completed');
    });
    document.querySelector('.progress-step.step-1').classList.add('active');
}

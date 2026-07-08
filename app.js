// RoofQuote AI - Client Intake Portal Logic

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
    const btnContactNext = document.getElementById('btn-contact-next');
    const btnMapPrev = document.getElementById('btn-map-prev');
    const btnMapNext = document.getElementById('btn-map-next');
    const btnSpecsPrev = document.getElementById('btn-specs-prev');
    const btnSpecsNext = document.getElementById('btn-specs-next');
    const btnUploadPrev = document.getElementById('btn-upload-prev');
    const btnUploadSubmit = document.getElementById('btn-upload-submit');
    const btnSkipPhoto = document.getElementById('btn-skip-photo');

    const stepContact = document.getElementById('step-contact');
    const stepMap = document.getElementById('step-map');
    const stepSpecs = document.getElementById('step-specs');
    const stepUpload = document.getElementById('step-upload');

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const filePreview = document.getElementById('file-preview');
    const previewFileName = document.getElementById('preview-file-name');
    const previewFileSize = document.getElementById('preview-file-size');
    const btnRemoveFile = document.getElementById('btn-remove-file');

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

    // Step 1 -> Step 2
    btnContactNext.addEventListener('click', () => {
        const name = document.getElementById('cust-name').value.trim();
        const email = document.getElementById('cust-email').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const address = document.getElementById('cust-address').value.trim();
        const zip = document.getElementById('cust-zip').value.trim();

        if (!name || !email || !phone || !address || !zip) {
            alert('Please fill out all contact fields, including ZIP Code.');
            return;
        }

        if (!/^\d{5}$/.test(zip)) {
            alert('Please enter a valid 5-digit ZIP Code.');
            return;
        }

        appState.formData.name = name;
        appState.formData.email = email;
        appState.formData.phone = phone;
        appState.formData.address = address;
        appState.formData.zip = zip;

        switchStep(stepContact, stepMap, 2);
        loadIntakeMap(address, zip);
    });

    // Step 2 -> Step 1/3
    btnMapPrev.addEventListener('click', () => {
        switchStep(stepMap, stepContact, 1);
    });

    btnMapNext.addEventListener('click', () => {
        if (appState.formData.size === 0 && appState.fallbackPoints.length === 0) {
            const proceed = confirm("No roof outline drawn. Would you like to proceed with a standard 2,400 sq ft roof estimate?");
            if (!proceed) return;
            appState.formData.size = 2400;
        }
        document.getElementById('roof-size').value = appState.formData.size;
        switchStep(stepMap, stepSpecs, 3);
    });

    // Step 3 -> Step 2/4
    btnSpecsPrev.addEventListener('click', () => {
        switchStep(stepSpecs, stepMap, 2);
    });

    btnSpecsNext.addEventListener('click', () => {
        appState.formData.size = parseInt(document.getElementById('roof-size').value) || 2400;
        appState.formData.material = document.getElementById('roof-material').value;
        appState.formData.pitch = document.getElementById('roof-pitch').value;
        appState.formData.stories = document.getElementById('roof-stories').value;

        switchStep(stepSpecs, stepUpload, 4);
    });

    // Step 4 file attachments
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'));
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelection(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelection(e.target.files[0]);
        }
    });

    function handleFileSelection(file) {
        appState.formData.photoName = file.name;
        appState.formData.photoSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        
        previewFileName.textContent = appState.formData.photoName;
        previewFileSize.textContent = appState.formData.photoSize;
        
        filePreview.classList.remove('hidden');
        dropZone.style.display = 'none';

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('before-img-element').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    btnRemoveFile.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.value = '';
        filePreview.classList.add('hidden');
        dropZone.style.display = 'block';
        appState.formData.photoName = 'Default Demo House';
        appState.formData.photoSize = 'N/A';
        document.getElementById('before-img-element').src = 'assets/roof_before.jpg';
    });

    btnSkipPhoto.addEventListener('click', () => {
        appState.formData.photoName = 'Default Demo House';
        appState.formData.photoSize = 'N/A';
        document.getElementById('before-img-element').src = 'assets/roof_before.jpg';
        btnUploadSubmit.click();
    });

    btnUploadPrev.addEventListener('click', () => {
        switchStep(stepUpload, stepSpecs, 3);
    });

    btnUploadSubmit.addEventListener('click', startAILoader);
}

// 4. MAP DRAWING INTEGRATION
// 4. MAP DRAWING INTEGRATION
function initMapDrawing() {
    // Automatic selection is pre-computed, no manual drawing needed.
}

function loadIntakeMap(address, zip) {
    const apiKey = appState.pricingConfig.gmapsApiKey;
    const mapCanvas = document.getElementById('map-canvas');

    if (apiKey && apiKey.trim() !== '') {
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
            loadIntakeMap(appState.formData.address, appState.formData.zip);
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
        let center = { lat: 29.7604, lng: -95.3698 };
        if (status === 'OK' && results[0]) {
            center = results[0].geometry.location;
        }

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
function calculateQuote(size, material, pitch, stories) {
    const cfg = appState.pricingConfig;
    let baseMatRate = cfg.rateAsphalt;
    if (material === 'metal') baseMatRate = cfg.rateMetal;
    else if (material === 'slate') baseMatRate = cfg.rateSlate;

    const laborRate = cfg.rateInstall;

    let pitchMult = 1.0;
    if (pitch === 'steep') pitchMult = cfg.multSteep;

    let storyMult = 1.0;
    if (stories === '2') storyMult = cfg.mult2Story;
    else if (stories === '3') storyMult = cfg.mult3Story;

    const materialsCost = size * baseMatRate * pitchMult;
    const laborCost = size * laborRate * pitchMult * storyMult;
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
    const pricing = calculateQuote(info.size, info.material, info.pitch, info.stories);

    // Save lead details on server
    const newLead = {
        date: new Date().toISOString().split('T')[0],
        name: info.name,
        email: info.email,
        phone: info.phone,
        address: info.address,
        size: info.size,
        material: info.material,
        price: pricing.total,
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
        
        const pricing = calculateQuote(size, material, pitch, stories);
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
    document.getElementById('step-map').style.display = 'none';
    document.getElementById('step-specs').style.display = 'none';
    document.getElementById('step-upload').style.display = 'none';
    
    const stepContact = document.getElementById('step-contact');
    stepContact.style.display = 'block';
    setTimeout(() => stepContact.classList.add('active'), 50);

    document.getElementById('cust-name').value = '';
    document.getElementById('cust-email').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-address').value = '';
    document.getElementById('cust-zip').value = '';
    document.getElementById('file-input').value = '';
    
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('drop-zone').style.display = 'block';

    appState.currentStep = 1;
    appState.fallbackPoints = [];
    appState.formData = {
        name: '',
        email: '',
        phone: '',
        address: '',
        zip: '',
        size: 2400,
        material: 'asphalt',
        pitch: 'medium',
        stories: '1',
        photoName: 'Default Demo House',
        photoSize: 'N/A'
    };

    document.querySelectorAll('.progress-step').forEach(indicator => {
        indicator.classList.remove('active', 'completed');
    });
    document.querySelector('.progress-step.step-1').classList.add('active');
}

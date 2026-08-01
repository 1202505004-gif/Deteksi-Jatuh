/* ==========================================================================
   ElderGuard Pro - Wearable Fall Detection Engine & Simulator Logic
   ========================================================================== */

// --- Global Application State ---
const state = {
    // Current Sensor Reading
    ax: 0.05,
    ay: 0.12,
    az: 0.98,
    gForce: 1.02,
    tiltAngle: 12,
    bpm: 74,
    spo2: 98,
    battery: 89,
    
    // Fall Detection Algorithm Thresholds
    thresholdImpact: 2.8, // in g
    thresholdFreefall: 0.6, // in g
    thresholdTilt: 60, // in degrees
    
    // Algorithm Stage Flags
    freefallDetected: false,
    impactDetected: false,
    postureTiltDetected: false,
    motionlessTimer: 0,
    
    // Status
    systemStatus: 'SAFE', // 'SAFE', 'WARNING', 'EMERGENCY'
    currentScenario: 'NORMAL',
    currentRoom: 'Kamar Mandi Utama',
    
    // Emergency Modal & Siren
    emergencyActive: false,
    countdownValue: 15,
    countdownMax: 15,
    countdownTimerId: null,
    audioContext: null,
    sirenOscillator: null,
    sirenGain: null,
    soundEnabled: true,
    patientName: 'Opa Harun',

    // Incident Logs
    logs: [
        {
            time: 'Yesterday 14:22:05',
            event: 'Simulasi Terpleset (Dibatalkan)',
            gforce: '3.12g',
            posture: 'Telentang (78°)',
            location: 'Kamar Mandi',
            status: 'Batal (False Alarm)'
        },
        {
            time: '2026-07-28 09:15:30',
            event: 'Deteksi Duduk Tiba-tiba',
            gforce: '1.85g',
            posture: 'Tegak (18°)',
            location: 'Ruang Tamu',
            status: 'Aman (Normal)'
        }
    ],
    
    // Chart buffer
    chartData: {
        x: new Array(60).fill(0.05),
        y: new Array(60).fill(0.12),
        z: new Array(60).fill(0.98),
        total: new Array(60).fill(1.02)
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initNavigation();
    initSensorChart();
    initAudioEngine();
    renderLogs();
    updatePatientNameUI();
    
    // Start main sensor telemetry loop (30 FPS simulation)
    setInterval(updateTelemetryLoop, 100);
});

function updatePatientNameUI() {
    const nameDisplay = document.getElementById('patient-name-display');
    const initialsDisplay = document.getElementById('patient-initials-display');
    const mapTooltip = document.getElementById('map-patient-tooltip');
    const dispatchText = document.getElementById('dispatch-text');
    
    if (nameDisplay) nameDisplay.innerText = `${state.patientName} (78 th)`;
    
    if (initialsDisplay) {
        const initials = state.patientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        initialsDisplay.innerText = initials;
    }
    
    if (mapTooltip) {
        mapTooltip.innerText = `${state.patientName} (Di ${state.currentRoom})`;
    }
    
    if (dispatchText) {
        dispatchText.value = `[ALERT SOS JATUH DETEKSI]
Pasien: ${state.patientName} (78 th)
Status: EMERGENCY FALL DETECTED!
Impact: ${state.gForce.toFixed(2)}g
Postur: ${state.tiltAngle > 45 ? 'Telentang' : 'Tegak'} (Tilt ${state.tiltAngle}°)
Lokasi: ${state.currentRoom} (GPS: -6.2088, 106.8456)
BPM: ${state.bpm} BPM
Waktu: Realtime
Mohon segera cek kondisi pasien!`;
    }
}

// --- Realtime Clock ---
function initClock() {
    const clockEl = document.getElementById('clock-display');
    const updateTime = () => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        const secs = String(now.getSeconds()).padStart(2, '0');
        if (clockEl) clockEl.innerText = `${hrs}:${mins}:${secs} WIB`;
        
        const simTimeEl = document.getElementById('sim-screen-time');
        if (simTimeEl) simTimeEl.innerText = `${hrs}:${mins}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
}

// --- Navigation Tabs ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabSections = document.querySelectorAll('.tab-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            navItems.forEach(nav => nav.classList.remove('active'));
            tabSections.forEach(sec => sec.classList.remove('active'));
            
            item.classList.add('active');
            const targetSec = document.getElementById(targetId);
            if (targetSec) targetSec.classList.add('active');
        });
    });

    // SOS Manual Trigger Header Button
    const btnHeaderSos = document.getElementById('btn-manual-sos');
    if (btnHeaderSos) {
        btnHeaderSos.addEventListener('click', () => {
            triggerMotionScenario('SLIP_FALL');
        });
    }

    // Wearable SOS Button
    const btnSimSos = document.getElementById('sim-sos-button');
    if (btnSimSos) {
        btnSimSos.addEventListener('click', () => {
            triggerMotionScenario('SLIP_FALL');
        });
    }
}

// --- Telemetry Simulation Engine ---
function updateTelemetryLoop() {
    // Apply jitter based on scenario
    let noiseX = (Math.random() - 0.5) * 0.04;
    let noiseY = (Math.random() - 0.5) * 0.04;
    let noiseZ = (Math.random() - 0.5) * 0.04;
    
    if (state.currentScenario === 'WALK') {
        const time = Date.now() * 0.008;
        state.ax = 0.15 * Math.sin(time) + noiseX;
        state.ay = 0.25 * Math.cos(time * 1.5) + noiseY;
        state.az = 0.95 + 0.2 * Math.sin(time * 2) + noiseZ;
        state.tiltAngle = Math.max(5, Math.min(25, 12 + Math.floor(Math.sin(time) * 8)));
        state.bpm = 76 + Math.floor(Math.sin(time) * 4);
    } else if (state.currentScenario === 'SIT') {
        state.ax = noiseX * 0.5;
        state.ay = 0.15 + noiseY * 0.5;
        state.az = 0.98 + noiseZ * 0.5;
        state.tiltAngle = 18;
        state.bpm = 72;
    } else if (state.currentScenario === 'SLIP_FALL' || state.currentScenario === 'FAINT_FALL') {
        // High tilt post fall & motionless
        state.ax = noiseX * 0.2;
        state.ay = 0.85 + noiseY * 0.2;
        state.az = 0.25 + noiseZ * 0.2;
    } else if (state.currentScenario === 'NORMAL') {
        state.ax = noiseX;
        state.ay = 0.12 + noiseY;
        state.az = 0.98 + noiseZ;
        state.tiltAngle = 12;
        state.bpm = 74;
    }

    // Calculate Total Acceleration magnitude |A|
    state.gForce = Math.sqrt(state.ax * state.ax + state.ay * state.ay + state.az * state.az);

    // Update UI Vitals & Dispatch Payload
    updateVitalsUI();
    updatePatientNameUI();
    
    // Push into chart buffer
    state.chartData.x.shift(); state.chartData.x.push(state.ax);
    state.chartData.y.shift(); state.chartData.y.push(state.ay);
    state.chartData.z.shift(); state.chartData.z.push(state.az);
    state.chartData.total.shift(); state.chartData.total.push(state.gForce);
    
    // Draw chart
    renderSensorChart();
    
    // Run Fall Algorithm Evaluator
    evaluateFallAlgorithm();
}

function updateVitalsUI() {
    const valG = document.getElementById('val-gforce');
    const valTilt = document.getElementById('val-tilt');
    const valBpm = document.getElementById('val-bpm');
    const valSpo2 = document.getElementById('val-spo2');
    const valBat = document.getElementById('val-battery');
    
    if (valG) valG.innerHTML = `${state.gForce.toFixed(2)} <span class="unit">g</span>`;
    if (valTilt) valTilt.innerHTML = `${state.tiltAngle}° <span class="unit">${state.tiltAngle > 45 ? 'horizontal/tidur' : 'tegak'}</span>`;
    if (valBpm) valBpm.innerText = state.bpm;
    if (valSpo2) valSpo2.innerText = `${state.spo2}%`;
    if (valBat) valBat.innerText = `${state.battery}%`;

    // Wearable Mockup Screen Updates
    const simText = document.getElementById('sim-screen-text');
    const simG = document.getElementById('sim-screen-g');
    if (simText) simText.innerText = state.systemStatus;
    if (simG) simG.innerText = `${state.gForce.toFixed(1)}g`;
}

// --- Motion Scenarios Handler ---
function triggerMotionScenario(type) {
    state.currentScenario = type;
    
    const stageFreefall = document.getElementById('stage-freefall');
    const stageImpact = document.getElementById('stage-impact');
    const stagePosture = document.getElementById('stage-posture');
    const stageMotionless = document.getElementById('stage-motionless');

    // Reset stages
    [stageFreefall, stageImpact, stagePosture, stageMotionless].forEach(el => {
        if (el) el.className = 'stage-item';
    });

    if (type === 'SLIP_FALL') {
        // Step 1: Freefall spike
        state.ax = 0.1; state.ay = 0.1; state.az = 0.2; // ~0.24g
        state.freefallDetected = true;
        if (stageFreefall) stageFreefall.className = 'stage-item stage-triggered';

        setTimeout(() => {
            // Step 2: Impact shock peak
            state.ax = 1.8; state.ay = 2.4; state.az = 1.9; // ~3.53g impact shock!
            state.impactDetected = true;
            state.gForce = 3.53;
            state.bpm = 114;
            if (stageImpact) stageImpact.className = 'stage-item stage-triggered';

            setTimeout(() => {
                // Step 3: Tilt change
                state.tiltAngle = 82; // horizontal lying posture
                state.postureTiltDetected = true;
                if (stagePosture) stagePosture.className = 'stage-item stage-triggered';

                setTimeout(() => {
                    // Step 4: Motionless post-fall -> Trigger Alert!
                    if (stageMotionless) stageMotionless.className = 'stage-item stage-triggered';
                    triggerEmergencyAlert('SLIP_FALL', 3.53, 82, 'Kamar Mandi Utama');
                }, 600);
            }, 400);
        }, 300);
    } 
    else if (type === 'FAINT_FALL') {
        state.ax = 0.05; state.ay = 0.05; state.az = 0.1; // freefall
        state.freefallDetected = true;
        if (stageFreefall) stageFreefall.className = 'stage-item stage-triggered';

        setTimeout(() => {
            state.ax = 1.6; state.ay = 2.1; state.az = 1.8; // ~3.18g impact
            state.impactDetected = true;
            state.tiltAngle = 76;
            state.bpm = 125;
            if (stageImpact) stageImpact.className = 'stage-item stage-triggered';
            if (stagePosture) stagePosture.className = 'stage-item stage-triggered';

            setTimeout(() => {
                if (stageMotionless) stageMotionless.className = 'stage-item stage-triggered';
                triggerEmergencyAlert('FAINT_FALL', 3.18, 76, 'Kamar Tidur Utama');
            }, 800);
        }, 400);
    }
    else if (type === 'DROP_ACCIDENT') {
        // High shock impact but posture quickly returns upright (False alarm)
        state.ax = 2.2; state.ay = 2.5; state.az = 1.8; // 3.75g shock
        if (stageImpact) stageImpact.className = 'stage-item stage-triggered';

        setTimeout(() => {
            state.tiltAngle = 10; // upright
            state.currentScenario = 'NORMAL';
            showToast('Alat Terjatuh Detected (False Alarm - Postur Tetap Tegak)');
        }, 500);
    }
    else if (type === 'RECOVER') {
        state.currentScenario = 'NORMAL';
        state.freefallDetected = false;
        state.impactDetected = false;
        state.postureTiltDetected = false;
        state.systemStatus = 'SAFE';
        state.tiltAngle = 12;
        state.bpm = 74;
        
        updateGlobalStatus('SAFE', 'STATUS: AMAN');
        stopSirenAudio();
        
        const modal = document.getElementById('emergency-modal');
        if (modal) modal.classList.remove('modal-active');
        if (state.countdownTimerId) clearInterval(state.countdownTimerId);
    }
}

function evaluateFallAlgorithm() {
    // Continuous evaluation logic
    if (state.gForce > state.thresholdImpact && !state.emergencyActive && state.currentScenario === 'NORMAL') {
        // Spike detected during normal ops
        state.impactDetected = true;
    }
}

// --- Emergency Alert System & Countdown ---
function triggerEmergencyAlert(eventTitle, peakG, tilt, room) {
    state.emergencyActive = true;
    state.systemStatus = 'EMERGENCY';
    state.currentRoom = room;
    
    updateGlobalStatus('EMERGENCY', 'EMERGENCY FALL DETECTED!');
    
    // Update Map Marker Location
    updateIndoorMapPosition(room);
    
    // Audio Siren Playback
    if (state.soundEnabled) {
        startSirenAudio();
    }
    
    // Modal Display
    const modal = document.getElementById('emergency-modal');
    const alertG = document.getElementById('alert-gforce-val');
    const alertLoc = document.getElementById('alert-location-val');
    const alertBpm = document.getElementById('alert-bpm-val');
    
    if (alertG) alertG.innerText = `${peakG.toFixed(2)}g`;
    if (alertLoc) alertLoc.innerText = room;
    if (alertBpm) alertBpm.innerText = `${state.bpm} BPM`;

    if (modal) modal.classList.add('modal-active');

    // Start 15-second Countdown
    state.countdownValue = state.countdownMax;
    updateCountdownUI();
    
    if (state.countdownTimerId) clearInterval(state.countdownTimerId);
    state.countdownTimerId = setInterval(() => {
        state.countdownValue--;
        updateCountdownUI();
        
        if (state.countdownValue <= 0) {
            clearInterval(state.countdownTimerId);
            confirmEmergencyDispatchNow();
        }
    }, 1000);
}

function updateCountdownUI() {
    const numEl = document.getElementById('countdown-number-text');
    const barEl = document.getElementById('countdown-progress-bar');
    
    if (numEl) numEl.innerText = state.countdownValue;
    if (barEl) {
        const strokeDashOffset = 264 * (1 - state.countdownValue / state.countdownMax);
        barEl.style.strokeDashoffset = strokeDashOffset;
    }
}

function cancelEmergencyAlert() {
    stopSirenAudio();
    if (state.countdownTimerId) clearInterval(state.countdownTimerId);
    state.emergencyActive = false;
    
    const modal = document.getElementById('emergency-modal');
    if (modal) modal.classList.remove('modal-active');
    
    // Add to history log
    addLogEntry({
        time: new Date().toLocaleTimeString('id-ID'),
        event: 'Simulasi Terpleset / Jatuh',
        gforce: `${state.gForce.toFixed(2)}g`,
        posture: `Horizontal (${state.tiltAngle}°)`,
        location: state.currentRoom,
        status: 'Batal oleh Pasien (False Alarm)'
    });
    
    triggerMotionScenario('RECOVER');
    showToast('Sinyal darurat berhasil dibatalkan oleh pengguna.');
}

function confirmEmergencyDispatchNow() {
    stopSirenAudio();
    if (state.countdownTimerId) clearInterval(state.countdownTimerId);
    
    const modal = document.getElementById('emergency-modal');
    if (modal) modal.classList.remove('modal-active');

    // Add to history log as confirmed emergency
    addLogEntry({
        time: new Date().toLocaleTimeString('id-ID'),
        event: 'JATUH TERKONFIRMASI (SOS DISPATCHED)',
        gforce: `${state.gForce.toFixed(2)}g`,
        posture: `Horizontal (${state.tiltAngle}°)`,
        location: state.currentRoom,
        status: 'TERKIRIM KE AMBULANS & WA'
    });

    alert('🚨 DISPATCH DARURAT TERKIRIM!\n\nPesan SOS, lokasi GPS, dan data vital telah dikirimkan ke Ambulans 119 dan Keluarga (Budi Santoso).');
}

function updateGlobalStatus(type, text) {
    const pill = document.getElementById('global-status-pill');
    const txt = document.getElementById('global-status-text');
    
    if (txt) txt.innerText = text;
    if (pill) {
        if (type === 'EMERGENCY') {
            pill.className = 'status-pill status-danger';
        } else {
            pill.className = 'status-pill status-safe';
        }
    }
}

// --- Indoor Map Position Manager ---
function updateIndoorMapPosition(roomName) {
    const marker = document.getElementById('patient-map-marker');
    const badge = document.getElementById('location-badge');
    const rooms = document.querySelectorAll('.room');
    
    rooms.forEach(r => r.classList.remove('active-room'));
    if (badge) badge.innerText = `Area: ${roomName}`;
    
    if (!marker) return;
    
    if (roomName.includes('Kamar Mandi')) {
        marker.style.top = '25%'; marker.style.left = '75%';
        const rm = document.querySelector('.room-bathroom');
        if (rm) rm.classList.add('active-room');
    } else if (roomName.includes('Kamar Tidur')) {
        marker.style.top = '30%'; marker.style.left = '25%';
        const rm = document.querySelector('.room-bedroom');
        if (rm) rm.classList.add('active-room');
    } else if (roomName.includes('Ruang Tamu')) {
        marker.style.top = '65%'; marker.style.left = '75%';
        const rm = document.querySelector('.room-living');
        if (rm) rm.classList.add('active-room');
    }
}

// --- Sensor HTML5 Canvas Chart ---
function initSensorChart() {
    const canvas = document.getElementById('sensorChart');
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth || 600;
    canvas.height = 280;
}

function renderSensorChart() {
    const canvas = document.getElementById('sensorChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    // Draw Gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
    
    // Draw Threshold Lines (Impact at 2.8g)
    const impactY = h - (2.8 / 4.0) * h;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, impactY);
    ctx.lineTo(w, impactY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Threshold Label
    ctx.fillStyle = '#ef4444';
    ctx.font = '10px JetBrains Mono';
    ctx.fillText('Impact Threshold (2.8g)', 10, impactY - 5);

    // Helper to draw signal line
    const drawLine = (dataArr, color, width = 1.5) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        
        const step = w / (dataArr.length - 1);
        for (let i = 0; i < dataArr.length; i++) {
            const val = dataArr[i];
            const yPos = h - (Math.min(4.0, Math.max(0, val)) / 4.0) * h;
            const xPos = i * step;
            
            if (i === 0) ctx.moveTo(xPos, yPos);
            else ctx.lineTo(xPos, yPos);
        }
        ctx.stroke();
    };

    drawLine(state.chartData.x, '#3b82f6', 1.5);
    drawLine(state.chartData.y, '#10b981', 1.5);
    drawLine(state.chartData.z, '#f59e0b', 1.5);
    drawLine(state.chartData.total, '#ef4444', 2.5); // Total G-force emphasized
}

// --- Web Audio API Siren Generator ---
function initAudioEngine() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioCtx();
    } catch (e) {
        console.warn('Web Audio API not supported on this browser.');
    }
}

function startSirenAudio() {
    if (!state.audioContext) return;
    if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
    }
    
    state.sirenOscillator = state.audioContext.createOscillator();
    state.sirenGain = state.audioContext.createGain();
    
    state.sirenOscillator.type = 'sawtooth';
    state.sirenOscillator.frequency.setValueAtTime(600, state.audioContext.currentTime);
    
    // Frequency modulation for siren effect
    let high = false;
    const interval = setInterval(() => {
        if (!state.sirenOscillator) {
            clearInterval(interval);
            return;
        }
        high = !high;
        state.sirenOscillator.frequency.setValueAtTime(high ? 950 : 550, state.audioContext.currentTime);
    }, 400);

    state.sirenGain.gain.setValueAtTime(0.15, state.audioContext.currentTime);
    state.sirenOscillator.connect(state.sirenGain);
    state.sirenGain.connect(state.audioContext.destination);
    
    state.sirenOscillator.start();
}

function stopSirenAudio() {
    if (state.sirenOscillator) {
        try {
            state.sirenOscillator.stop();
            state.sirenOscillator.disconnect();
        } catch(e){}
        state.sirenOscillator = null;
    }
}

// --- Logs & Storage ---
function addLogEntry(entry) {
    state.logs.unshift(entry);
    renderLogs();
}

function renderLogs() {
    const tbody = document.getElementById('logs-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    state.logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${log.time}</td>
            <td><strong>${log.event}</strong></td>
            <td><code>${log.gforce}</code></td>
            <td>${log.posture}</td>
            <td>${log.location}</td>
            <td><span class="badge ${log.status.includes('Batal') ? 'badge-outline' : 'badge-danger'}">${log.status}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function clearLogs() {
    state.logs = [];
    renderLogs();
}

function saveSettings(e) {
    e.preventDefault();
    const nameInput = document.getElementById('setting-patient-name');
    const thresholdInput = document.getElementById('setting-impact-threshold');
    const countdownInput = document.getElementById('setting-countdown-duration');
    const soundInput = document.getElementById('setting-sound-enabled');
    
    if (nameInput && nameInput.value.trim() !== '') {
        state.patientName = nameInput.value.trim();
    }
    
    if (thresholdInput) state.thresholdImpact = parseFloat(thresholdInput.value);
    if (countdownInput) state.countdownMax = parseInt(countdownInput.value);
    if (soundInput) state.soundEnabled = soundInput.value === 'true';
    
    updatePatientNameUI();
    showToast('Konfigurasi dan Data Pasien berhasil disimpan!');
}

// Helper Utilities
function copyDispatchText() {
    const txt = document.getElementById('dispatch-text');
    if (txt) {
        txt.select();
        document.execCommand('copy');
        showToast('Payload notifikasi disalin ke clipboard!');
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = '#1e293b';
    toast.style.color = '#fff';
    toast.style.border = '1px solid #3b82f6';
    toast.style.padding = '10px 18px';
    toast.style.borderRadius = '10px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';
    toast.style.fontSize = '0.85rem';
    toast.innerText = msg;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

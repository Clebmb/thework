// js/main.js
document.addEventListener('DOMContentLoaded', () => {
    console.log("Chaos Engine Web Mockup Initializing...");

    // --- Get DOM Elements ---
    const canvas = document.getElementById('fractal-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const quantumSeedStatus = document.getElementById('quantum-seed-status');
    const oracleValueDisplay = document.getElementById('oracle-value');
    const oracleHelpBtn = document.getElementById('oracle-help-btn');

    const intentInput = document.getElementById('intent-input');
    const generateBtn = document.getElementById('generate-btn');
    const fractalTypeSelect = document.getElementById('fractal-type-select');
    const juliaParamsWidget = document.getElementById('julia-params-widget');
    const juliaRealInput = document.getElementById('julia-real');
    const juliaImagInput = document.getElementById('julia-imag');
    const maxIterInput = document.getElementById('max-iter-input');
    const applyIterBtn = document.getElementById('apply-iter-btn');

    const importSigilInput = document.getElementById('import-sigil-input');
    const importSigilBtn = document.getElementById('import-sigil-btn');
    const removeSigilBtn = document.getElementById('remove-sigil-btn');
    const sigilScaleInput = document.getElementById('sigil-scale-input');
    const applySigilScaleBtn = document.getElementById('apply-sigil-scale-btn');

    const musicTrackSelect = document.getElementById('music-track-select');
    const uploadMusicInput = document.getElementById('upload-music-input');
    const uploadMusicBtn = document.getElementById('upload-music-btn');
    const playPauseMusicBtn = document.getElementById('play-pause-music-btn');
    const musicVolumeSlider = document.getElementById('music-volume-slider');

    const toneFreqInput = document.getElementById('tone-freq-input');
    const playToneBtn = document.getElementById('play-tone-btn');
    const stopToneBtn = document.getElementById('stop-tone-btn');
    const toneVolumeSlider = document.getElementById('tone-volume-slider');

    const effectCheckboxes = {
        strobe: document.getElementById('effect-strobe'),
        psychedelic: document.getElementById('effect-psychedelic'),
        warpBands: document.getElementById('effect-warp-bands'),
        scanLines: document.getElementById('effect-scan-lines'),
        rgbShift: document.getElementById('effect-rgb-shift'),
        neonEdges: document.getElementById('effect-neon-edges'),
        emboss: document.getElementById('effect-emboss'),
        colorCrush: document.getElementById('effect-color-crush'),
        pixelGlitch: document.getElementById('effect-pixel-glitch'),
        juliaMorph: document.getElementById('effect-julia-morph')
    };

    const animateCheckbox = document.getElementById('animate-checkbox');
    const saveFractalBtn = document.getElementById('save-fractal-btn');

    let baseQuantumSeed = 0;
    let oracleInterval;
    let quantumFetchInterval;
    let currentFractalType = 'Mandelbrot';
    let sigilImage = null;
    let sigilScale = 1.0;
    let sigilPosition = { x: 0, y: 0 };
    let sigilFlashInterval;

    let audioContext;
    let musicSourceNode;
    let toneOscillatorNode;
    let musicGainNode;
    let toneGainNode;
    let isMusicPlaying = false;
    let isMusicPaused = false;
    let isTonePlaying = false;

    let animationFrameId;
    let lastTimestamp = 0;
    let timePhase = 0; // Normalized 0-1 for animation cycle
    const ANIMATION_DURATION_SEC = 15.0; // How long one animation cycle takes

    // Strobe effect state
    let strobeTimer = null;
    const STROBE_INTERVAL_MS = 100;
    let paletteIdCounter = 0; // Used for cycling palettes in strobe or animation

    let viewParams = {
        reCenter: -0.75,
        imCenter: 0.0,
        reSpan: 3.5,
    };
    let currentMaxIter = parseInt(maxIterInput.value);
    let isRendering = false;

    // Buffer for iteration data to avoid re-calculating when only colors change
    let storedIterationData = null;
    let lastRenderedViewKey = ""; // To check if iteration data needs recalculation


    function resizeCanvas() {
        const displayWidth = canvas.clientWidth;
        const displayHeight = Math.floor(displayWidth * (3 / 4)); // Maintain 4:3 aspect ratio

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
            console.log(`Canvas resized to: ${canvas.width}x${canvas.height}`);
            storedIterationData = null; // Invalidate stored data on resize
            if (!isRendering) regenerateFractalView(true, false); // force recalc, don't reset anim time
        }
    }
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 250);
    });

    async function fetchQuantumSeed() {
        quantumSeedStatus.textContent = "Quantum Seed: [Fetching...]";
        try {
            const response = await fetch("https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint16");
            if (!response.ok) throw new Error(`ANU API Error: ${response.status}`);
            const data = await response.json();
            if (data.success) {
                baseQuantumSeed = data.data[0];
                quantumSeedStatus.textContent = `Quantum Seed: ${baseQuantumSeed}`;
            } else {
                throw new Error("ANU API reported failure.");
            }
        } catch (error) {
            console.warn("Quantum fetch error:", error.message);
            baseQuantumSeed = Math.floor(Math.random() * 65536);
            quantumSeedStatus.textContent = `Quantum Seed: [Error - Fallback: ${baseQuantumSeed}]`;
        }
    }

    async function updateOracleDisplay() {
        const currentMilli = Date.now();
        const inputString = `${baseQuantumSeed}-${currentMilli}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(inputString);
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            const displayNum = parseInt(hashHex.substring(0, 8), 16);
            oracleValueDisplay.textContent = `Oracle: ${displayNum}`;
        } catch (error) {
            console.warn("SubtleCrypto SHA-256 error (e.g. non-secure context):", error.message);
            let simpleHash = 0;
            for (let i = 0; i < inputString.length; i++) {
                const char = inputString.charCodeAt(i);
                simpleHash = ((simpleHash << 5) - simpleHash) + char;
                simpleHash |= 0;
            }
            oracleValueDisplay.textContent = `Oracle: ${Math.abs(simpleHash) % 100000000} (FB)`;
        }
    }

    oracleHelpBtn.addEventListener('click', () => {
        alert(
            "Dual Oracle Info:\n\n" +
            "1. Quantum Seed: Fetched from ANU Quantum Server (or fallback pseudo-random if network error). Updates periodically.\n\n" +
            "2. Oracle: Rapidly fluctuating number derived from Quantum Seed + current time, hashed. Updates every second.\n\n" +
            "Use for meditation, sigil charging, divination, ritual seeding."
        );
    });

    function drawFractal(forceRecalculateIterations = false) {
        if (!ctx || canvas.width === 0 || canvas.height === 0 || isRendering) {
            if (isRendering) console.log("Draw request skipped: already rendering.");
            return;
        }
        isRendering = true;
        generateBtn.disabled = true;

        const startTime = performance.now();
        const w = canvas.width;
        const h = canvas.height;
        currentMaxIter = parseInt(maxIterInput.value);

        const aspectRatio = w / h;
        const imSpan = viewParams.reSpan / aspectRatio;
        const reStart = viewParams.reCenter - viewParams.reSpan / 2;
        const reEnd = viewParams.reCenter + viewParams.reSpan / 2;
        const imStart = viewParams.imCenter - imSpan / 2;
        const imEnd = viewParams.imCenter + imSpan / 2;

        const currentViewKey = `${reStart.toFixed(10)}_${reEnd.toFixed(10)}_${imStart.toFixed(10)}_${imEnd.toFixed(10)}_${w}_${h}_${currentMaxIter}_${currentFractalType}`;
        let needsRecalculation = forceRecalculateIterations || !storedIterationData || lastRenderedViewKey !== currentViewKey;


        setTimeout(() => {
            if (needsRecalculation) {
                console.log("Recalculating iterations...");
                storedIterationData = new Uint16Array(w * h);
                if (currentFractalType === 'Mandelbrot') {
                    calculateMandelbrotIterations(storedIterationData, reStart, reEnd, imStart, imEnd, w, h, currentMaxIter);
                } else if (currentFractalType === 'Julia') {
                    const cR = parseFloat(juliaRealInput.value);
                    const cI = parseFloat(juliaImagInput.value);
                    // Placeholder until calculateJuliaIterations is in fractal.js
                    calculateJuliaIterations(storedIterationData, reStart, reEnd, imStart, imEnd, w, h, currentMaxIter, cR, cI); // Assuming this will be added
                    // If calculateJuliaIterations is not ready, use the placeholder draw:
                    if (typeof calculateJuliaIterations !== 'function' || storedIterationData.every(val => val === 0) ) { // Crude check if it's implemented
                        ctx.fillStyle = 'black'; ctx.fillRect(0,0,w,h);
                        ctx.fillStyle = '#00ff00'; ctx.font = '16px Courier New'; ctx.textAlign = 'center';
                        ctx.fillText(`Julia Set calculation pending. C=(${cR}, ${cI})`, w / 2, h / 2);
                        lastRenderedViewKey = currentViewKey;
                        const endTime = performance.now();
                        console.log(`Julia placeholder drawn in ${(endTime - startTime).toFixed(2)} ms.`);
                        isRendering = false; generateBtn.disabled = false; return;
                    }
                } else if (currentFractalType === 'BurningShip') {
                     // Placeholder until calculateBurningShipIterations is in fractal.js
                    calculateBurningShipIterations(storedIterationData, reStart, reEnd, imStart, imEnd, w, h, currentMaxIter); // Assuming this will be added
                    if (typeof calculateBurningShipIterations !== 'function' || storedIterationData.every(val => val === 0)) { // Crude check
                        ctx.fillStyle = 'black'; ctx.fillRect(0,0,w,h);
                        ctx.fillStyle = '#00ff00'; ctx.font = '16px Courier New'; ctx.textAlign = 'center';
                        ctx.fillText(`Burning Ship calculation pending.`, w / 2, h / 2);
                        lastRenderedViewKey = currentViewKey;
                        const endTime = performance.now();
                        console.log(`Burning Ship placeholder drawn in ${(endTime - startTime).toFixed(2)} ms.`);
                        isRendering = false; generateBtn.disabled = false; return;
                    }
                }
                lastRenderedViewKey = currentViewKey;
            } else {
                console.log("Using stored iteration data for re-coloring.");
            }

            if (!storedIterationData) {
                console.error("Stored iteration data is null after check!");
                isRendering = false; generateBtn.disabled = false; return;
            }

            const usePsychedelic = effectCheckboxes.psychedelic.checked;
            const imageDataObj = colorIterationsToImageData(storedIterationData, w, h, currentMaxIter, paletteIdCounter, timePhase, usePsychedelic);
            
            applyVisualEffects(imageDataObj.data, w, h); // Placeholder
            ctx.putImageData(imageDataObj, 0, 0);

            if (sigilImage) {
                try {
                    const scaledWidth = sigilImage.naturalWidth * sigilScale;
                    const scaledHeight = sigilImage.naturalHeight * sigilScale;
                    ctx.drawImage(sigilImage, sigilPosition.x, sigilPosition.y, scaledWidth, scaledHeight);
                } catch (e) { console.error("Error drawing sigil:", e); }
            }

            const endTime = performance.now();
            // console.log(`Fractal drawn in ${(endTime - startTime).toFixed(2)} ms. Palette ID: ${paletteIdCounter % 4}, Psychedelic: ${usePsychedelic}`);
            isRendering = false;
            generateBtn.disabled = false;
        }, 0);
    }

    function applyVisualEffects(pixelData, width, height) {
        // Placeholder for future visual effects on pixelData
    }

    function regenerateFractalView(forceRecalculateIterations = false, resetAnimation = true) {
        if (isRendering && !forceRecalculateIterations) { // Don't queue if only colors change & rendering
            console.log("Regenerate request skipped: already rendering and not forcing recalc.");
            return;
        }

        if (resetAnimation) {
            timePhase = 0;
            lastTimestamp = 0;
        }

        manageStrobeTimer();

        if (animateCheckbox.checked) {
            if (!animationFrameId) {
                lastTimestamp = 0;
                animationFrameId = requestAnimationFrame(animationLoop);
            }
        } else {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            drawFractal(forceRecalculateIterations);
        }
    }


    function animationLoop(timestamp) {
        if (!animateCheckbox.checked || isRendering) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            lastTimestamp = 0;
            return;
        }

        if (lastTimestamp === 0) lastTimestamp = timestamp;
        const deltaTime = (timestamp - lastTimestamp) / 1000;
        lastTimestamp = timestamp;

        timePhase = (timePhase + deltaTime / ANIMATION_DURATION_SEC) % 1.0;
        const sinTime = Math.sin(timePhase * 2 * Math.PI);

        if (effectCheckboxes.strobe.checked && !effectCheckboxes.psychedelic.checked) {
            const newPaletteFrame = Math.floor(timePhase * 10); 
            if (newPaletteFrame !== Math.floor(((timePhase - deltaTime / ANIMATION_DURATION_SEC + 1.0) % 1.0) * 10)) { // Ensure positive modulo for previous timephase
                 paletteIdCounter++;
            }
        }

        let forceRecalc = false;
        if (!isDragging) { // Only animate zoom if not actively panning/zooming via mouse
            const zoomMagnitude = 0.05; // Max zoom factor change per second
            const zoomChange = zoomMagnitude * sinTime * deltaTime;
            if (Math.abs(zoomChange) > 0.00001) {
                const zoomFactor = 1.0 - zoomChange;
                viewParams.reSpan *= zoomFactor;
                forceRecalc = true;
            }
        }
        // TODO: Add other animation logic (pan, Julia morph, etc.) which might set forceRecalc = true

        drawFractal(forceRecalc);
        if (animateCheckbox.checked) {
            animationFrameId = requestAnimationFrame(animationLoop);
        } else {
            animationFrameId = null;
        }
    }
    
    function manageStrobeTimer() {
        if (strobeTimer) {
            clearInterval(strobeTimer);
            strobeTimer = null;
        }
        if (effectCheckboxes.strobe.checked && !effectCheckboxes.psychedelic.checked && !animateCheckbox.checked) {
            strobeTimer = setInterval(() => {
                if (!isRendering) {
                    paletteIdCounter++;
                    drawFractal(false); // Only re-color
                }
            }, STROBE_INTERVAL_MS);
            // console.log("Strobe timer started.");
        } else {
            // console.log("Strobe timer stopped or not started.");
        }
    }


    animateCheckbox.addEventListener('change', () => {
        if (animateCheckbox.checked) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            lastTimestamp = 0;
            animationFrameId = requestAnimationFrame(animationLoop);
        } else {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
            if (!isRendering) regenerateFractalView(false, false);
        }
        manageStrobeTimer();
    });

    importSigilBtn.addEventListener('click', () => importSigilInput.click());
    importSigilInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (sigilImage && sigilImage.src.startsWith('blob:')) URL.revokeObjectURL(sigilImage.src);
                sigilImage = new Image();
                sigilImage.onload = () => {
                    removeSigilBtn.disabled = false;
                    sigilScaleInput.disabled = false;
                    applySigilScaleBtn.disabled = false;
                    const scaledWidth = sigilImage.naturalWidth * sigilScale;
                    const scaledHeight = sigilImage.naturalHeight * sigilScale;
                    sigilPosition.x = Math.random() * Math.max(0, canvas.width - scaledWidth);
                    sigilPosition.y = Math.random() * Math.max(0, canvas.height - scaledHeight);
                    startSigilFlash();
                    if (!animateCheckbox.checked && !isRendering) regenerateFractalView(false, false);
                };
                sigilImage.onerror = () => { alert("Error loading sigil image."); sigilImage = null; };
                sigilImage.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    removeSigilBtn.addEventListener('click', () => {
        if (sigilImage && sigilImage.src.startsWith('blob:')) URL.revokeObjectURL(sigilImage.src);
        sigilImage = null;
        removeSigilBtn.disabled = true;
        sigilScaleInput.disabled = true;
        applySigilScaleBtn.disabled = true;
        sigilScaleInput.value = 100;
        sigilScale = 1.0;
        stopSigilFlash();
        if (!animateCheckbox.checked && !isRendering) regenerateFractalView(false, false);
    });

    applySigilScaleBtn.addEventListener('click', () => {
        const scalePercent = parseInt(sigilScaleInput.value);
        if (!isNaN(scalePercent) && scalePercent >= 10 && scalePercent <= 500) {
            sigilScale = scalePercent / 100.0;
            if (sigilImage) updateSigilFlashPosition();
            else if (!animateCheckbox.checked && !isRendering) regenerateFractalView(false, false);
        } else {
            alert("Invalid sigil scale. Must be between 10 and 500.");
            sigilScaleInput.value = Math.round(sigilScale * 100);
        }
    });

    function updateSigilFlashPosition() {
        if (sigilImage && canvas.width > 0 && canvas.height > 0) {
            const scaledWidth = sigilImage.naturalWidth * sigilScale;
            const scaledHeight = sigilImage.naturalHeight * sigilScale;
            if (canvas.width > scaledWidth && canvas.height > scaledHeight) {
                sigilPosition.x = Math.random() * (canvas.width - scaledWidth);
                sigilPosition.y = Math.random() * (canvas.height - scaledHeight);
            } else {
                sigilPosition.x = (canvas.width - scaledWidth) / 2;
                sigilPosition.y = (canvas.height - scaledHeight) / 2;
            }
            if (!animateCheckbox.checked && !isRendering) regenerateFractalView(false, false);
        }
    }

    function startSigilFlash() {
        stopSigilFlash();
        sigilFlashInterval = setInterval(updateSigilFlashPosition, 200);
    }
    function stopSigilFlash() {
        if (sigilFlashInterval) clearInterval(sigilFlashInterval);
        sigilFlashInterval = null;
    }

    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return; 
        isDragging = true;
        lastMousePos = { x: e.offsetX, y: e.offsetY };
        canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.offsetX - lastMousePos.x;
            const dy = e.offsetY - lastMousePos.y;
            const rePerPixel = viewParams.reSpan / canvas.width;
            const imPerPixel = (viewParams.reSpan / (canvas.width / canvas.height)) / canvas.height;
            viewParams.reCenter -= dx * rePerPixel;
            viewParams.imCenter -= dy * imPerPixel;
            lastMousePos = { x: e.offsetX, y: e.offsetY };
            if (!isRendering) regenerateFractalView(true, false);
        }
    });
    document.addEventListener('mouseup', (e) => { 
        if (isDragging) {
            isDragging = false;
            canvas.style.cursor = 'grab';
        }
    });
    canvas.addEventListener('mouseenter', () => {
        canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
    });
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 0.85 : 1.15;
        const mouseRe = viewParams.reCenter - (viewParams.reSpan / 2) + (e.offsetX / canvas.width) * viewParams.reSpan;
        const imSpan = viewParams.reSpan / (canvas.width / canvas.height);
        const mouseIm = viewParams.imCenter - (imSpan / 2) + (e.offsetY / canvas.height) * imSpan;
        viewParams.reCenter = mouseRe + (viewParams.reCenter - mouseRe) / zoomFactor;
        viewParams.imCenter = mouseIm + (viewParams.imCenter - mouseIm) / zoomFactor;
        viewParams.reSpan /= zoomFactor;
        if (!isRendering) regenerateFractalView(true, false);
    });

    generateBtn.addEventListener('click', () => {
        if (currentFractalType === 'Mandelbrot') viewParams = { reCenter: -0.75, imCenter: 0.0, reSpan: 3.5 };
        else if (currentFractalType === 'Julia') viewParams = { reCenter: 0.0, imCenter: 0.0, reSpan: 3.0 };
        else if (currentFractalType === 'BurningShip') viewParams = { reCenter: -0.5, imCenter: -0.5, reSpan: 3.5 };
        currentMaxIter = parseInt(maxIterInput.value);
        storedIterationData = null;
        if (!isRendering) regenerateFractalView(true, true);
    });

    applyIterBtn.addEventListener('click', () => {
        currentMaxIter = parseInt(maxIterInput.value);
        storedIterationData = null;
        if (!isRendering) regenerateFractalView(true, false);
    });

    fractalTypeSelect.addEventListener('change', (event) => {
        currentFractalType = event.target.value;
        juliaParamsWidget.style.display = (currentFractalType === 'Julia') ? 'block' : 'none';
        effectCheckboxes.juliaMorph.disabled = (currentFractalType !== 'Julia');
        if (currentFractalType !== 'Julia' && effectCheckboxes.juliaMorph.checked) {
            effectCheckboxes.juliaMorph.checked = false;
        }
        if (currentFractalType === 'Mandelbrot') viewParams = { reCenter: -0.75, imCenter: 0.0, reSpan: 3.5 };
        else if (currentFractalType === 'Julia') viewParams = { reCenter: 0.0, imCenter: 0.0, reSpan: 3.0 };
        else if (currentFractalType === 'BurningShip') viewParams = { reCenter: -0.5, imCenter: -0.5, reSpan: 3.5 };
        storedIterationData = null;
        if (!isRendering) regenerateFractalView(true, true);
    });

    saveFractalBtn.addEventListener('click', () => {
        const wasAnimating = animateCheckbox.checked;
        let animationWasActuallyRunning = !!animationFrameId; // Check if RAF was active
        if (animationWasActuallyRunning) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null; // Important to mark it as stopped
        }
        
        const doSave = () => {
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${fractalTypeSelect.value}_fractal.png`;
            link.href = dataURL;
            document.body.appendChild(link); 
            link.click();
            document.body.removeChild(link);
            if (wasAnimating && !animationFrameId) { // If it was supposed to be animating and isn't
                 lastTimestamp = 0;
                 animationFrameId = requestAnimationFrame(animationLoop);
            }
        };

        if (isRendering) { 
            const checkRenderInterval = setInterval(() => {
                if (!isRendering) {
                    clearInterval(checkRenderInterval);
                    doSave();
                }
            }, 50);
        } else {
            // If not currently rendering, but we want to ensure the latest state is on canvas
            // (especially if it WAS animating and we just stopped it)
            // A direct call to drawFractal might be needed if animation loop didn't complete its last draw
            // However, the current canvas state should be what was last drawn.
             doSave(); 
        }
    });

    Object.values(effectCheckboxes).forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // console.log(`${checkbox.id} changed to ${checkbox.checked}`);
            if (checkbox.id === 'effect-psychedelic' && checkbox.checked) {
                effectCheckboxes.strobe.checked = false; // Psychedelic overrides strobe palette logic
            }
            if (checkbox.id === 'effect-strobe' || checkbox.id === 'effect-psychedelic') {
                manageStrobeTimer(); // Strobe and psychedelic affect strobe timer
            }
            if (!animateCheckbox.checked && !isRendering) {
                regenerateFractalView(false, false); // Only re-color
            }
        });
    });

    function initAudio() {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            musicGainNode = audioContext.createGain();
            musicGainNode.gain.value = musicVolumeSlider.value / 100;
            musicGainNode.connect(audioContext.destination);
            toneGainNode = audioContext.createGain();
            toneGainNode.gain.value = toneVolumeSlider.value / 100;
            toneGainNode.connect(audioContext.destination);
        } catch (e) {
            console.error("Web Audio API not supported.", e);
            alert("Web Audio API is not supported. Audio features disabled.");
            [playPauseMusicBtn, uploadMusicBtn, playToneBtn, stopToneBtn, musicVolumeSlider, toneVolumeSlider].forEach(el => el.disabled = true);
        }
    }
    musicVolumeSlider.addEventListener('input', (e) => { if (musicGainNode) musicGainNode.gain.value = e.target.value / 100; });
    toneVolumeSlider.addEventListener('input', (e) => { if (toneGainNode) toneGainNode.gain.value = e.target.value / 100; });
    uploadMusicBtn.addEventListener('click', () => uploadMusicInput.click());
    window.uploadedAudioBuffers = {};
    uploadMusicInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && audioContext) {
            const reader = new FileReader();
            reader.onload = (e) => {
                audioContext.decodeAudioData(e.target.result)
                    .then(buffer => {
                        const trackName = `uploaded_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
                        window.uploadedAudioBuffers[trackName] = buffer;
                        const existingUploaded = musicTrackSelect.querySelector(`option[value^="uploaded_"]`);
                        if (existingUploaded) existingUploaded.remove();
                        const newOption = document.createElement('option');
                        newOption.value = trackName;
                        newOption.textContent = `Uploaded: ${file.name}`;
                        musicTrackSelect.appendChild(newOption);
                        musicTrackSelect.value = trackName;
                    })
                    .catch(err => { console.error("Error decoding audio file:", err); alert(`Error decoding audio: ${file.name}. Ensure it's a valid audio format.`); });
            };
            reader.readAsArrayBuffer(file);
        }
    });
    playPauseMusicBtn.addEventListener('click', async () => {
        if (!audioContext) return;
        if (audioContext.state === 'suspended') await audioContext.resume().catch(e => console.error("Error resuming AudioContext:", e));
        if (isMusicPlaying && !isMusicPaused) {
            if (musicSourceNode) musicSourceNode.disconnect();
            isMusicPaused = true; playPauseMusicBtn.textContent = "Resume";
        } else {
            const selectedTrackValue = musicTrackSelect.value;
            let audioBufferToPlay = window.uploadedAudioBuffers[selectedTrackValue];
            if (!selectedTrackValue.startsWith("uploaded_") && !audioBufferToPlay) {
                try {
                    const response = await fetch(selectedTrackValue); 
                    if (!response.ok) throw new Error(`Failed to fetch ${selectedTrackValue}`);
                    const arrayBuffer = await response.arrayBuffer();
                    audioBufferToPlay = await audioContext.decodeAudioData(arrayBuffer);
                    window.uploadedAudioBuffers[selectedTrackValue] = audioBufferToPlay;
                } catch (err) { console.error("Error fetching/decoding predefined track:", err); alert(`Could not load predefined track: ${selectedTrackValue}`); return; }
            }
            if (!audioBufferToPlay) { alert("Selected audio track not loaded or found."); return; }
            if (isMusicPaused && musicSourceNode) { musicSourceNode.connect(musicGainNode); } 
            else {
                if (musicSourceNode) { try { musicSourceNode.stop(); } catch(e){} musicSourceNode.disconnect(); }
                musicSourceNode = audioContext.createBufferSource();
                musicSourceNode.buffer = audioBufferToPlay;
                musicSourceNode.connect(musicGainNode);
                musicSourceNode.onended = () => { isMusicPlaying = false; isMusicPaused = false; playPauseMusicBtn.textContent = "Play"; musicSourceNode = null; };
                musicSourceNode.start(0);
            }
            isMusicPlaying = true; isMusicPaused = false; playPauseMusicBtn.textContent = "Pause";
        }
    });
    playToneBtn.addEventListener('click', async () => {
        if (!audioContext || isTonePlaying) return;
        if (audioContext.state === 'suspended') await audioContext.resume();
        const freq = parseFloat(toneFreqInput.value);
        if (isNaN(freq) || freq <= 0) { alert("Invalid tone frequency."); return; }
        if (toneOscillatorNode) { try { toneOscillatorNode.stop(); toneOscillatorNode.disconnect(); } catch(e){} }
        toneOscillatorNode = audioContext.createOscillator();
        toneOscillatorNode.type = 'sine';
        toneOscillatorNode.frequency.setValueAtTime(freq, audioContext.currentTime);
        toneOscillatorNode.connect(toneGainNode);
        toneOscillatorNode.start();
        isTonePlaying = true; playToneBtn.disabled = true; stopToneBtn.disabled = false;
    });
    stopToneBtn.addEventListener('click', () => {
        if (toneOscillatorNode && isTonePlaying) {
            try { toneOscillatorNode.stop(); toneOscillatorNode.disconnect(); } catch(e){}
            toneOscillatorNode = null;
        }
        isTonePlaying = false; playToneBtn.disabled = false; stopToneBtn.disabled = true;
    });


    function initializeApp() {
        resizeCanvas();
        currentFractalType = fractalTypeSelect.value;
        fetchQuantumSeed();
        quantumFetchInterval = setInterval(fetchQuantumSeed, 30000);
        updateOracleDisplay();
        oracleInterval = setInterval(updateOracleDisplay, 1000);
        initAudio();
        juliaParamsWidget.style.display = (currentFractalType === 'Julia') ? 'block' : 'none';
        effectCheckboxes.juliaMorph.disabled = (currentFractalType !== 'Julia');
        canvas.style.cursor = 'grab';
        
        manageStrobeTimer();
        regenerateFractalView(true, true);
    }

    initializeApp();
});
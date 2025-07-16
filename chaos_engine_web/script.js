document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('fractalCanvas');
    const ctx = canvas.getContext('2d');
    const intentInput = document.getElementById('intentInput');
    const generateButton = document.getElementById('generateButton');
    const maxIterInput = document.getElementById('maxIterInput');
    const oracleValueSpan = document.getElementById('oracleValue');
    const seedValueSpan = document.getElementById('seedValue');

    let currentSeed = Math.floor(Math.random() * 65536); // Fallback seed
    let oracleInterval;

    // --- Configuration ---
    let view = {
        xMin: -2.0,
        xMax: 1.0,
        yMin: -1.2,
        yMax: 1.2,
        maxIter: parseInt(maxIterInput.value) || 50
    };

    function setupCanvas() {
        // Get the actual display size from CSS
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        
        // Set the canvas internal resolution
        canvas.width = displayWidth;
        canvas.height = displayHeight;

        // Adjust view.yMax based on aspect ratio to avoid stretching
        const aspectRatio = canvas.width / canvas.height;
        const xRange = view.xMax - view.xMin;
        const yRange = xRange / aspectRatio;
        view.yMin = -yRange / 2; // Assuming centered around y=0 for default Mandelbrot
        view.yMax = yRange / 2;
    }


    function drawMandelbrot() {
        setupCanvas(); // Ensure canvas size and view are updated
        const width = canvas.width;
        const height = canvas.height;
        const maxIter = view.maxIter;
        const imageData = ctx.createImageData(width, height);

        for (let px = 0; px < width; px++) {
            for (let py = 0; py < height; py++) {
                const x0 = view.xMin + (px / width) * (view.xMax - view.xMin);
                const y0 = view.yMin + (py / height) * (view.yMax - view.yMin);

                let x = 0.0;
                let y = 0.0;
                let iteration = 0;

                while (x * x + y * y <= 4 && iteration < maxIter) {
                    const xtemp = x * x - y * y + x0;
                    y = 2 * x * y + y0;
                    x = xtemp;
                    iteration++;
                }

                const pixelIndex = (py * width + px) * 4;
                if (iteration === maxIter) {
                    imageData.data[pixelIndex + 0] = 0;   // R
                    imageData.data[pixelIndex + 1] = 0;   // G
                    imageData.data[pixelIndex + 2] = 0;   // B
                    imageData.data[pixelIndex + 3] = 255; // A
                } else {
                    // Simple color scheme
                    imageData.data[pixelIndex + 0] = (iteration * 5) % 255;  // R
                    imageData.data[pixelIndex + 1] = (iteration * 3 + 50) % 255; // G
                    imageData.data[pixelIndex + 2] = (iteration * 2 + 100) % 255; // B
                    imageData.data[pixelIndex + 3] = 255; // A
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);
        console.log("Mandelbrot drawn.");
    }

    async function fetchQuantumSeed() {
        seedValueSpan.textContent = "[Fetching...]";
        try {
            const response = await fetch("https://qrng.anu.edu.au/API/jsonI.php?length=1&type=uint16", {
                cache: "no-store" // Try to prevent caching
            });
            if (!response.ok) {
                throw new Error(`ANU API Error: ${response.status}`);
            }
            const data = await response.json();
            if (data.success && data.data && data.data.length > 0) {
                currentSeed = data.data[0];
                seedValueSpan.textContent = currentSeed;
                console.log("Quantum Seed:", currentSeed);
            } else {
                throw new Error("ANU API did not return success or data.");
            }
        } catch (error) {
            console.error("Failed to fetch quantum seed:", error);
            currentSeed = Math.floor(Math.random() * 65536); // Use pseudo-random fallback
            seedValueSpan.textContent = `${currentSeed} (Fallback)`;
        }
    }

    async function updateOracleDisplay() {
        const currentMilli = Date.now();
        const inputString = `${currentSeed}-${currentMilli}`;
        
        // Basic SHA-256 like hashing (browser's SubtleCrypto)
        const encoder = new TextEncoder();
        const data = encoder.encode(inputString);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        const display_number = parseInt(hashHex.substring(0, 8), 16);
        oracleValueSpan.textContent = display_number;
    }


    function handleGenerate() {
        console.log("Generate button clicked. Intent:", intentInput.value);
        view.maxIter = parseInt(maxIterInput.value) || 50;
        
        // Super basic intent parsing - just changes zoom for now
        // A real version would use hashing like your Python script
        if (intentInput.value.toLowerCase().includes("zoom")) {
            view.xMin = -0.8; view.xMax = -0.6;
            view.yMin = -0.1; view.yMax = 0.1;
        } else if (intentInput.value.toLowerCase().includes("ship")) {
             // Placeholder for "Burning Ship" type coordinates
            view.xMin = -2.2; view.xMax = 1.2;
            view.yMin = -2.0; view.yMax = 0.8;
        }
        else { // Default Mandelbrot
            view.xMin = -2.0; view.xMax = 1.0;
            // yMin/yMax will be set by aspect ratio in setupCanvas
        }
        drawMandelbrot();
    }

    // --- Initial Setup & Event Listeners ---
    generateButton.addEventListener('click', handleGenerate);
    maxIterInput.addEventListener('change', () => {
        view.maxIter = parseInt(maxIterInput.value) || 50;
        // Optionally regenerate on change, or wait for "Generate"
        // drawMandelbrot();
    });

    // Handle window resize to redraw fractal correctly
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log("Window resized, redrawing fractal.");
            drawMandelbrot();
        }, 250); // Debounce resize
    });

    // Initial draw and Oracle setup
    fetchQuantumSeed().then(() => { // Fetch seed first
        updateOracleDisplay(); // Then update oracle once
        if (oracleInterval) clearInterval(oracleInterval);
        oracleInterval = setInterval(updateOracleDisplay, 1000); // Update oracle every second
        
        // Fetch new quantum seed periodically
        setInterval(fetchQuantumSeed, 30000); // Every 30 seconds
    });
    
    // Call handleGenerate to draw on load after a short delay for layout
    setTimeout(handleGenerate, 100); 
});
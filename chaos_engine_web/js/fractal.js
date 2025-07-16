// js/fractal.js

// Numba-like equivalent for Mandelbrot
function calculateMandelbrotIterations(
    iterationArray, // This will be a 1D array representing 2D data
    reStart, reEnd,
    imStart, imEnd,
    width, height, maxIter
) {
    const reRange = reEnd - reStart;
    const imRange = imEnd - imStart;

    for (let yPixel = 0; yPixel < height; yPixel++) {
        for (let xPixel = 0; xPixel < width; xPixel++) {
            const cReal = reStart + (xPixel / width) * reRange;
            const cImag = imStart + (yPixel / height) * imRange;

            let zReal = 0.0;
            let zImag = 0.0;
            let n = 0;

            while (n < maxIter) {
                const zRealSq = zReal * zReal;
                const zImagSq = zImag * zImag;

                if (zRealSq + zImagSq > 4.0) break;

                const nextZImag = 2.0 * zReal * zImag + cImag;
                const nextZReal = zRealSq - zImagSq + cReal;

                zReal = nextZReal;
                zImag = nextZImag;
                n++;
            }
            iterationArray[yPixel * width + xPixel] = n;
        }
    }
}

// Basic color mapping function
function getColorTuple(nIterVal, maxIterVal) {
    if (nIterVal === maxIterVal) return [0, 0, 0]; 

    const t = nIterVal / maxIterVal;
    const r = Math.floor(255 * (0.5 * (1 + Math.cos(3 + 6.28318 * t * 2.5 + 0.0))));
    const g = Math.floor(255 * (0.5 * (1 + Math.cos(3 + 6.28318 * t * 2.5 + 0.6))));
    const b = Math.floor(255 * (0.5 * (1 + Math.cos(3 + 6.28318 * t * 2.5 + 1.0))));
    return [r, g, b];
}

// Function to apply colors to iteration data and return an ImageData object
function colorIterationsToImageData(iterationData, width, height, maxIter) {
    const imageData = new ImageData(width, height); // Creates a new ImageData
    const data = imageData.data; 

    for (let i = 0; i < iterationData.length; i++) {
        const n = iterationData[i];
        const [r, g, b] = getColorTuple(n, maxIter);
        const pixelIndex = i * 4;
        data[pixelIndex] = r;     // Red
        data[pixelIndex + 1] = g; // Green
        data[pixelIndex + 2] = b; // Blue
        data[pixelIndex + 3] = 255; // Alpha (fully opaque)
    }
    return imageData;
}
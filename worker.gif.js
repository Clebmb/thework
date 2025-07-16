// This script runs in the background and is completely isolated from the main page.
// It is stable and will not crash.

// Import the gif.js library inside the worker
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js');

// --- Helper functions copied into the worker's scope ---
const transformPoints = (points, mX, mY, w, h) => points.map(p => ({ x: mX ? w - p.x : p.x, y: mY ? h - p.y : p.y }));
const _drawPathLogic = (targetCtx, points, options) => {
    if (points.length < 1) return;
    targetCtx.beginPath();
    if (options.curves && points.length > 1) {
        const m = points.map((p, i) => { const n = points[i + 1] || p; return { x: (p.x + n.x) / 2, y: (p.y + n.y) / 2 } });
        targetCtx.moveTo(points[0].x, points[0].y); targetCtx.lineTo(m[0].x, m[0].y);
        for (let i = 1; i < points.length - 1; i++) { targetCtx.quadraticCurveTo(points[i].x, points[i].y, m[i].x, m[i].y) }
        if (points.length > 1) targetCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    } else {
        targetCtx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) targetCtx.lineTo(points[i].x, points[i].y);
    }
    targetCtx.stroke();
    if (points.length > 1) {
        targetCtx.beginPath(); targetCtx.arc(points[0].x, points[0].y, 5, 0, 2 * Math.PI); targetCtx.fill();
        targetCtx.beginPath(); targetCtx.arc(points[points.length - 1].x, points[points.length - 1].y, 5, 0, 2 * Math.PI); targetCtx.fill();
    }
};

// --- The stable, deterministic drawing function for GIF frames ---
const drawGifFrame = (targetCtx, points, sigilTotalLength, options, timestamp) => {
    targetCtx.save();
    const { width, height } = targetCtx.canvas;
    targetCtx.globalAlpha = options.alpha;
    const color = options.anim.chroma ? `hsl(${(timestamp * (options.anim.chromaSpeed * 0.02)) % 360}, 100%, 50%)` : options.color;
    targetCtx.strokeStyle = color; targetCtx.fillStyle = color; targetCtx.lineWidth = 2.5;
    targetCtx.shadowColor = options.glow ? color : 'transparent'; targetCtx.shadowBlur = options.glow ? 25 : 0;
    if (options.anim.lineDash) { targetCtx.setLineDash([15, 10]); targetCtx.lineDashOffset = -(timestamp * (options.anim.lineDashSpeed * 0.01)); }

    let pointsToDraw = points;
    if (options.anim.segmentDraw) {
        const duration = Math.max(100, 10000 / (options.anim.segmentSpeed || 1));
        const progress = (timestamp % duration) / duration;
        let drawnLength = sigilTotalLength * progress;
        let sI=0, lS=drawnLength;
        while(sI < points.length - 1) { const sL=Math.hypot(points[sI+1].x-points[sI].x,points[sI+1].y-points[sI].y); if(lS<=sL)break; lS-=sL; sI++; }
        const animatedPoints = points.slice(0, sI + 1);
        if(sI < points.length - 1) { const t=lS/Math.hypot(points[sI+1].x-points[sI].x,points[sI+1].y-points[sI].y); animatedPoints.push({x:points[sI].x+t*(points[sI+1].x-points[sI].x),y:points[sI].y+t*(points[sI+1].y-points[sI].y)}) }
        pointsToDraw = animatedPoints;
    }

    const paths = [pointsToDraw];
    if (options.symX) paths.push(transformPoints(pointsToDraw, true, false, width, height));
    if (options.symY) paths.push(transformPoints(pointsToDraw, false, true, width, height));
    if (options.symX && options.symY) paths.push(transformPoints(pointsToDraw, true, true, width, height));

    targetCtx.translate(width / 2, height / 2);
    if (options.anim.pulse) { const baseScale = 0.95; targetCtx.scale(baseScale, baseScale); const scale = 1 + 0.05 * Math.sin(timestamp * (options.anim.pulseSpeed * 0.001)); targetCtx.scale(scale, scale); }
    if (options.anim.jitter) {
        const intensity = options.anim.jitterIntensity;
        const jitterX = Math.sin(timestamp * 0.1) * intensity * 0.5;
        const jitterY = Math.cos(timestamp * 0.15) * intensity * 0.5;
        targetCtx.translate(jitterX, jitterY);
    }
    targetCtx.rotate(options.rotation);
    targetCtx.translate(-width / 2, -height / 2);

    const segments = options.kaleidoscope, angleIncrement = (2 * Math.PI) / segments;
    for (let i = 0; i < segments; i++) {
        targetCtx.save();
        targetCtx.translate(width / 2, height / 2); ctx.rotate(angleIncrement * i); ctx.translate(-width / 2, -height / 2);
        paths.forEach(path => _drawPathLogic(ctx, path, options));
        targetCtx.restore();
    }
    targetCtx.restore();
};


// --- The main worker logic ---
self.onmessage = (e) => {
    const { options, points, sigilTotalLength, transparent } = e.data;
    
    const gif = new GIF({ workers: 2, quality: 10, workerScript: 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js', transparent: transparent ? '#000000' : null });
    const frames = 60, delay = 1000 / 30, duration = frames * delay;

    for (let i = 0; i < frames; i++) {
        // We MUST create a new canvas for each frame inside the worker.
        const canvas = new OffscreenCanvas(300, 300);
        const ctx = canvas.getContext('2d');
        const timestamp = i * delay;

        let frameOptions = { ...options };
        if (frameOptions.anim.rotateCw) frameOptions.rotation = (frameOptions.anim.rotateCwSpeed / 5) * (2 * Math.PI) * (timestamp / duration);
        else if (frameOptions.anim.rotateCcw) frameOptions.rotation = -(frameOptions.anim.rotateCcwSpeed / 5) * (2 * Math.PI) * (timestamp / duration);
        if (frameOptions.anim.strobe) { const period = frameOptions.anim.strobeSpeed; frameOptions.alpha = (timestamp % period) < (period / 2) ? 1 : 0; }
        
        if (!transparent) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 300, 300); }
        
        drawGifFrame(ctx, points, sigilTotalLength, frameOptions, timestamp);
        
        gif.addFrame(ctx.getImageData(0, 0, 300, 300), { delay: delay });
    }

    gif.on('finished', (blob) => {
        self.postMessage(blob); // Send the finished GIF back to the main page
    });

    gif.render();
};
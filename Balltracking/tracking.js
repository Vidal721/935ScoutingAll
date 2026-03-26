const video = document.getElementById('matchVideo');
const heatCanvas = document.getElementById('heatmapCanvas');
const interCanvas = document.getElementById('interactionCanvas');
const iCtx = interCanvas.getContext('2d');
const stats = document.getElementById('stats');
const modeLabel = document.getElementById('modeLabel');

// Initialize Heatmap (Assumes simpleheat is loaded)
const heat = simpleheat(heatCanvas);
heat.radius(15, 10);
heat.max(10); // Adjust intensity scaling

const procCanvas = document.createElement('canvas');
const pCtx = procCanvas.getContext('2d', { willReadFrequently: true });

let lastFrameData = null;
let robotPos = { x: 100, y: 400 }; 
let goalPos = { x: 400, y: 100 };
let fuelCount = 0;
let settingRobot = true;

// 1. Improved Interaction Logic
interCanvas.addEventListener('mousedown', (e) => {
    const rect = interCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (interCanvas.width / rect.width);
    const y = (e.clientY - rect.top) * (interCanvas.height / rect.height);

    if (settingRobot) {
        robotPos = { x, y };
        settingRobot = false;
        modeLabel.innerText = "SETTING GOAL";
    } else {
        goalPos = { x, y };
        settingRobot = true;
        modeLabel.innerText = "SETTING ROBOT";
    }
});

// 2. The Core Processing Loop
function processFrame() {
    // Logic: Always clear interaction canvas for overlays
    iCtx.clearRect(0, 0, 800, 450);
    drawVisualCues();

    if (video.paused || video.ended) {
        requestAnimationFrame(processFrame);
        return;
    }

    pCtx.drawImage(video, 0, 0, 800, 450);
    const currentFrame = pCtx.getImageData(0, 0, 800, 450);
    const pixels = currentFrame.data;

    if (lastFrameData) {
        // Step by 20 for a balance of accuracy and performance
        for (let i = 0; i < pixels.length; i += 20) { 
            const r = pixels[i], g = pixels[i+1], b = pixels[i+2];

            // Color: Yellow/Lime Fuel (R high, G high, B low)
            if (r > 150 && g > 130 && b < 100) {
                
                // Motion: Difference from last frame
                const diff = Math.abs(r - lastFrameData[i]) + Math.abs(g - lastFrameData[i+1]);
                
                if (diff > 50) {
                    const pixelIdx = i / 4;
                    const x = pixelIdx % 800;
                    const y = Math.floor(pixelIdx / 800);

                    if (isPointNearVector(x, y, robotPos, goalPos)) {
                        heat.add([x, y, 1]);
                        fuelCount += 0.005; // Tuned for 20-step increment
                        
                        // Small visual confirmation of detection
                        iCtx.fillStyle = "rgba(255, 0, 0, 0.5)";
                        iCtx.fillRect(x, y, 2, 2);
                    }
                }
            }
        }
    }

    // Save a copy of current pixels for next frame motion diff
    lastFrameData = new Uint8ClampedArray(pixels);
    stats.innerText = Math.floor(fuelCount);
    heat.draw();
    
    requestAnimationFrame(processFrame);
}

// 3. Mathematical Vector Check
function isPointNearVector(px, py, p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const L2 = dx * dx + dy * dy;
    if (L2 === 0) return false;

    const t = ((px - p1.x) * dx + (py - p1.y) * dy) / L2;
    if (t < 0 || t > 1) return false; 

    const projX = p1.x + t * dx;
    const projY = p1.y + t * dy;
    const dist = Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
    
    return dist < 40; // Detection corridor width
}

function drawVisualCues() {
    // Draw Corridor
    iCtx.beginPath();
    iCtx.strokeStyle = "rgba(0, 255, 0, 0.2)";
    iCtx.lineWidth = 80;
    iCtx.moveTo(robotPos.x, robotPos.y);
    iCtx.lineTo(goalPos.x, goalPos.y);
    iCtx.stroke();

    // Robot & Goal Markers
    iCtx.fillStyle = "lime";
    iCtx.font = "12px Arial";
    iCtx.fillText("START", robotPos.x - 15, robotPos.y + 20);
    iCtx.fillText("END", goalPos.x - 10, goalPos.y + 20);
    iCtx.beginPath();
    iCtx.arc(robotPos.x, robotPos.y, 5, 0, Math.PI * 2);
    iCtx.arc(goalPos.x, goalPos.y, 5, 0, Math.PI * 2);
    iCtx.fill();
}

function resetHeatmap() {
    heat.clear();
    fuelCount = 0;
    stats.innerText = "0";
}

processFrame();
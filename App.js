// ── Elements ──
let maxTimeInput        = document.getElementById("maxTime");
let video               = document.getElementById("video");
let overlay             = document.getElementById("overlay");
let ctx                 = overlay.getContext("2d", { willReadFrequently: true });
let distanceDisplay     = document.getElementById("distanceDisplay");
let markerSizeInput     = document.getElementById("markerSize");
let calibrationDistanceInput = document.getElementById("calibrationDistance");
let smoothSlider        = document.getElementById("smoothSlider");
let smoothVal           = document.getElementById("smoothVal");
let calibrateBtn        = document.getElementById("calibrateBtn");
let startBtn            = document.getElementById("startBtn");
let stopBtn             = document.getElementById("stopBtn");
let clearBtn            = document.getElementById("clearBtn");
let exportBtn           = document.getElementById("exportBtn");
let cameraBtn           = document.getElementById("cameraBtn");
let autoScaleToggle     = document.getElementById("autoScaleToggle");
let statusDot           = document.getElementById("statusDot");
let calStatus           = document.getElementById("calStatus");
let cameraPlaceholder   = document.getElementById("cameraPlaceholder");

// ── State ──
let focalLength         = null;
let lastKnownPixelWidth = null;
let recording           = false;
let data                = [];
let startTime           = null;
let smoothBuffer        = [];
let lastRecordTime      = 0;
let detector            = null;

// ── Smooth slider live label ──
smoothSlider.addEventListener("input", () => {
    smoothVal.textContent = smoothSlider.value;
});

// ── Chart ──
let chart = new Chart(document.getElementById("chart"), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Distance (ft)',
            data: [],
            borderColor: '#00e5ff',
            backgroundColor: 'rgba(0,229,255,0.07)',
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            tension: 0.3
        }]
    },
    options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { labels: { color: '#7986cb', font: { family: 'Space Mono', size: 11 } } }
        },
        scales: {
            x: {
                title: { display: true, text: "Time (s)", color: '#7986cb' },
                ticks: { color: '#7986cb', font: { family: 'Space Mono', size: 10 } },
                grid: { color: '#2e3356' }
            },
            y: {
                title: { display: true, text: "Distance (ft)", color: '#7986cb' },
                ticks: { color: '#7986cb', font: { family: 'Space Mono', size: 10 } },
                grid: { color: '#2e3356' },
                min: 0,
                max: 10
            }
        }
    }
});

// ── Y-axis scale toggle ──
autoScaleToggle.addEventListener("change", () => {
    if (autoScaleToggle.checked) {
        chart.options.scales.y.min = undefined;
        chart.options.scales.y.max = undefined;
    } else {
        chart.options.scales.y.min = 0;
        chart.options.scales.y.max = 10;
    }
    chart.update();
});

// ── Camera ──
cameraBtn.onclick = function () {
    if (typeof AR === "undefined" || typeof AR.Detector === "undefined") {
        alert("ArUco library failed to load. Check your internet connection and refresh.");
        return;
    }
    if (!detector) detector = new AR.Detector();

    navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
            video.srcObject = stream;
            video.style.display = "block";
            cameraPlaceholder.style.display = "none";
            video.onloadedmetadata = () => {
                video.play();
                statusDot.classList.add("active");
                requestAnimationFrame(processVideo);
            };
            cameraBtn.disabled = true;
            cameraBtn.textContent = "Camera On";
        })
        .catch(err => {
            alert("Camera access denied or unavailable: " + err.message);
            console.error(err);
        });
};

// ── Smoothing ──
function smooth(value) {
    smoothBuffer.push(value);
    if (smoothBuffer.length > parseInt(smoothSlider.value))
        smoothBuffer.shift();
    return smoothBuffer.reduce((a, b) => a + b) / smoothBuffer.length;
}

// ── Process video frame ──
function processVideo() {
    if (!video.videoWidth) {
        requestAnimationFrame(processVideo);
        return;
    }

    overlay.width  = video.videoWidth;
    overlay.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    let imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);
    let markers   = detector.detect(imageData);

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (markers.length > 0) {
        let corners = markers[0].corners;

        // Draw marker outline
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth   = 3;
        ctx.beginPath();
        corners.forEach((c, i) => {
            i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y);
        });
        ctx.closePath();
        ctx.stroke();

        // Corner dots
        ctx.fillStyle = "#ff4081";
        corners.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Pixel width of marker
        let widthPixels = Math.hypot(
            corners[0].x - corners[1].x,
            corners[0].y - corners[1].y
        );
        lastKnownPixelWidth = widthPixels;

        if (focalLength) {
            let distanceCm  = (parseFloat(markerSizeInput.value) * focalLength) / widthPixels;
            distanceCm      = smooth(distanceCm);
            let distanceFt  = distanceCm / 30.48;

            distanceDisplay.innerText = "Distance: " + distanceFt.toFixed(3) + " ft";

            if (recording) {
                let t = (Date.now() - startTime) / 1000;

                if (t >= parseFloat(maxTimeInput.value)) {
                    recording = false;
                    statusDot.classList.remove("recording");
                    statusDot.classList.add("active");
                    alert("Recording complete!");
                } else if (t - lastRecordTime >= 0.05) {
                    lastRecordTime = t;
                    let tVal = parseFloat(t.toFixed(2));
                    let dVal = parseFloat(distanceFt.toFixed(3));
                    chart.data.labels.push(tVal);
                    chart.data.datasets[0].data.push(dVal);
                    chart.update();
                    data.push([tVal, dVal]);
                }
            }
        } else {
            distanceDisplay.innerText = "Not calibrated";
        }

    } else {
        distanceDisplay.innerText = "Marker not detected";
        lastKnownPixelWidth = null;
    }

    requestAnimationFrame(processVideo);
}

// ── Calibrate ──
calibrateBtn.onclick = function () {
    if (!lastKnownPixelWidth) {
        alert("Hold the marker in front of the camera first, then click Calibrate.");
        return;
    }
    let knownDistance = parseFloat(calibrationDistanceInput.value);
    let markerSize    = parseFloat(markerSizeInput.value);
    focalLength       = (lastKnownPixelWidth * knownDistance) / markerSize;
    calStatus.textContent = "Calibrated at " + knownDistance + " cm";
    calStatus.classList.add("ok");
};

// ── Start recording ──
startBtn.onclick = function () {
    if (!focalLength) {
        alert("Please calibrate first.");
        return;
    }
    recording      = true;
    startTime      = Date.now();
    lastRecordTime = 0;
    smoothBuffer   = [];
    statusDot.classList.add("recording");
};

// ── Stop recording ──
stopBtn.onclick = function () {
    recording = false;
    smoothBuffer   = [];
    lastRecordTime = 0;
    statusDot.classList.remove("recording");
    if (focalLength) statusDot.classList.add("active");
};

// ── Clear data ──
clearBtn.onclick = function () {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
    data           = [];
    smoothBuffer   = [];
    lastRecordTime = 0;
    recording      = false;
    statusDot.classList.remove("recording");
};

// ── Export CSV ──
exportBtn.onclick = function () {
    if (data.length === 0) {
        alert("No data to export yet!");
        return;
    }
    let csv = "time_seconds,distance_ft\n";
    data.forEach(row => { csv += row[0] + "," + row[1] + "\n"; });
    let blob = new Blob([csv], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "motion_data.csv";
    link.click();
};

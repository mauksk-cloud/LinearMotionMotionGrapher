let maxTimeInput = document.getElementById("maxTime");
let video = document.getElementById("video");
let overlay = document.getElementById("overlay");
let ctx = overlay.getContext("2d", { willReadFrequently: true });
let distanceDisplay = document.getElementById("distanceDisplay");

let markerSizeInput = document.getElementById("markerSize");
let calibrationDistanceInput = document.getElementById("calibrationDistance");
let smoothSlider = document.getElementById("smoothSlider");

let calibrateBtn = document.getElementById("calibrateBtn");
let startBtn = document.getElementById("startBtn");
let stopBtn = document.getElementById("stopBtn");
let clearBtn = document.getElementById("clearBtn");
let exportBtn = document.getElementById("exportBtn");
let lastRecordTime = 0;

let focalLength = null;
let recording = false;
let data = [];
let startTime = null;
let smoothBuffer = [];

let chart = new Chart(document.getElementById("chart"), {
    type: 'line',
    data: {
        labels: [],
        datasets: [{
            label: 'Distance (cm)',
            data: [],
            borderWidth: 2,
            pointRadius: 0
        }]
    },
    options: {
        animation: false,
        responsive: true,
        scales: {
            x: {
                title: { display: true, text: "Time (s)" },
                grid: { display: true }
            },
            y: {
                title: { display: true, text: "Distance (cm)" },
                grid: { display: true }
            }
        }
    }
});

let cameraBtn = document.getElementById("cameraBtn");
let detector = new AR.Detector();  // js-aruco2 detector

cameraBtn.onclick = function() {
    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
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

function smooth(value) {
    smoothBuffer.push(value);
    if (smoothBuffer.length > smoothSlider.value)
        smoothBuffer.shift();
    return smoothBuffer.reduce((a,b)=>a+b)/smoothBuffer.length;
}

function processVideo() {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    let imageData = ctx.getImageData(0, 0, overlay.width, overlay.height);

    let markers = detector.detect(imageData);

    ctx.clearRect(0, 0, overlay.width, overlay.height);

    if (markers.length > 0) {
        let corners = markers[0].corners;

        // Draw box around marker
        ctx.strokeStyle = "lime";
        ctx.beginPath();
        corners.forEach((c, i) => {
            i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y);
        });
        ctx.closePath();
        ctx.stroke();

        // Calculate width in pixels
        let widthPixels = Math.hypot(
            corners[0].x - corners[1].x,
            corners[0].y - corners[1].y
        );

        if (focalLength) {
            let distance = (markerSizeInput.value * focalLength) / widthPixels;
            distance = smooth(distance);
            distanceDisplay.innerText = "Distance: " + distance.toFixed(1) + " cm";

            if (recording) {
                let t = (Date.now() - startTime) / 1000;
                if (t >= parseFloat(maxTimeInput.value)) {
                    recording = false;
                    alert("Recording complete.");
                } else if (t - lastRecordTime >= 0.05) {  // record every 50ms = 20 samples/sec
                    lastRecordTime = t;
                    chart.data.labels.push(parseFloat(t.toFixed(2)));
                    chart.data.datasets[0].data.push(parseFloat(distance.toFixed(1)));
                    chart.update();
                    data.push([t, parseFloat(distance.toFixed(1))]);
                }
            }
        }
    } else {
        distanceDisplay.innerText = "Marker Not Detected";
    }

    requestAnimationFrame(processVideo);
}

calibrateBtn.onclick = function() {
    focalLength = (parseFloat(calibrationDistanceInput.value) * 
                   parseFloat(markerSizeInput.value)) / 100;
    alert("Calibration set.");
};

startBtn.onclick = function() {
    if (!focalLength) {
        alert("Please calibrate first.");
        return;
    }
    recording = true;
    startTime = Date.now();
};

stopBtn.onclick = function() {
    recording = false;
};

clearBtn.onclick = function() {
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.update();
    data = [];
};

exportBtn.onclick = function() {
    let csv = "time_seconds,distance_cm\n";
    data.forEach(row => {
        csv += row[0] + "," + row[1] + "\n";
    });
    let blob = new Blob([csv], { type: "text/csv" });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "motion_data.csv";
    link.click();
};


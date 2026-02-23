let maxTimeInput = document.getElementById("maxTime");
let video = document.getElementById("video");
let overlay = document.getElementById("overlay");
let ctx = overlay.getContext("2d");
let distanceDisplay = document.getElementById("distanceDisplay");

let markerSizeInput = document.getElementById("markerSize");
let calibrationDistanceInput = document.getElementById("calibrationDistance");
let smoothSlider = document.getElementById("smoothSlider");

let calibrateBtn = document.getElementById("calibrateBtn");
let startBtn = document.getElementById("startBtn");
let stopBtn = document.getElementById("stopBtn");
let clearBtn = document.getElementById("clearBtn");
let exportBtn = document.getElementById("exportBtn");

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

window.addEventListener("DOMContentLoaded", () => {

    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            video.play();
            requestAnimationFrame(processVideo);
        };
    })
    .catch(err => {
        alert("Camera access denied or unavailable.");
        console.error(err);
    });

});

function smooth(value) {
    smoothBuffer.push(value);
    if (smoothBuffer.length > smoothSlider.value)
        smoothBuffer.shift();
    return smoothBuffer.reduce((a,b)=>a+b)/smoothBuffer.length;
}

function processVideo() {
    if (!cv || !cv.aruco) {
        requestAnimationFrame(processVideo);
        return;
    }

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    let src = new cv.Mat(video.videoHeight, video.videoWidth, cv.CV_8UC4);
    let cap = new cv.VideoCapture(video);
    cap.read(src);

    let gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    let dictionary = new cv.aruco.Dictionary(cv.aruco.DICT_4X4_50);
    let parameters = new cv.aruco.DetectorParameters();

    let corners = new cv.MatVector();
    let ids = new cv.Mat();

    cv.aruco.detectMarkers(gray, dictionary, corners, ids, parameters);

    ctx.clearRect(0,0,overlay.width,overlay.height);

    if (ids.rows > 0) {
        let corner = corners.get(0);
        let widthPixels = Math.hypot(
            corner.data32F[0] - corner.data32F[2],
            corner.data32F[1] - corner.data32F[3]
        );

        if (focalLength) {
            let distance = (markerSizeInput.value * focalLength) / widthPixels;
            distance = smooth(distance);
            distanceDisplay.innerText = "Distance: " + distance.toFixed(1) + " cm";

            if (recording) {
                let t = (Date.now() - startTime)/1000;
                chart.data.labels.push(t.toFixed(2));
                chart.data.datasets[0].data.push(distance.toFixed(1));
                chart.update();
                data.push([t,distance]);
            }
        }

        ctx.strokeStyle = "lime";
        ctx.beginPath();
        for (let i=0; i<4; i++) {
            ctx.lineTo(corner.data32F[i*2], corner.data32F[i*2+1]);
        }
        ctx.closePath();
        ctx.stroke();
    } else {
        distanceDisplay.innerText = "Marker Not Detected";
    }

    src.delete(); gray.delete(); corners.delete(); ids.delete();
    requestAnimationFrame(processVideo);
}

calibrateBtn.onclick = function() {
    if (!cv) return;
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


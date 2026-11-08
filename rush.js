
/* ==========================================
   MANIFEST RUSH: CATCH THE CONCERT
   LEVEL 01 - THE FIRST CONCERT
   Real Route + Quiz + Scoring + Concert
========================================== */

// LOCATION AND GAME SETTINGS

const rushStart = [40.9923, 29.0920];
const rushDestination = [40.99757, 29.09937];

const PREVIEW_SECONDS = 20;
const QUIZ_FRACTIONS = [0.35, 0.70];

const RUSH_VIDEO_PATH =
    "assets/videos/istanbul-concert.mp4";

// MANIFEST QUESTIONS

const rushQuestions = [
    {
        question: "Manifest grubunda kaç üye vardır?",
        options: ["4", "5", "6", "7"],
        correct: 2
    },
    {
        question: "Oyunumuzda hangi Manifest üyesinin rengi yeşil?",
        options: ["Mina", "Sueda", "Hilal", "Lidya"],
        correct: 1
    }
];

// GAME STATE

let rushPhase = "idle";
let rushRoute = [];
let rushRouteData = null;
let currentRouteIndex = 0;

let rushPlayerMarker = null;
let rushRouteLine = null;
let rushProgressLine = null;
let rushDestinationMarker = null;
let rushStartMarker = null;

let rushQuizMarkers = [];
let rushQuizIndexes = [];
let rushQuizAnswered = [false, false];
let rushQuizPoints = 0;
let activeQuiz = -1;

let previewInterval = null;
let motionInterval = null;

let playerGuess = {
    distance: null,
    time: null
};

// HELPERS

function rushElement(id) {
    return document.getElementById(id);
}

function rushMap() {
    if (!window.gameMap) {
        throw new Error(
            "Leaflet haritası bulunamadı. map.js dosyasını kontrol et."
        );
    }

    return window.gameMap;
}

function rushColor() {
    const color = getComputedStyle(
        document.documentElement
    ).getPropertyValue("--player-color").trim();

    return color || "#a66cff";
}

// DECODE VALHALLA ROUTE

function decodePolyline6(encoded) {
    const coordinates = [];

    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        const pair = [];

        for (let axis = 0; axis < 2; axis++) {
            let result = 0;
            let shift = 0;
            let byte;

            do {
                if (index >= encoded.length) {
                    throw new Error("Eksik rota geometrisi");
                }

                byte = encoded.charCodeAt(index++) - 63;
                result += (byte & 31) * Math.pow(2, shift);
                shift += 5;

            } while (byte >= 32);

            pair.push(
                result % 2
                    ? -(Math.floor(result / 2) + 1)
                    : result / 2
            );
        }

        lat += pair[0];
        lng += pair[1];

        coordinates.push([
            lat / 1e6,
            lng / 1e6
        ]);
    }

    return coordinates;
}

// GET REAL PEDESTRIAN ROUTE

async function getRealWalkingRoute() {

    const request = {
        locations: [
            {
                lat: rushStart[0],
                lon: rushStart[1]
            },
            {
                lat: rushDestination[0],
                lon: rushDestination[1]
            }
        ],
        costing: "pedestrian",
        units: "kilometers",
        language: "tr"
    };

    const url = new URL(
        "https://valhalla1.openstreetmap.de/route"
    );

    url.searchParams.set(
        "json",
        JSON.stringify(request)
    );

    const response = await fetch(url.toString());

    if (!response.ok) {
        throw new Error(
            `Yönlendirme servisi HTTP ${response.status}`
        );
    }

    const data = await response.json();

    const encoded = data.trip?.legs?.[0]?.shape;
    const distanceKm = Number(
        data.trip?.summary?.length
    );
    const durationSeconds = Number(
        data.trip?.summary?.time
    );

    if (
        !encoded ||
        !Number.isFinite(distanceKm) ||
        !Number.isFinite(durationSeconds)
    ) {
        throw new Error(
            "Servis geçerli mesafe/süre/rota döndürmedi."
        );
    }

    const coordinates = decodePolyline6(encoded);

    if (coordinates.length < 2) {
        throw new Error("Rota çok kısa veya boş.");
    }

    return {
        coordinates,
        distance: distanceKm * 1000,
        time: durationSeconds / 60
    };
}

// CREATE MOVEMENT POINTS

function createMovementPoints(
    coordinates,
    stepMeters = 12
) {
    const points = [coordinates[0]];

    for (let i = 1; i < coordinates.length; i++) {

        const a = L.latLng(coordinates[i - 1]);
        const b = L.latLng(coordinates[i]);

        const count = Math.max(
            1,
            Math.ceil(a.distanceTo(b) / stepMeters)
        );

        for (let j = 1; j <= count; j++) {
            const t = j / count;

            points.push([
                a.lat + (b.lat - a.lat) * t,
                a.lng + (b.lng - a.lng) * t
            ]);
        }
    }

    return points;
}

// SELECTED CHARACTER ICON

function createRushPlayerIcon() {

    const id = localStorage.getItem(
        "manifestCharacter"
    );

    const character =
        (typeof characters !== "undefined" &&
            characters[id]) ||
        (typeof characters !== "undefined" &&
            characters.zoktay);

    const image = character?.image || "";
    const name = character?.name || "Oyuncu";
    const color = character?.color || rushColor();

    return L.divIcon({
        className: "player-marker",
        html: `
            <div class="rush-avatar"
                 style="--player-color:${color}">
                <img src="${image}" alt="${name}">
            </div>
        `,
        iconSize: [54, 54],
        iconAnchor: [27, 27]
    });
}

// MOVEMENT CONTROLS

function setRushControls(visible) {
    rushElement("movement-controls")
        ?.classList.toggle("visible", visible);
}

// REMOVE MAP OBJECTS

function removeRushLayers() {

    const map = rushMap();

    [
        rushPlayerMarker,
        rushRouteLine,
        rushProgressLine,
        rushDestinationMarker,
        rushStartMarker,
        ...rushQuizMarkers
    ].forEach(layer => {
        if (layer) map.removeLayer(layer);
    });

    rushPlayerMarker = null;
    rushRouteLine = null;
    rushProgressLine = null;
    rushDestinationMarker = null;
    rushStartMarker = null;
    rushQuizMarkers = [];
}

// START LEVEL - REAL ROUTE PREVIEW

async function startRushLevel() {

    if (
        rushPhase === "playing" ||
        rushPhase === "quiz"
    ) {
        rushMap().flyTo(
            rushRoute[currentRouteIndex], 17
        );
        return;
    }

    if (rushPhase !== "idle") return;

    rushPhase = "loading";
    setRushControls(false);

    try {

        rushRouteData = await getRealWalkingRoute();

        const map = rushMap();

        rushRouteLine = L.polyline(
            rushRouteData.coordinates,
            {
                color: rushColor(),
                weight: 7,
                opacity: 0.9
            }
        ).addTo(map);

        rushStartMarker = L.circleMarker(
            rushRouteData.coordinates[0],
            {
                radius: 10,
                color: "#fff",
                fillColor: "#3498ff",
                fillOpacity: 1,
                weight: 3
            }
        ).addTo(map);

        rushStartMarker.bindTooltip(
            "🚩 START",
            {
                permanent: true,
                direction: "top"
            }
        );

        rushDestinationMarker = L.circleMarker(
            rushRouteData.coordinates.at(-1),
            {
                radius: 10,
                color: "#fff",
                fillColor: "#ff4fc3",
                fillOpacity: 1,
                weight: 3
            }
        ).addTo(map);

        rushDestinationMarker.bindTooltip(
            "🎤 JJ ARENA",
            {
                permanent: true,
                direction: "top"
            }
        );

        map.fitBounds(
            rushRouteLine.getBounds(),
            {
                padding: [65, 65],
                maxZoom: 16
            }
        );

        rushPhase = "preview";

        const panel = rushElement(
            "map-preview-panel"
        );

        if (panel) panel.hidden = false;

        let remaining = PREVIEW_SECONDS;

        const timer = rushElement("preview-timer");

        if (timer) {
            timer.textContent = "00:20";
        }

        previewInterval = setInterval(() => {

            remaining -= 1;

            if (timer) {
                timer.textContent =
                    `00:${String(
                        Math.max(0, remaining)
                    ).padStart(2, "0")}`;
            }

            if (remaining <= 0) {
                clearInterval(previewInterval);
                previewInterval = null;

                finishMapPreview();
            }

        }, 1000);

    } catch (error) {

        console.error("Rota yükleme hatası:", error);

        rushPhase = "idle";

        alert(
            "Gerçek yürüyüş rotası yüklenemedi. " +
            "İnternet bağlantını ve Console bölümünü kontrol et."
        );
    }
}

// FINISH PREVIEW


function finishMapPreview() {

    if (rushPhase !== "preview") return;

    // Stop preview timer
    if (previewInterval !== null) {
        clearInterval(previewInterval);
        previewInterval = null;
    }

    rushPhase = "guess";

    const previewPanel = document.getElementById(
        "map-preview-panel"
    );

    const guessOverlay = document.getElementById(
        "guess-overlay"
    );

    // Hide countdown
    if (previewPanel) {
        previewPanel.hidden = true;
    }

    // Show estimation screen
    if (guessOverlay) {
        guessOverlay.hidden = false;
        guessOverlay.style.display = "flex";

        document.body.style.overflow = "hidden";

        const distanceInput = document.getElementById(
            "guess-distance"
        );

        if (distanceInput) {
            distanceInput.value = "";
        }

        console.log("Estimation screen opened!");

    } else {
        console.error("guess-overlay bulunamadı!");
    }
}


// FIND TWO QUIZ POSITIONS

function findRushQuizIndexes(route) {

    const cumulative = [0];

    for (let i = 1; i < route.length; i++) {

        cumulative.push(
            cumulative[i - 1] +
            L.latLng(route[i - 1])
                .distanceTo(L.latLng(route[i]))
        );
    }

    const total = cumulative.at(-1);

    return QUIZ_FRACTIONS.map(fraction => {

        const target = total * fraction;

        let index = cumulative.findIndex(
            value => value >= target
        );

        if (index === -1) {
            index = route.length - 2;
        }

        return Math.max(
            1,
            Math.min(index, route.length - 2)
        );
    });
}

// CREATE QUIZ STARS

function createRushQuizStars() {

    rushQuizIndexes = findRushQuizIndexes(
        rushRoute
    );

    rushQuizMarkers = rushQuizIndexes.map(
        (index, questionIndex) => {

            const marker = L.marker(
                rushRoute[index],
                {
                    icon: L.divIcon({
                        className: "quiz-star-marker",
                        html: '<div class="quiz-star">★</div>',
                        iconSize: [42, 42],
                        iconAnchor: [21, 21]
                    })
                }
            ).addTo(rushMap());

            marker.bindTooltip(
                `Manifest Quiz ${questionIndex + 1}`
            );

            return marker;
        }
    );
}

// LAUNCH WALKING GAME

async function launchRushRoute() {

    if (
        rushPhase !== "guess" ||
        !rushRouteData
    ) return;

    const map = rushMap();

    rushRoute = createMovementPoints(
        rushRouteData.coordinates
    );

    currentRouteIndex = 0;

    rushQuizPoints = 0;
    rushQuizAnswered = [false, false];

    rushPhase = "playing";

    if (rushStartMarker) {
        map.removeLayer(rushStartMarker);
        rushStartMarker = null;
    }

    rushProgressLine = L.polyline(
        [rushRoute[0]],
        {
            color: "#39d98a",
            weight: 7
        }
    ).addTo(map);

    rushPlayerMarker = L.marker(
        rushRoute[0],
        {
            icon: createRushPlayerIcon(),
            zIndexOffset: 1000
        }
    ).addTo(map);

    createRushQuizStars();

    setRushControls(true);

    map.setView(rushRoute[0], 17);

    if (rushElement("score")) {
        rushElement("score").textContent = "0";
    }
}

// MOVE PLAYER ALONG REAL ROUTE

function moveRushPlayer(direction) {

    if (rushPhase !== "playing") return;

    const delta =
        direction === "forward" ? 1 :
        direction === "backward" ? -1 : 0;

    if (!delta) return;

    currentRouteIndex = Math.max(
        0,
        Math.min(
            rushRoute.length - 1,
            currentRouteIndex + delta
        )
    );

    const position = rushRoute[currentRouteIndex];

    rushPlayerMarker.setLatLng(position);

    rushProgressLine.setLatLngs(
        rushRoute.slice(
            0,
            currentRouteIndex + 1
        )
    );

    rushMap().panTo(position, {
        animate: true,
        duration: 0.15
    });

    const index = rushQuizIndexes.findIndex(
        (point, i) =>
            point === currentRouteIndex &&
            !rushQuizAnswered[i]
    );

    if (index >= 0) {
        openRushQuiz(index);
        return;
    }

    if (
        currentRouteIndex === rushRoute.length - 1
    ) {
        completeRushLevel();
    }
}

// OPEN QUIZ SCREEN

function openRushQuiz(index) {

    rushPhase = "quiz";
    stopRushMotion();

    activeQuiz = index;

    const question = rushQuestions[index];

    rushElement("quiz-title").textContent =
        `QUESTION ${index + 1}`;

    rushElement("quiz-question").textContent =
        question.question;

    rushElement("quiz-feedback").textContent = "";

    const options = rushElement("quiz-options");

    options.replaceChildren();

    rushElement("quiz-continue").hidden = true;

    question.options.forEach(
        (option, optionIndex) => {

            const button = document.createElement(
                "button"
            );

            button.type = "button";
            button.className = "quiz-option";

            button.textContent =
                `${String.fromCharCode(
                    65 + optionIndex
                )}. ${option}`;

            button.addEventListener("click", () => {
                answerRushQuiz(index, optionIndex);
            });

            options.appendChild(button);
        }
    );

    rushElement("quiz-overlay").hidden = false;
}

// CHECK QUIZ ANSWER

function answerRushQuiz(index, chosen) {

    if (
        rushPhase !== "quiz" ||
        rushQuizAnswered[index] ||
        index !== activeQuiz
    ) return;

    rushQuizAnswered[index] = true;

    const correctIndex = rushQuestions[index].correct;
    const correct = chosen === correctIndex;

    if (correct) {
        rushQuizPoints += 100;
    }

    rushElement("score").textContent =
        String(rushQuizPoints);

    rushElement("quiz-options")
        .querySelectorAll("button")
        .forEach((button, i) => {

            button.disabled = true;

            if (i === correctIndex) {
                button.classList.add("correct");
            }

            if (!correct && i === chosen) {
                button.classList.add("wrong");
            }
        });

    const feedback = rushElement(
        "quiz-feedback"
    );

    feedback.textContent = correct
        ? "✅ DOĞRU! +100 PUAN"
        : "❌ YANLIŞ! +0 PUAN";

    feedback.style.color = correct
        ? "#39d98a"
        : "#ff758a";

    rushQuizMarkers[index].setIcon(
        L.divIcon({
            className: "quiz-star-marker",
            html:
                '<div class="quiz-star completed">✓</div>',
            iconSize: [42, 42],
            iconAnchor: [21, 21]
        })
    );

    rushElement("quiz-continue").hidden = false;
}

// SCORE ESTIMATIONS

function scoreRushEstimates() {

    const distanceError = Math.abs(
        playerGuess.distance -
        rushRouteData.distance
    );

    const timeError = Math.abs(
        playerGuess.time -
        rushRouteData.time
    );

    const distancePoints =
        distanceError <= 5 ? 100 :
        distanceError <= 50 ? 75 :
        distanceError <= 150 ? 40 : 0;

    const timePoints =
        timeError <= 1 ? 100 :
        timeError <= 3 ? 50 : 0;

    return {
        distanceError,
        timeError,
        distancePoints,
        timePoints,
        quizPoints: rushQuizPoints,
        totalPoints:
            distancePoints +
            timePoints +
            rushQuizPoints
    };
}

// COMPLETE THE CONCERT LEVEL

function completeRushLevel() {

    if (rushPhase !== "playing") return;

    rushPhase = "completed";

    stopRushMotion();
    setRushControls(false);

    const result = scoreRushEstimates();

    rushElement("score").textContent =
        String(result.totalPoints);

    showRushConcertVideo(
        () => showRushResults(result)
    );
}

// PLAY 15-SECOND CONCERT VIDEO

function showRushConcertVideo(onFinish) {

    const overlay = document.createElement("div");
    overlay.className = "game-overlay";
    overlay.id = "rush-video-overlay";

    const panel = document.createElement("div");
    panel.className = "guess-panel";

    const heading = document.createElement("h2");
    heading.textContent = "🎤 THE FIRST CONCERT!";

    const message = document.createElement("p");

    message.textContent =
        "JJ Arena'ya ulaştın! " +
        "15 saniyelik konser kesiti.";

    const video = document.createElement("video");

    video.src = RUSH_VIDEO_PATH;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";

    video.style.cssText =
        "width:100%;max-height:50vh;" +
        "margin:14px 0;border-radius:12px;" +
        "background:#12091f";

    const play = document.createElement("button");

    play.type = "button";
    play.className = "main-button";
    play.textContent = "▶ KONSER VİDEOSUNU OYNAT";

    const next = document.createElement("button");

    next.type = "button";
    next.className = "secondary-button";
    next.textContent = "SONUÇLARI GÖR →";

    next.style.margin = "12px auto 0";

    let finished = false;

    function finish() {

        if (finished) return;

        finished = true;

        video.pause();
        overlay.remove();

        onFinish();
    }

    play.addEventListener("click", async () => {

        try {
            await video.play();
        } catch (error) {
            message.textContent =
                "Video açılamadı. Dosya yolunu " +
                "kontrol edip sonuçlara geçebilirsin.";
        }
    });

    video.addEventListener("timeupdate", () => {
        if (video.currentTime >= 15) {
            finish();
        }
    });

    video.addEventListener("ended", finish);

    video.addEventListener("error", () => {
        message.textContent =
            "Video dosyası bulunamadı. " +
            "assets/videos/istanbul-concert.mp4 " +
            "dosyasını eklemelisin.";
    });

    next.addEventListener("click", finish);

    panel.append(
        heading,
        message,
        video,
        play,
        next
    );

    overlay.appendChild(panel);

    document.body.appendChild(overlay);
}

// FINAL RESULTS SCREEN


/* ==========================================
   MANIFEST RUSH - MODERN RESULTS SCREEN
========================================== */

function showRushResults(result) {

    document.getElementById("rush-results")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "rush-results";
    overlay.className = "game-overlay";

    const panel = document.createElement("div");
    panel.className = "rush-results-panel";

    const distanceGuess = playerGuess.distance.toFixed(0);
    const distanceActual = rushRouteData.distance.toFixed(0);

    const timeGuess = playerGuess.time.toFixed(1);
    const timeActual = rushRouteData.time.toFixed(1);

    const correctAnswers = rushQuizPoints / 100;

    panel.innerHTML = `
        <div class="rush-results-header">
            <div class="rush-trophy">🏆</div>

            <p class="rush-level">
                LEVEL 01 — THE FIRST CONCERT
            </p>

            <h2>YOU MADE IT!</h2>

            <p class="rush-location">
                JJ Arena · İstanbul
            </p>
        </div>

        <div class="rush-comparison">

            <div class="rush-result-card">
                <h3>TAHMİNİN</h3>

                <span>Mesafe</span>
                <strong>${distanceGuess} m</strong>

                <span>Yürüme süresi</span>
                <strong>${timeGuess} dk</strong>
            </div>

            <div class="rush-result-card">
                <h3>GERÇEK ROTA</h3>

                <span>Mesafe</span>
                <strong>${distanceActual} m</strong>

                <span>Yürüme süresi</span>
                <strong>${timeActual} dk</strong>
            </div>

        </div>

        <div class="rush-differences">
            <h3>TAHMİN FARKLARIN</h3>

            <div class="rush-difference-row">
                <span>Mesafe farkı</span>
                <strong>
                    ${result.distanceError.toFixed(1)} m
                    · +${result.distancePoints} puan
                </strong>
            </div>

            <div class="rush-difference-row">
                <span>Süre farkı</span>
                <strong>
                    ${result.timeError.toFixed(1)} dk
                    · +${result.timePoints} puan
                </strong>
            </div>

            <div class="rush-difference-row">
                <span>Manifest soruları</span>
                <strong>
                    ${correctAnswers}/2 doğru
                    · +${result.quizPoints} puan
                </strong>
            </div>
        </div>

        <div class="rush-final-score">
            <p>KAZANDIĞIN TOPLAM PUAN</p>

            <h2>${result.totalPoints} / 400</h2>
        </div>

        <button id="rush-back-map" class="rush-back-button">
            HARİTAYA DÖN
        </button>

        <p class="rush-result-note">
            Yürüme süresi, rota servisinin tahmini değeridir.
        </p>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    document.getElementById("rush-back-map")
        .addEventListener("click", () => {
            overlay.remove();
        });
}


// HOLD BUTTON TO WALK

function holdRushMotion(direction) {

    stopRushMotion();

    moveRushPlayer(direction);

    if (rushPhase !== "playing") return;

    motionInterval = setInterval(() => {
        moveRushPlayer(direction);
    }, 95);
}


/* =====================================
   MOVEMENT CONTROL FIX
===================================== */

let rushMotionTimer = null;

// Stop character movement
function stopRushMotion() {

    if (rushMotionTimer !== null) {
        clearInterval(rushMotionTimer);
        rushMotionTimer = null;
    }
}

// Start movement while button is held
function holdRushMotion(direction) {

    stopRushMotion();

    if (rushPhase !== "playing") {
        return;
    }

    moveRushPlayer(direction);

    if (rushPhase !== "playing") {
        return;
    }

    rushMotionTimer = setInterval(() => {

        if (rushPhase !== "playing") {
            stopRushMotion();
            return;
        }

        moveRushPlayer(direction);

    }, 95);
}

// BIND PHONE BUTTONS

function bindRushControl(id, direction) {

    const button = rushElement(id);

    if (!button) return;

    button.addEventListener(
        "pointerdown",
        event => {

            event.preventDefault();

            button.setPointerCapture?.(
                event.pointerId
            );

            holdRushMotion(direction);
        }
    );

    [
        "pointerup",
        "pointercancel",
        "lostpointercapture",
        "pointerleave"
    ].forEach(name => {

        button.addEventListener(
            name,
            stopRushMotion
        );
    });
}

// HIDE UNUSED LEFT AND RIGHT BUTTONS

["move-left", "move-right"].forEach(id => {

    const button = rushElement(id);

    if (button) button.hidden = true;
});

// CONNECT WALKING CONTROLS

bindRushControl("move-up", "forward");
bindRushControl("move-down", "backward");

// KEYBOARD MOVEMENT

document.addEventListener("keydown", event => {

    if (rushPhase !== "playing") return;

    if (
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
    ) {
        event.preventDefault();

        moveRushPlayer(
            event.key === "ArrowUp"
                ? "forward"
                : "backward"
        );
    }
});

// CONTINUE AFTER ANSWERING QUIZ

rushElement("quiz-continue")
    ?.addEventListener("click", () => {

        if (
            rushPhase !== "quiz" ||
            !rushQuizAnswered[activeQuiz]
        ) return;

        rushElement("quiz-overlay").hidden = true;

        activeQuiz = -1;
        rushPhase = "playing";
    });

// SAVE DISTANCE AND TIME GUESSES



/* ==========================================
   MOBILE GAME START FIX
========================================== */

const rushGuessForm = document.getElementById("guess-form");

if (rushGuessForm) {

    rushGuessForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        console.log("Tahmin formu gönderildi.");
        console.log("Oyun aşaması:", rushPhase);

        const distanceInput =
            document.getElementById("guess-distance");

        const timeInput =
            document.getElementById("guess-time");

        const distance = Number(distanceInput.value);
        const time = Number(timeInput.value);

        if (
            !Number.isFinite(distance) ||
            !Number.isFinite(time) ||
            distance <= 0 ||
            time <= 0
        ) {
            alert("Lütfen geçerli mesafe ve süre gir.");
            return;
        }

        if (rushPhase !== "guess") {
            console.error(
                "Oyun tahmin aşamasında değil:",
                rushPhase
            );
            alert("Oyun aşaması hatası: " + rushPhase);
            return;
        }

        playerGuess = {
            distance: distance,
            time: time
        };

        console.log("Kaydedilen tahmin:", playerGuess);

        // Close estimation screen
        const overlay = document.getElementById(
            "guess-overlay"
        );

        overlay.hidden = true;
        overlay.style.display = "none";

        // Reset page scrolling
        document.body.style.overflow = "";

        // Hide mobile keyboard
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        try {

            // Start playable route
            await launchRushRoute();

            if (rushPhase !== "playing") {
                throw new Error(
                    "Oyun başlatılamadı. Aşama: " + rushPhase
                );
            }

            // Make Leaflet recalculate map size
            setTimeout(() => {

                window.gameMap.invalidateSize();

                // Center on player
                window.gameMap.setView(
                    rushRoute[currentRouteIndex],
                    17
                );

                // Move mobile screen to map
                document.querySelector(
                    ".map-game-area"
                ).scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });

            }, 250);

            console.log("Oyun başarıyla başladı!");

        } catch (error) {

            console.error(
                "Manifest Rush başlatma hatası:",
                error
            );

            alert(
                "Oyun başlatılırken bir hata oluştu.\n" +
                error.message
            );
        }
    });
}



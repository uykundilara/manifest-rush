
/* ==========================================
   MANIFEST RUSH: CATCH THE CONCERT
   LEVEL 01 - THE FIRST CONCERT
   REAL ROUTE + QUIZ + SCORING + MISSIONS
========================================== */

// ==========================================
// 1. GAME SETTINGS
// ==========================================

const rushStart = [40.9923, 29.0920];
const rushDestination = [40.99757, 29.09937];

const PREVIEW_SECONDS = 20;
const QUIZ_FRACTIONS = [0.35, 0.70];

const RUSH_VIDEO_PATH =
    "assets/videos/istanbul-concert.mp4";

// ==========================================
// 2. MANIFEST QUESTIONS
// ==========================================

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

// ==========================================
// 3. GAME STATE
// ==========================================

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
let rushMotionTimer = null;

let playerGuess = {
    distance: null,
    time: null
};

// ==========================================
// 4. HELPERS
// ==========================================

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

// ==========================================
// 5. DYNAMIC MISSION SYSTEM
// ==========================================

const rushMissions = {
    1: {
        text: "EKRANDAKİ YILDIZA TIKLA",
        icon: "⭐",
        progress: "25%"
    },

    2: {
        text: "20 SANİYE İNCELE, MESAFE VE YÜRÜME SÜRESİNİ TAHMİN ET",
        icon: "🗺️",
        progress: "50%"
    },

    3: {
        text: "ROTADA İLERLE, YILDIZ SORULARINI CEVAPLA",
        icon: "🎯",
        progress: "75%"
    },

    4: {
        text: "KONSER ALANINA ULAŞ VE PUANINI GÖR",
        icon: "🎤",
        progress: "100%"
    }
};

function updateMission(step) {

    const text = rushElement("mission-text");
    const icon = rushElement("mission-icon");
    const progress = rushElement("mission-progress-fill");

    if (!text || !icon || !progress) return;

    const mission = rushMissions[step];

    if (!mission) return;

    text.textContent = mission.text;
    icon.textContent = mission.icon;
    progress.style.width = mission.progress;
}

// Initial mission

function initializeRushMission() {
    updateMission(1);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initializeRushMission,
        { once: true }
    );
} else {
    initializeRushMission();
}

// ==========================================
// 6. DECODE VALHALLA POLYLINE
// ==========================================

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

// ==========================================
// 7. GET REAL PEDESTRIAN ROUTE
// ==========================================

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

// ==========================================
// 8. CREATE MOVEMENT POINTS
// ==========================================

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

// ==========================================
// 9. SELECTED CHARACTER ICON
// ==========================================

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

// ==========================================
// 10. MOVEMENT CONTROLS
// ==========================================

function setRushControls(visible) {

    rushElement("movement-controls")
        ?.classList.toggle("visible", visible);
}

// ==========================================
// 11. REMOVE MAP OBJECTS
// ==========================================

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

        if (layer) {
            map.removeLayer(layer);
        }
    });

    rushPlayerMarker = null;
    rushRouteLine = null;
    rushProgressLine = null;
    rushDestinationMarker = null;
    rushStartMarker = null;

    rushQuizMarkers = [];
}

// ==========================================
// 12. START LEVEL / MAP PREVIEW
// ==========================================

async function startRushLevel() {

    if (
        rushPhase === "playing" ||
        rushPhase === "quiz"
    ) {
        rushMap().flyTo(
            rushRoute[currentRouteIndex],
            17
        );

        return;
    }

    if (rushPhase !== "idle") return;

    rushPhase = "loading";

    setRushControls(false);

    try {

        rushRouteData = await getRealWalkingRoute();

        const map = rushMap();

        // Show route

        rushRouteLine = L.polyline(
            rushRouteData.coordinates,
            {
                color: rushColor(),
                weight: 7,
                opacity: 0.9
            }
        ).addTo(map);

        // Start marker

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
            "START",
            {
                permanent: true,
                direction: "top",
                offset: [0, -8],
                className: "rush-small-tooltip"
            }
        );

        // Destination marker

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
            "JJ ARENA",
            {
                permanent: true,
                direction: "top",
                offset: [0, -8],
                className: "rush-small-tooltip"
            }
        );

        map.fitBounds(
            rushRouteLine.getBounds(),
            {
                padding: [65, 65],
                maxZoom: 16
            }
        );

        // Preview begins successfully

        rushPhase = "preview";

        // AUTOMATIC MISSION 2
        updateMission(2);

        const panel = rushElement(
            "map-preview-panel"
        );

        if (panel) {
            panel.hidden = false;
        }

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

        console.error(
            "Rota yükleme hatası:",
            error
        );

        rushPhase = "idle";

        // Return to first mission on error
        updateMission(1);

        alert(
            "Gerçek yürüyüş rotası yüklenemedi. " +
            "İnternet bağlantını ve Console bölümünü kontrol et."
        );
    }
}

// ==========================================
// 13. FINISH MAP PREVIEW
// ==========================================

function finishMapPreview() {

    if (rushPhase !== "preview") return;

    if (previewInterval !== null) {

        clearInterval(previewInterval);
        previewInterval = null;
    }

    rushPhase = "guess";

    const previewPanel = rushElement(
        "map-preview-panel"
    );

    const guessOverlay = rushElement(
        "guess-overlay"
    );

    if (previewPanel) {
        previewPanel.hidden = true;
    }

    if (guessOverlay) {

        guessOverlay.hidden = false;
        guessOverlay.style.display = "flex";

        document.body.style.overflow = "hidden";

        const distanceInput = rushElement(
            "guess-distance"
        );

        if (distanceInput) {
            distanceInput.value = "";
        }

        console.log("Estimation screen opened!");

    } else {

        console.error(
            "guess-overlay bulunamadı!"
        );
    }
}

// ==========================================
// 14. FIND QUIZ POSITIONS
// ==========================================

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

// ==========================================
// 15. CREATE QUIZ STARS
// ==========================================

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

// ==========================================
// 16. LAUNCH WALKING ROUTE
// ==========================================

async function launchRushRoute() {

    if (
        rushPhase !== "guess" ||
        !rushRouteData
    ) {
        return;
    }

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

    // Orange completed route

    rushProgressLine = L.polyline(
        [rushRoute[0]],
        {
            color: "#FF8C00",
            weight: 7
        }
    ).addTo(map);

    // Player marker

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

// ==========================================
// 17. MOVE PLAYER
// ==========================================

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

// ==========================================
// 18. OPEN QUIZ
// ==========================================

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

// ==========================================
// 19. CHECK QUIZ ANSWER
// ==========================================

function answerRushQuiz(index, chosen) {

    if (
        rushPhase !== "quiz" ||
        rushQuizAnswered[index] ||
        index !== activeQuiz
    ) {
        return;
    }

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

// ==========================================
// 20. ESTIMATION SCORING
// ±100 METERS / ±2 MINUTES
// ==========================================

function scoreRushEstimates() {

    const distanceError = Math.abs(
        playerGuess.distance - rushRouteData.distance
    );

    const timeError = Math.abs(
        playerGuess.time - rushRouteData.time
    );

    const distancePoints =
        distanceError <= 100 ? 100 : 0;

    const timePoints =
        timeError <= 2 ? 100 : 0;

    const quizPoints = rushQuizPoints;

    const totalPoints =
        distancePoints + timePoints + quizPoints;

    return {
        distanceError,
        timeError,
        distancePoints,
        timePoints,
        quizPoints,
        totalPoints
    };
}


/* ==========================================
   COMPLETE LEVEL + SAVE SCORE TO SUPABASE
========================================== */

function completeRushLevel() {

    if (rushPhase !== "playing") return;

    rushPhase = "completed";

    updateMission(4);

    stopRushMotion();
    setRushControls(false);

    // Calculate final score
    const result = scoreRushEstimates();

    // Update score on screen
    rushElement("score").textContent =
        String(result.totalPoints);

    // Save score to Supabase
    if (window.ManifestAccount?.saveScore) {

        window.ManifestAccount
            .saveScore(1, result.totalPoints)
            .then(() => {
                console.log(
                    "✅ Score saved to Supabase:",
                    result.totalPoints
                );
            })
            .catch(error => {
                console.error(
                    "❌ Score could not be saved:",
                    error
                );
            });

    } else {
        console.error(
            "ManifestAccount.saveScore is unavailable."
        );
    }

    // Show concert video
    showRushConcertVideo(
        () => showRushResults(result)
    );
}


// ==========================================
// 22. CONCERT VIDEO - 14 SECONDS
// ==========================================

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
        "Tebrikler! Manifest'in ilk konserine yetiştin!";

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

        if (video.currentTime >= 14) {
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

// ==========================================
// 23. FINAL RESULTS SCREEN
// ==========================================

function showRushResults(result) {

    rushElement("rush-results")?.remove();

    const overlay = document.createElement("div");

    overlay.id = "rush-results";
    overlay.className = "game-overlay";

    const panel = document.createElement("div");

    panel.className = "rush-results-panel";

    const distanceGuess =
        playerGuess.distance.toFixed(0);

    const distanceActual =
        rushRouteData.distance.toFixed(0);

    const timeGuess =
        playerGuess.time.toFixed(1);

    const timeActual =
        rushRouteData.time.toFixed(1);

    const correctAnswers =
        rushQuizPoints / 100;

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

        <button
            id="rush-back-map"
            class="rush-back-button">
            NEXT LEVEL → LEVEL 02
        </button>

        <p class="rush-result-note">
            Yürüme süresi, rota servisinin tahmini değeridir.
        </p>
    `;

    overlay.appendChild(panel);

    document.body.appendChild(overlay);

    rushElement("rush-back-map")
        .addEventListener("click", () => {

            overlay.remove();

            const ankara = concertCities.ankara;

            window.gameMap.invalidateSize();

            window.gameMap.flyTo(
                ankara.coordinates,
                11
            );

            cityMarkers.ankara
                .bindPopup(`
                    <h3>🎤 LEVEL 02 — ANKARA</h3>
                    <p>COMING SOON!</p>
                    <p>Next concert mission is being prepared.</p>
                `)
                .openPopup();
        });
}

// ==========================================
// 24. STOP PLAYER MOVEMENT
// ==========================================

function stopRushMotion() {

    if (rushMotionTimer !== null) {

        clearInterval(rushMotionTimer);
        rushMotionTimer = null;
    }
}

// ==========================================
// 25. HOLD TO MOVE
// ==========================================

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

// ==========================================
// 26. MOBILE BUTTON CONTROLS
// ==========================================

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

// Hide unused movement buttons

["move-left", "move-right"].forEach(id => {

    const button = rushElement(id);

    if (button) {
        button.hidden = true;
    }
});

// Connect buttons

bindRushControl("move-up", "forward");
bindRushControl("move-down", "backward");

// ==========================================
// 27. KEYBOARD MOVEMENT
// ==========================================

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

// ==========================================
// 28. CONTINUE AFTER QUIZ
// ==========================================

rushElement("quiz-continue")
    ?.addEventListener("click", () => {

        if (
            rushPhase !== "quiz" ||
            !rushQuizAnswered[activeQuiz]
        ) {
            return;
        }

        rushElement("quiz-overlay").hidden = true;

        activeQuiz = -1;

        rushPhase = "playing";
    });

// ==========================================
// 29. DISTANCE / TIME GUESS FORM
// ==========================================

const rushGuessForm = rushElement("guess-form");

if (rushGuessForm) {

    rushGuessForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            console.log(
                "Tahmin formu gönderildi."
            );

            console.log(
                "Oyun aşaması:",
                rushPhase
            );

            const distanceInput =
                rushElement("guess-distance");

            const timeInput =
                rushElement("guess-time");

            const distance = Number(
                distanceInput.value
            );

            const time = Number(
                timeInput.value
            );

            if (
                !Number.isFinite(distance) ||
                !Number.isFinite(time) ||
                distance <= 0 ||
                time <= 0
            ) {
                alert(
                    "Lütfen geçerli mesafe ve süre gir."
                );

                return;
            }

            if (rushPhase !== "guess") {

                console.error(
                    "Oyun tahmin aşamasında değil:",
                    rushPhase
                );

                alert(
                    "Oyun aşaması hatası: " + rushPhase
                );

                return;
            }

            playerGuess = {
                distance,
                time
            };

            console.log(
                "Kaydedilen tahmin:",
                playerGuess
            );

            // Hide estimation overlay

            const overlay =
                rushElement("guess-overlay");

            overlay.hidden = true;
            overlay.style.display = "none";

            document.body.style.overflow = "";

            // Hide mobile keyboard

            if (
                document.activeElement
                instanceof HTMLElement
            ) {
                document.activeElement.blur();
            }

            try {

                // Launch playable route

                await launchRushRoute();

                if (rushPhase !== "playing") {
                    throw new Error(
                        "Oyun başlatılamadı. Aşama: " +
                        rushPhase
                    );
                }

                // Recalculate Leaflet dimensions

                setTimeout(() => {

                    window.gameMap.invalidateSize();

                    window.gameMap.setView(
                        rushRoute[currentRouteIndex],
                        17
                    );

                }, 250);

                // AUTOMATIC MISSION 3
                updateMission(3);

                console.log(
                    "Oyun başarıyla başladı!"
                );

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
        }
    );
}

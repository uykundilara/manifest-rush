
/* ==========================================
   MANIFEST RUSH: CATCH THE CONCERT
   LEVEL 01 - JJ ARENA
   LEVEL 02 - MANIFESTIVAL / LIFE PARK
   LEVEL 03 - HARBİYE AÇIKHAVA
========================================== */

// ==========================================
// GAME SETTINGS
// ==========================================

const PREVIEW_SECONDS = 20;
const QUIZ_FRACTIONS = [0.35, 0.70];

const rushLevels = {
    1: {
        title: "The First Concert",
        event: "THE FIRST CONCERT",
        venue: "JJ ARENA",
        location: "İstanbul",
        date: "16 FEBRUARY 2025",
        start: [40.9923, 29.0920],
        destination: [40.99757, 29.09937],
        video: "assets/videos/istanbul-concert.mp4",
        questions: [
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
        ]
    },

    2: {
        title: "Manifestival",
        event: "MANIFESTIVAL",
        venue: "LIFE PARK",
        location: "Sarıyer · İstanbul",
        date: "28 JUNE 2025",
        start: [41.175903, 28.990302],
        destination: [41.167901, 29.000627],
        video: "assets/videos/manifestival-lifepark.mp4",
        questions: [
            {
                question: "Manifest grubu hangi yarışma programıyla kuruldu?",
                options: [
                    "O Ses Türkiye",
                    "Big5 Türkiye",
                    "Popstar",
                    "X Factor"
                ],
                correct: 1
            },
            {
                question: "Manifest'in ilk çıkış şarkısı hangisidir?",
                options: [
                    "Zamansızdık",
                    "Arıyo",
                    "Snap",
                    "KTS"
                ],
                correct: 0
            }
        ]
    },

    3: {
        title: "Harbiye Open Air",
        event: "MANIFEST AT HARBİYE",
        venue: "HARBİYE CEMİL TOPUZLU AÇIKHAVA TİYATROSU",
        location: "Şişli · İstanbul",
        date: "19 JULY 2025",
        start: [41.0538, 28.9872],
        destination: [41.04613, 28.99005],
        video: "assets/videos/manifest-harbiye.mp4",
        questions: [
            {
                question: "Manifest ilk kez Harbiye Açıkhava'da hangi tarihte sahne aldı?",
                options: [
                    "19 Temmuz 2025",
                    "28 Haziran 2025",
                    "16 Şubat 2025",
                    "19 Ağustos 2025"
                ],
                correct: 0
            },
            {
                question: "Manifest'in oyunumuzdaki ilk konseri hangi mekândaydı?",
                options: [
                    "Life Park",
                    "JJ Arena",
                    "Harbiye Açıkhava",
                    "Volkswagen Arena"
                ],
                correct: 1
            }
        ]
    }
};

// ==========================================
// CURRENT LEVEL
// ==========================================

let rushLevelId = 1;
let rushStart = [...rushLevels[1].start];
let rushDestination = [...rushLevels[1].destination];
let RUSH_VIDEO_PATH = rushLevels[1].video;
let rushQuestions = rushLevels[1].questions;

let rushNextLevelStar = null;

// ==========================================
// GAME STATE
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
// HELPERS
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
// DYNAMIC MISSION SYSTEM
// ==========================================

function updateMission(step) {
    const text = rushElement("mission-text");
    const icon = rushElement("mission-icon");
    const progress = rushElement("mission-progress-fill");

    if (!text || !icon || !progress) return;

    const missions = {
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

    const mission = missions[step];

    if (!mission) return;

    text.textContent = mission.text;
    icon.textContent = mission.icon;
    progress.style.width = mission.progress;
}

// ==========================================
// STOP MOVEMENT
// ==========================================

function stopRushMotion() {
    if (rushMotionTimer !== null) {
        clearInterval(rushMotionTimer);
        rushMotionTimer = null;
    }
}

// ==========================================
// REMOVE OLD MAP OBJECTS
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
        if (layer && map.hasLayer(layer)) {
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
// PREPARE NEXT LEVEL
// ==========================================

function prepareRushLevel(levelId) {
    const level = rushLevels[levelId];
    if (!level) return;

    stopRushMotion();

    if (previewInterval !== null) {
        clearInterval(previewInterval);
        previewInterval = null;
    }

    removeRushLayers();

    if (rushNextLevelStar) {
        rushMap().removeLayer(rushNextLevelStar);
        rushNextLevelStar = null;
    }

    rushPhase = "idle";
    rushLevelId = levelId;

    rushStart = [...level.start];
    rushDestination = [...level.destination];
    RUSH_VIDEO_PATH = level.video;
    rushQuestions = level.questions;

    rushRoute = [];
    rushRouteData = null;
    currentRouteIndex = 0;

    rushQuizIndexes = [];
    rushQuizAnswered = [false, false];
    rushQuizPoints = 0;
    activeQuiz = -1;

    playerGuess = {
        distance: null,
        time: null
    };

    const heading =
        document.querySelector("#tour-screen .game-level-title") ||
        document.querySelector("#tour-screen .game-sidebar h3");

    if (heading) {
        heading.textContent = `LEVEL ${levelId} - ${level.title}`;
    }

    const score = rushElement("score");

    if (score) score.textContent = "0";

    rushElement("map-preview-panel")?.setAttribute("hidden", "");
    rushElement("quiz-overlay")?.setAttribute("hidden", "");

    setRushControls(false);
    updateMission(1);
}

// ==========================================
// CREATE NEXT LEVEL STAR
// ==========================================

function showRushNextLevelStar(levelId) {
    const level = rushLevels[levelId];
    if (!level) return;

    const map = rushMap();

    if (rushNextLevelStar) {
        map.removeLayer(rushNextLevelStar);
    }

    rushNextLevelStar = L.marker(
        level.destination,
        {
            icon: L.divIcon({
                className: "rush-next-level-star-marker",
                html: `
                    <div style="
                        display:grid;
                        place-items:center;
                        width:52px;
                        height:52px;
                        border:3px solid white;
                        border-radius:50%;
                        background:#ff42ad;
                        color:white;
                        font-size:30px;
                        box-shadow:0 0 20px #ff42ad;
                    ">★</div>
                `,
                iconSize: [52, 52],
                iconAnchor: [26, 26]
            }),
            zIndexOffset: 1200
        }
    ).addTo(map);

    rushNextLevelStar.bindTooltip(
        `LEVEL ${String(levelId).padStart(2, "0")} · ${level.venue}`,
        {
            permanent: true,
            direction: "top",
            offset: [0, -18],
            className: "rush-small-tooltip"
        }
    );

    rushNextLevelStar.on("click", () => {
        map.removeLayer(rushNextLevelStar);
        rushNextLevelStar = null;

        startRushLevel();
    });

    map.invalidateSize();
    map.flyTo(level.destination, 14);
}

// ==========================================
// DECODE VALHALLA POLYLINE
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
// GET REAL WALKING ROUTE
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
    const distanceKm = Number(data.trip?.summary?.length);
    const durationSeconds = Number(data.trip?.summary?.time);

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
// CREATE MOVEMENT POINTS
// ==========================================

function createMovementPoints(coordinates, stepMeters = 12) {
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
// CHARACTER ICON
// ==========================================

function createRushPlayerIcon() {
    const id = localStorage.getItem("manifestCharacter");

    const character =
        (typeof characters !== "undefined" && characters[id]) ||
        (typeof characters !== "undefined" && characters.zoktay);

    const image = character?.image || "";
    const name = character?.name || "Oyuncu";
    const color = character?.color || rushColor();

    return L.divIcon({
        className: "player-marker",
        html: `
            <div class="rush-avatar" style="--player-color:${color}">
                <img src="${image}" alt="${name}">
            </div>
        `,
        iconSize: [54, 54],
        iconAnchor: [27, 27]
    });
}

// ==========================================
// MOVEMENT CONTROLS
// ==========================================

function setRushControls(visible) {
    rushElement("movement-controls")
        ?.classList.toggle("visible", visible);
}

// ==========================================
// START LEVEL
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
            "START",
            {
                permanent: true,
                direction: "top",
                offset: [0, -8],
                className: "rush-small-tooltip"
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
            rushLevels[rushLevelId].venue,
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

        rushPhase = "preview";
        updateMission(2);

        const panel = rushElement("map-preview-panel");

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
        updateMission(1);
        removeRushLayers();

        alert(
            "Gerçek yürüyüş rotası yüklenemedi. " +
            "İnternet bağlantını ve Console bölümünü kontrol et."
        );
    }
}

// ==========================================
// FINISH PREVIEW
// ==========================================

function finishMapPreview() {
    if (rushPhase !== "preview") return;

    if (previewInterval !== null) {
        clearInterval(previewInterval);
        previewInterval = null;
    }

    rushPhase = "guess";

    const previewPanel = rushElement("map-preview-panel");
    const guessOverlay = rushElement("guess-overlay");

    if (previewPanel) {
        previewPanel.hidden = true;
    }

    if (guessOverlay) {
        guessOverlay.hidden = false;
        guessOverlay.style.display = "flex";

        document.body.style.overflow = "hidden";

        const distanceInput = rushElement("guess-distance");
        const timeInput = rushElement("guess-time");

        if (distanceInput) distanceInput.value = "";
        if (timeInput) timeInput.value = "";

        console.log("Estimation screen opened!");
    } else {
        console.error("guess-overlay bulunamadı!");
    }
}

// ==========================================
// FIND QUIZ POSITIONS
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
// CREATE QUIZ STARS
// ==========================================

function createRushQuizStars() {
    rushQuizIndexes = findRushQuizIndexes(rushRoute);

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
// LAUNCH WALKING GAME
// ==========================================

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
            color: "#FF8C00",
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

    const score = rushElement("score");

    if (score) {
        score.textContent = "0";
    }

    updateMission(3);
}

// ==========================================
// MOVE PLAYER
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

    if (currentRouteIndex === rushRoute.length - 1) {
        completeRushLevel();
    }
}

// ==========================================
// OPEN QUIZ
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
            const button = document.createElement("button");

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
// CHECK QUIZ ANSWER
// ==========================================

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

    const feedback = rushElement("quiz-feedback");

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
// SCORING
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

// ==========================================
// COMPLETE LEVEL + SUPABASE SAVE
// ==========================================

function completeRushLevel() {
    if (rushPhase !== "playing") return;

    rushPhase = "completed";

    updateMission(4);

    stopRushMotion();
    setRushControls(false);

    const result = scoreRushEstimates();

    rushElement("score").textContent =
        String(result.totalPoints);

    if (window.ManifestAccount?.saveScore) {
        window.ManifestAccount
            .saveScore(rushLevelId, result.totalPoints)
            .then(() => {
                console.log(
                    `✅ LEVEL ${rushLevelId} puanı kaydedildi:`,
                    result.totalPoints
                );
            })
            .catch(error => {
                console.error(
                    "❌ Puan kaydedilemedi:",
                    error
                );
            });
    } else {
        console.warn(
            "ManifestAccount.saveScore bulunamadı."
        );
    }

    showRushConcertVideo(
        () => showRushResults(result)
    );
}

// ==========================================
// CONCERT VIDEO
// ==========================================

function showRushConcertVideo(onFinish) {
    const level = rushLevels[rushLevelId];

    const overlay = document.createElement("div");
    overlay.className = "game-overlay";
    overlay.id = "rush-video-overlay";

    const panel = document.createElement("div");
    panel.className = "guess-panel";

    const heading = document.createElement("h2");
    heading.textContent = `🎤 ${level.event}!`;

    const message = document.createElement("p");

    message.textContent =
        `${level.venue} alanına ulaştın! ` +
        "Tebrikler, konsere yetiştin!";

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
                "Video açılamadı. Sonuçlara geçebilirsin.";
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
            `Video bulunamadı: ${RUSH_VIDEO_PATH}. ` +
            "SONUÇLARI GÖR ile devam edebilirsin.";
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
// RESULTS SCREEN
// ==========================================

function showRushResults(result) {
    rushElement("rush-results")?.remove();

    const level = rushLevels[rushLevelId];

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
                LEVEL ${String(rushLevelId).padStart(2, "0")}
                — ${level.event}
            </p>

            <h2>YOU MADE IT!</h2>

            <p class="rush-location">
                ${level.venue} · ${level.location}
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
            ${
                rushLevelId < 3
                    ? `NEXT LEVEL → LEVEL 0${rushLevelId + 1}`
                    : "HARİTAYA DÖN"
            }
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

            if (rushLevelId < 3) {
                const nextLevelId = rushLevelId + 1;

                prepareRushLevel(nextLevelId);
                showRushNextLevelStar(nextLevelId);
            } else {
                rushMap().invalidateSize();
                rushMap().flyTo(
                    rushLevels[3].destination,
                    14
                );
            }
        });
}

// ==========================================
// HOLD TO MOVE
// ==========================================

function holdRushMotion(direction) {
    stopRushMotion();

    if (rushPhase !== "playing") return;

    moveRushPlayer(direction);

    if (rushPhase !== "playing") return;

    rushMotionTimer = setInterval(() => {
        if (rushPhase !== "playing") {
            stopRushMotion();
            return;
        }

        moveRushPlayer(direction);
    }, 95);
}

// ==========================================
// MOBILE MOVEMENT BUTTONS
// ==========================================

function bindRushControl(id, direction) {
    const button = rushElement(id);

    if (!button) return;

    button.addEventListener("pointerdown", event => {
        event.preventDefault();

        button.setPointerCapture?.(
            event.pointerId
        );

        holdRushMotion(direction);
    });

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

["move-left", "move-right"].forEach(id => {
    const button = rushElement(id);

    if (button) button.hidden = true;
});

bindRushControl("move-up", "forward");
bindRushControl("move-down", "backward");

// ==========================================
// KEYBOARD MOVEMENT
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
// CONTINUE AFTER QUIZ
// ==========================================

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

// ==========================================
// DISTANCE AND TIME GUESS FORM
// ==========================================

const rushGuessForm = rushElement("guess-form");

if (rushGuessForm) {
    rushGuessForm.addEventListener(
        "submit",
        async event => {
            event.preventDefault();

            const distanceInput =
                rushElement("guess-distance");

            const timeInput =
                rushElement("guess-time");

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
                alert(
                    "Oyun aşaması hatası: " + rushPhase
                );
                return;
            }

            playerGuess = {
                distance,
                time
            };

            const overlay = rushElement("guess-overlay");

            overlay.hidden = true;
            overlay.style.display = "none";

            document.body.style.overflow = "";

            if (
                document.activeElement
                instanceof HTMLElement
            ) {
                document.activeElement.blur();
            }

            try {
                await launchRushRoute();

                if (rushPhase !== "playing") {
                    throw new Error(
                        "Oyun başlatılamadı. Aşama: " +
                        rushPhase
                    );
                }

                setTimeout(() => {
                    const map = rushMap();

                    map.invalidateSize();

                    map.setView(
                        rushRoute[currentRouteIndex],
                        17
                    );
                }, 250);

                updateMission(3);

                console.log(
                    `✅ LEVEL ${rushLevelId} başladı.`
                );

            } catch (error) {
                console.error(
                    "Oyun başlatma hatası:",
                    error
                );

                alert(
                    "Oyun başlatılırken hata oluştu:\n" +
                    error.message
                );
            }
        }
    );
}

// ==========================================
// INITIAL MISSION
// ==========================================

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

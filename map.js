
/* =========================================
   MANIFEST WORLD TOUR
   Interactive Tour Map - Leaflet & OSM
========================================= */

// 1. CONCERT CITIES

const concertCities = {
    istanbul: {
        name: "İstanbul",
        coordinates: [41.0082, 28.9784],
        concert: "Istanbul Opening Concert",
        unlocked: true,
        completed: false
    },

    ankara: {
        name: "Ankara",
        coordinates: [39.9334, 32.8597],
        concert: "Ankara Concert",
        unlocked: false,
        completed: false
    },

    izmir: {
        name: "İzmir",
        coordinates: [38.4237, 27.1428],
        concert: "Izmir Concert",
        unlocked: false,
        completed: false
    }
};

// 2. CREATE MAP

const map = L.map("map", {
    center: [39.2, 32],
    zoom: 6,
    zoomControl: true
});

// Make map accessible from script.js
window.gameMap = map;

// 3. OPENSTREETMAP BASE LAYER

L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }
).addTo(map);

// 4. CITY MARKER STYLE

function createCityIcon(city) {

    const color = city.unlocked
        ? "#ff4fc3"
        : "#77717f";

    const symbol = city.unlocked
        ? "★"
        : "🔒";

    return L.divIcon({
        className: "custom-city-icon",

        html: `
            <div style="
                background: ${color};
                width: 44px;
                height: 44px;
                border-radius: 50%;
                border: 3px solid white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 21px;
                box-shadow: 0 0 20px ${color};
            ">
                ${symbol}
            </div>
        `,

        iconSize: [44, 44],
        iconAnchor: [22, 22]
    });
}

// 5. ADD CITY MARKERS

const cityMarkers = {};

Object.entries(concertCities).forEach(
    ([cityId, city]) => {

        const marker = L.marker(
            city.coordinates,
            { icon: createCityIcon(city) }
        ).addTo(map);

        cityMarkers[cityId] = marker;

        marker.on("click", () => {
            selectConcertCity(cityId);
        });
    }
);

// 6. SELECT A CONCERT CITY


function selectConcertCity(cityId) {
    const city = concertCities[cityId];

    if (!city) return;

    if (!city.unlocked) {
        map.flyTo(city.coordinates, 10);

        cityMarkers[cityId].bindPopup(`
            <h3>🔒 ${city.name}</h3>
            <p>Complete the previous concert!</p>
        `).openPopup();

        return;
    }

    // Start the Istanbul playable level
    if (cityId === "istanbul") {
        startRushLevel();
        return;
    }

    map.flyTo(city.coordinates, 12);
}


// 7. CONNECT SIDEBAR BUTTONS

document.querySelectorAll("[data-city]").forEach(
    button => {

        button.addEventListener("click", () => {
            const cityId = button.dataset.city;

            selectConcertCity(cityId);
        });

    }
);

// 8. UPDATE MAP AFTER SCREEN CHANGE

function refreshGameMap() {

    setTimeout(() => {
        map.invalidateSize();
    }, 200);

}

// 9. INITIAL VIEW

window.addEventListener("load", () => {
    refreshGameMap();
});


window.addEventListener("resize", () => {
    if (window.gameMap) {
        window.gameMap.invalidateSize();
    }
});


/* =========================================
   MANIFEST WORLD TOUR
   Main Game Navigation & Character Selection
========================================= */

// 1. CHARACTERS

const characters = {
    zoktay: {
        name: "ZOKTAY",
        color: "#3498ff",
        image: "assets/characters/zoktay.jpg"
    },
    esin: {
        name: "ESİN",
        color: "#ffd633",
        image: "assets/characters/esin.jpg"
    },
    mina: {
        name: "MİNA",
        color: "#ff3556",
        image: "assets/characters/mina.jpg"
    },
    lidya: {
        name: "LİDYA",
        color: "#ff75bc",
        image: "assets/characters/lidya.jpg"
    },
    sueda: {
        name: "SUEDA",
        color: "#39d98a",
        image: "assets/characters/sueda.jpg"
    },
    hilal: {
        name: "HİLAL",
        color: "#a66cff",
        image: "assets/characters/hilal.jpg"
    }
};

// 2. GAME VARIABLES

let selectedCharacter = null;

// 3. HTML ELEMENTS

const startButton = document.getElementById("start-btn");
const backButton = document.getElementById("back-home");

const characterCards = document.querySelectorAll(
    ".character-card"
);

const confirmButton = document.getElementById(
    "confirm-character"
);

const selectedName = document.getElementById(
    "selected-name"
);

// 4. SCREEN NAVIGATION

function showScreen(screenId) {

    document.querySelectorAll(".screen").forEach(screen => {
        screen.classList.remove("active");
    });

    document.getElementById(screenId).classList.add("active");

    // Resize Leaflet map after opening the map screen
    if (screenId === "tour-screen") {
        setTimeout(() => {
            if (window.gameMap) {
                window.gameMap.invalidateSize();
            }
        }, 150);
    }
}

// 5. START GAME

startButton.addEventListener("click", () => {
    showScreen("character-screen");
});

// 6. BACK TO HOME

backButton.addEventListener("click", () => {
    showScreen("home-screen");
});

// 7. CHARACTER SELECTION

characterCards.forEach(card => {

    card.addEventListener("click", () => {

        // Remove previous selection
        characterCards.forEach(item => {
            item.classList.remove("selected");
        });

        // Select clicked character
        card.classList.add("selected");

        const characterId = card.dataset.character;

        selectedCharacter = characters[characterId];

        selectedName.textContent =
            "YOU SELECTED: " + selectedCharacter.name;

        selectedName.style.color = selectedCharacter.color;

        confirmButton.disabled = false;

    });

});

// 8. CONFIRM CHARACTER

confirmButton.addEventListener("click", () => {

    if (!selectedCharacter) {
        alert("Please select a character!");
        return;
    }

    // Save chosen character
    const characterId = Object.keys(characters).find(
        id => characters[id] === selectedCharacter
    );

    localStorage.setItem(
        "manifestCharacter",
        characterId
    );

    // Update game profile
    const playerAvatar = document.getElementById(
        "player-avatar"
    );

    const playerName = document.getElementById(
        "player-name"
    );

    playerAvatar.src = selectedCharacter.image;
    playerName.textContent = selectedCharacter.name;
    playerName.style.color = selectedCharacter.color;
    
// Apply selected character's color to game UI
document.documentElement.style.setProperty(
    "--player-color",
    selectedCharacter.color
);


    // Open the world tour
    showScreen("tour-screen");

});

// 9. HOW TO PLAY

document.getElementById("how-btn").addEventListener(
    "click",
    () => {
        alert(
            "MANIFEST WORLD TOUR\n\n" +
            "1. Choose your Manifest character.\n" +
            "2. Explore concert cities on the map.\n" +
            "3. Plan your routes and manage your budget.\n" +
            "4. Complete missions and earn points!"
        );
    }
);

// 10. RESTORE PREVIOUS CHARACTER

const savedCharacterId = localStorage.getItem(
    "manifestCharacter"
);

if (savedCharacterId && characters[savedCharacterId]) {

    selectedCharacter = characters[savedCharacterId];

    const savedCard = document.querySelector(
        `[data-character="${savedCharacterId}"]`
    );

    if (savedCard) {
        savedCard.classList.add("selected");
    }

    selectedName.textContent =
        "YOU SELECTED: " + selectedCharacter.name;

    selectedName.style.color = selectedCharacter.color;

    confirmButton.disabled = false;
}

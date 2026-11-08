# Manifest Rush: Catch the Concert 🎤🗺️

**GeoGame Design — Initial Game Design Prototype**

Manifest Rush is a browser-based, map-centered adventure game. Players choose one of six Manifest members and navigate a real pedestrian route to reach a concert venue. The first level is themed around Manifest's first concert at JJ Arena, Ataşehir, İstanbul.

> This is an educational, fan-made prototype, not an official Manifest game. Concert photos and videos should only be published with appropriate permissions.

## Game concept

Before moving, players inspect a real pedestrian route for **20 seconds** and estimate its distance (meters) and walking duration (minutes). They then navigate the route, answer two multiple-choice Manifest quizzes at collectible stars, and compare their guesses with routing-service estimates at the finish.

## Gameplay flow

1. Open the main menu and choose a Manifest member.
2. Select **Level 01 — İstanbul: The First Concert**.
3. Inspect the route for 20 seconds (without seeing its length or duration).
4. Enter distance and walking-time guesses.
5. Follow the route using keyboard or mobile controls.
6. Answer the two star questions and earn points for correct answers.
7. Reach JJ Arena and view results; a 15-second concert-video stage is planned/available when a permitted file is supplied.

## Characters and colors

| Character | Theme |
|---|---|
| Zoktay | Blue |
| Esin | Yellow |
| Mina | Red |
| Lidya | Pink |
| Sueda | Green |
| Hilal | Purple |

The selected character's photo and accent color appear in the interface and route styling.

## Scoring

| Challenge | Maximum points |
|---|---:|
| Distance estimation | 100 |
| Walking-time estimation | 100 |
| Quiz question 1 | 100 |
| Quiz question 2 | 100 |
| **Total** | **400** |

Distance estimation: up to 5 m error = 100 points; up to 50 m = 75; up to 150 m = 40; otherwise 0. Walking-time estimation: up to 1 min error = 100; up to 3 min = 50; otherwise 0. Each correct quiz answer awards 100 points. There is **no budget mechanic**.

## Technology

- HTML5, CSS3 and vanilla JavaScript
- Leaflet for interactive maps
- OpenStreetMap for map tiles and geographic data
- Valhalla routing service for pedestrian route geometry and estimated distance/time
- Browser `localStorage` for the selected character
- Git and GitHub for version control; GitHub Pages is planned for publishing

## Project structure

```text
manifest-world-tour/
├── index.html
├── style.css
├── script.js
├── map.js
├── rush.js
├── README.md
└── assets/
    ├── characters/
    │   ├── zoktay.jpg
    │   ├── esin.jpg
    │   ├── mina.jpg
    │   ├── lidya.jpg
    │   ├── sueda.jpg
    │   └── hilal.jpg
    └── videos/
        └── istanbul-concert.mp4  (optional; if licensed)
```

## Run locally

Open the project folder in Visual Studio Code and launch `index.html` using Live Server. Internet access is required for map tiles and the public route service. Public routing endpoints may have usage limits or temporary outages.

## Planned improvements

- More varied question bank and improved game feedback
- Route navigation choices and obstacles
- New city levels
- Better movement animation and accessibility
- Authorized concert video integration

## Design milestone

**9 November 2026:** Initial repository, README, interface prototype, and first commit (to be made on that date).

**Potential final submission:** 23 November 2026 (course deadline to be confirmed).

## Credits and attribution

Map data © OpenStreetMap contributors. Routing uses OpenStreetMap-based road data through Valhalla. This independent educational game concept references the Manifest music group; all artist names, images and media belong to their respective rights holders.

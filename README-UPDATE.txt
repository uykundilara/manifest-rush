MANIFEST RUSH — Desktop + Mobile layout update

These files replace the corresponding files in your EXISTING project folder.
Keep your existing assets/ folder (photos and concert video). Assets are not included here.

Changes:
- Replaced conflicting 3,600+ line style.css with one unified stylesheet.
- Responsive full-screen character selection (3x2 mobile, 6 across desktop).
- Compact Level 01 intro, map, always-open HOW TO PLAY panel on right.
- Compact guess, quiz, video, results overlays with internal scroll fallback.
- Removed automatic scrollIntoView and a duplicated movement handler.
- Updated obsolete Home HOW TO PLAY text.
- Left map.js and index.html structure unchanged.

Test locally on a web server (e.g., VS Code Live Server). The live map depends
on OpenStreetMap and the Valhalla routing endpoint.

Once tested, commit:
  git add index.html style.css script.js map.js rush.js
  git commit -m "Refactor responsive game screens for desktop and mobile"
  git push origin main

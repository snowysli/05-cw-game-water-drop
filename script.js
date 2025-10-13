// --- Drawing lines between rows, snapping to rows ---
let isDrawing = false;
let startPoint = null;
const gameContainer = document.getElementById("game-container");
const drawLayer = document.getElementById("draw-layer");

// Row (vertical line) x positions in px
const rowPercents = [0.2, 0.4, 0.6, 0.8];
function getRowXs() {
  const w = gameContainer.offsetWidth;
  return rowPercents.map(p => w * p);
}
function snapToNearestRowWithIdx(x) {
  const xs = getRowXs();
  let minDist = Infinity, best = xs[0], idx = 0;
  for (let i = 0; i < xs.length; ++i) {
    const d = Math.abs(x - xs[i]);
    if (d < minDist) { minDist = d; best = xs[i]; idx = i; }
  }
  return {x: best, idx};
}

gameContainer.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  isDrawing = true;
  const rect = gameContainer.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  const snap = snapToNearestRowWithIdx(x);
  x = snap.x;
  startPoint = { x, y };
  gameContainer._drawStartRowIdx = snap.idx;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x);
  line.setAttribute("y1", y);
  line.setAttribute("x2", x);
  line.setAttribute("y2", y);
  line.setAttribute("stroke", "#159A48");
  line.setAttribute("stroke-width", "6");
  line.setAttribute("stroke-linecap", "round");
  line.classList.add("user-drawn-line");
  drawLayer.appendChild(line);
  drawLayer._currentLine = line;
  drawLayer._snapStartX = x;
  drawLayer._snapStartIdx = snap.idx;
  drawLayer.style.pointerEvents = "auto";
});

gameContainer.addEventListener("mousemove", (e) => {
  if (!isDrawing || !drawLayer._currentLine) return;
  const rect = gameContainer.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;
  // Snap end to nearest row
  const snap = snapToNearestRowWithIdx(x);
  let valid = false;
  // Only allow connection to immediate neighbor rows
  if (Math.abs(snap.idx - drawLayer._snapStartIdx) === 1) {
    valid = true;
  }
  if (valid) {
    drawLayer._currentLine.setAttribute("x2", snap.x);
    drawLayer._currentLine.setAttribute("y2", y);
    drawLayer._currentLine._valid = true;
    drawLayer._currentLine._snapEndIdx = snap.idx;
  } else {
    // Keep the line at the start row if not valid
    drawLayer._currentLine.setAttribute("x2", drawLayer._snapStartX);
    drawLayer._currentLine.setAttribute("y2", y);
    drawLayer._currentLine._valid = false;
    drawLayer._currentLine._snapEndIdx = null;
  }
});

gameContainer.addEventListener("mouseup", (e) => {
  if (!isDrawing || !drawLayer._currentLine) return;
  // Only keep the line if it connects to an immediate neighbor row
  if (!drawLayer._currentLine._valid) {
    drawLayer.removeChild(drawLayer._currentLine);
  }
  isDrawing = false;
  drawLayer._currentLine = null;
  drawLayer.style.pointerEvents = "none";
});

gameContainer.addEventListener("mouseleave", (e) => {
  if (isDrawing && drawLayer._currentLine) {
    isDrawing = false;
    drawLayer._currentLine = null;
    drawLayer.style.pointerEvents = "none";
  }
});
// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let dropMaker; // Will store our timer that creates drops regularly
// Timer variables removed



// Game speed settings
let dropFallDuration = 4; // seconds

// Menu logic
document.getElementById("menu-easy-btn").addEventListener("click", () => {
  dropFallDuration = 4;
  document.getElementById("menu-overlay").style.display = "none";
  document.getElementById("game-wrapper").style.display = "flex";
});

document.getElementById("menu-hard-btn").addEventListener("click", () => {
  dropFallDuration = 1.5;
  document.getElementById("menu-overlay").style.display = "none";
  document.getElementById("game-wrapper").style.display = "flex";
});

// Wait for button click to start the game (in-game button)
document.getElementById("start-btn").addEventListener("click", startGame);

function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;

  gameRunning = true;

  // Start the first drop
  createDrop();
}


function endGame() {
  gameRunning = false;
  clearInterval(dropMaker);
  // Optionally, you can show a message or reset drops here
}


function createDrop() {
  // Create a new div element that will be our water drop
  const drop = document.createElement("div");
  drop.className = "water-drop";

  // Set drops to a fixed size
  const size = 70;
  drop.style.width = drop.style.height = `${size}px`;

  // Add the water drop image
  const img = document.createElement("img");
  img.src = "./img/water-drop.png";
  img.alt = "Water Drop";
  img.style.width = img.style.height = "100%";
  img.style.display = "block";
  drop.appendChild(img);

  // Four possible line positions (20%, 40%, 60%, 80% of container width)
  const gameWidth = document.getElementById("game-container").offsetWidth;
  const linePercents = [0.2, 0.4, 0.6, 0.8];
  const lineIndex = Math.floor(Math.random() * linePercents.length);
  const centerX = gameWidth * linePercents[lineIndex];
  // Center the drop on the line
  drop.style.left = (centerX - size / 2) + "px";

  // Make drops fall for the current duration
  drop.style.animationDuration = dropFallDuration + "s";

  // Add the new drop to the game screen
  document.getElementById("game-container").appendChild(drop);

  // Remove drops that reach the bottom (weren't clicked)
  drop.addEventListener("animationend", () => {
    drop.remove(); // Clean up drops that weren't caught
    // Only create a new drop if the game is still running
    if (gameRunning) {
      createDrop();
    }
  });
}

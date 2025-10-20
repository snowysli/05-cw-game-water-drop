// --- Drawing lines between rows, snapping to rows ---
let isDrawing = false;
let startPoint = null;
const gameContainer = document.getElementById("game-container");
const drawLayer = document.getElementById("draw-layer");

// --- Sound effects ---
// Place your sound files under `sounds/` (relative to the site root):
// - sounds/point.mp3 -> played when the player scores
// - sounds/game.mp3  -> played when the player touches a ghost
// - sounds/game-over.mp3 -> played when the game ends (already used)
const pointSfx = new Audio('sounds/point.mp3');
pointSfx.preload = 'auto';
pointSfx.volume = 0.9;

const ghostSfx = new Audio('sounds/game.mp3');
ghostSfx.preload = 'auto';
ghostSfx.volume = 0.9;

const gameOverSfx = new Audio('sounds/game-over.mp3');
gameOverSfx.preload = 'auto';
gameOverSfx.volume = 0.9;

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
    if (d < minDist) {
      minDist = d;
      best = xs[i];
      idx = i;
    }
  }
  return { x: best, idx };
}

// Shared drawing helpers (mouse + touch)
function getContainerPoint(clientX, clientY) {
  const rect = gameContainer.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDrawingAt(clientX, clientY) {
  isDrawing = true;
  const pt = getContainerPoint(clientX, clientY);
  let x = pt.x;
  let y = pt.y;
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
  // Store start row index on the SVG line element
  line._snapStartIdx = snap.idx;
  drawLayer.appendChild(line);
  drawLayer._currentLine = line;
  drawLayer._snapStartX = x;
  drawLayer._snapStartIdx = snap.idx;
  drawLayer.style.pointerEvents = "auto";
}

function moveDrawingTo(clientX, clientY) {
  if (!isDrawing || !drawLayer._currentLine) return;
  const pt = getContainerPoint(clientX, clientY);
  let x = pt.x;
  let y = pt.y;
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
    // Store end row index on the SVG line element
    drawLayer._currentLine._snapEndIdx = snap.idx;
  } else {
    // Keep the line at the start row if not valid
    drawLayer._currentLine.setAttribute("x2", drawLayer._snapStartX);
    drawLayer._currentLine.setAttribute("y2", y);
    drawLayer._currentLine._valid = false;
    drawLayer._currentLine._snapEndIdx = null;
  }
}

function endDrawing() {
  if (!isDrawing || !drawLayer._currentLine) return;
  // Only keep the line if it connects to an immediate neighbor row
  if (!drawLayer._currentLine._valid) {
    drawLayer.removeChild(drawLayer._currentLine);
  }
  isDrawing = false;
  drawLayer._currentLine = null;
  drawLayer.style.pointerEvents = "none";
}

// Mouse events
gameContainer.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  startDrawingAt(e.clientX, e.clientY);
});

gameContainer.addEventListener("mousemove", (e) => {
  moveDrawingTo(e.clientX, e.clientY);
});

gameContainer.addEventListener("mouseup", (e) => {
  endDrawing();
});

gameContainer.addEventListener("mouseleave", (e) => {
  if (isDrawing) endDrawing();
});

// Touch events
gameContainer.addEventListener("touchstart", (e) => {
  // Prevent default to avoid scrolling while drawing
  e.preventDefault();
  const t = e.touches[0];
  startDrawingAt(t.clientX, t.clientY);
}, { passive: false });

gameContainer.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const t = e.touches[0];
  moveDrawingTo(t.clientX, t.clientY);
}, { passive: false });

gameContainer.addEventListener("touchend", (e) => {
  // touchend has no touches; use changedTouches
  const t = e.changedTouches && e.changedTouches[0];
  if (t) moveDrawingTo(t.clientX, t.clientY);
  endDrawing();
}, { passive: false });

gameContainer.addEventListener("touchcancel", (e) => {
  endDrawing();
}, { passive: false });

// ------------------- GAME STATE -------------------
let gameRunning = false;
let dropMaker; // Will store our timer that creates drops regularly

// Game speed settings
let dropFallDuration = 4; // seconds
let isEasyMode = true;
let lives = 3;

document.getElementById("lives").textContent = lives;

function randomizeCatchers() {
  // There are 4 positions, 3 ghosts and 1 water can
  const catcherImgs = [
    { src: "img/ghost.png", alt: "Ghost" },
    { src: "img/ghost.png", alt: "Ghost" },
    { src: "img/ghost.png", alt: "Ghost" },
    { src: "img/water-can-transparent.png", alt: "Water Can" }
  ];
  // Shuffle the array
  for (let i = catcherImgs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [catcherImgs[i], catcherImgs[j]] = [catcherImgs[j], catcherImgs[i]];
  }
  // Update the DOM
  const catchers = document.querySelectorAll('.catcher');
  catchers.forEach((catcher, idx) => {
    const img = catcher.querySelector('img');
    img.src = catcherImgs[idx].src;
    img.alt = catcherImgs[idx].alt;
  });
}

document.getElementById("menu-easy-btn").addEventListener("click", () => {
  randomizeCatchers();
  dropFallDuration = 3.5;
  isEasyMode = true;
  lives = 3;
  document.getElementById("lives").textContent = lives;
  document.getElementById("menu-overlay").style.display = "none";
  // Hide the site title when gameplay begins
  const header = document.querySelector('.site-header');
  if (header) header.style.display = 'none';
  // Ensure game container reflects easy mode
  const gc = document.getElementById('game-container');
  if (gc) {
    gc.classList.remove('hard-mode');
    gc.classList.add('easy-mode');
  }
  document.getElementById("game-wrapper").style.display = "flex";
});

document.getElementById("menu-hard-btn").addEventListener("click", () => {
  randomizeCatchers();
  dropFallDuration = 1.5;
  isEasyMode = false;
  lives = 1; 
  document.getElementById("lives").textContent = lives;
  document.getElementById("menu-overlay").style.display = "none";
  // Hide the site title when gameplay begins
  const header = document.querySelector('.site-header');
  if (header) header.style.display = 'none';
  // Mark game container as hard mode
  const gc = document.getElementById('game-container');
  if (gc) {
    gc.classList.remove('easy-mode');
    gc.classList.add('hard-mode');
  }
  document.getElementById("game-wrapper").style.display = "flex";
});

// ------------------- START GAME -------------------
document.getElementById("start-btn").addEventListener("click", startGame);

function startGame() {
  if (gameRunning) return; // prevent multiple starts

  if (isEasyMode) {
    lives = 3;
    document.getElementById("lives").textContent = lives;
  }

  // Hide the site title when gameplay starts
  const header = document.querySelector('.site-header');
  if (header) header.style.display = 'none';

  gameRunning = true;
  createDrop();
}

// ------------------- END GAME -------------------
function endGame() {
  gameRunning = false;
  clearInterval(dropMaker);
}

// ------------------- CREATE DROP -------------------
function createDrop() {
  const drop = document.createElement("div");
  drop.className = "water-drop";

  const size = 60;
  drop.style.width = drop.style.height = `${size}px`;

  const img = document.createElement("img");
  img.src = "./img/water-drop.png";
  img.alt = "Water Drop";
  img.style.width = img.style.height = "100%";
  img.style.display = "block";
  drop.appendChild(img);

  const gameWidth = gameContainer.offsetWidth;
  const linePercents = [0.2, 0.4, 0.6, 0.8];
  let lineIndex = Math.floor(Math.random() * linePercents.length);
  let centerX = gameWidth * linePercents[lineIndex];
  drop.style.left = (centerX - size / 2) + "px";
  drop.dataset.lineIndex = lineIndex;

  // Custom animation: let the drop follow user-drawn lines
  let startY = -20;
  let endY = 600;
  let duration = dropFallDuration * 1000;
  let startTime = null;
  let lastRowIdx = lineIndex;

  // Gather all user-drawn lines (SVG lines)
  function getUserLines() {
    return Array.from(document.querySelectorAll('.user-drawn-line')).map(line => {
      return {
        x1: parseFloat(line.getAttribute('x1')),
        y1: parseFloat(line.getAttribute('y1')),
        x2: parseFloat(line.getAttribute('x2')),
        y2: parseFloat(line.getAttribute('y2')),
        startIdx: line._snapStartIdx,
        endIdx: line._snapEndIdx
      };
    });
  }

  function getRowX(idx) {
    return gameWidth * linePercents[idx];
  }

  function animateDrop(ts) {
    if (!startTime) startTime = ts;
    let elapsed = ts - startTime;
    let progress = Math.min(elapsed / duration, 1);
    let y = startY + (endY - startY) * progress;

    // Get all user-drawn lines
    let userLines = getUserLines();

    // Keep track of whether we’re currently sliding along a line
    if (!drop._sliding) {
      // --- Check if we should start sliding on a line ---
      for (let line of userLines) {
        if (
          (line.startIdx === lastRowIdx && Math.abs(line.endIdx - lastRowIdx) === 1) ||
          (line.endIdx === lastRowIdx && Math.abs(line.startIdx - lastRowIdx) === 1)
        ) {
          const minY = Math.min(line.y1, line.y2);
          const maxY = Math.max(line.y1, line.y2);

          // If drop is at the line’s Y range
          if (y >= minY && y <= maxY) {
            // Start sliding
            drop._sliding = {
              line,
              t: 0, // progress along the line
              startTime: ts
            };
            break;
          }
        }
      }
    }

    let x;

      if (drop._sliding) {
        // --- Sliding motion along the diagonal line ---
        const slide = drop._sliding;
        const slideDuration = 400; // milliseconds it takes to traverse one line

        // Determine how far along the line we are
        let slideElapsed = ts - slide.startTime;
        slide.t = Math.min(slideElapsed / slideDuration, 1);

        const { line } = slide;
        const lineX = line.x1 + (line.x2 - line.x1) * slide.t;
        const lineY = line.y1 + (line.y2 - line.y1) * slide.t;

        x = lineX;
        y = lineY;

        if (slide.t >= 1) {
          // Done sliding — move to the other column and continue falling
          drop._sliding = null;
          lastRowIdx = line.endIdx;
          drop.dataset.lineIndex = lastRowIdx;
          // Set new startY and startTime so drop continues from end of line
          startY = lineY;
          // Adjust duration so the remaining fall is proportional
          let remaining = endY - startY;
          duration = (remaining / (endY - (-20))) * (dropFallDuration * 1000);
          startTime = ts;
        }
    } else {
      // --- Regular vertical falling ---
      x = getRowX(lastRowIdx);
    }

    // Update drop position
    drop.style.top = y + "px";
    drop.style.left = (x - size / 2) + "px";

    // Continue or end animation
    if (progress < 1 && gameRunning) {
      requestAnimationFrame(animateDrop);
    } else {
      // --- Drop reached bottom ---
      drop.remove();

      let score = parseInt(document.getElementById("score").textContent, 10);
      const catcherImgs = document.querySelectorAll('.catcher-img');
      const idx = parseInt(drop.dataset.lineIndex, 10);
      const catcherImg = catcherImgs[idx];

      if (catcherImg && catcherImg.src.includes('water-can')) {
        score += 100;
        // Play point sound
        try {
          if (pointSfx && typeof pointSfx.play === 'function') {
            pointSfx.currentTime = 0;
            pointSfx.play().catch(err => console.warn('Point SFX playback failed:', err));
          }
        } catch (err) {
          console.warn('Point SFX error:', err);
        }
      } else {
        score -= 50;
        if (isEasyMode) {
          lives--;
          document.getElementById("lives").textContent = lives;
          if (lives <= 0) {
            gameRunning = false;
            showWinMessage("Game Over! You ran out of lives.");
            return;
          }
        } else {
          // Play ghost hit sound
          try {
            if (ghostSfx && typeof ghostSfx.play === 'function') {
              ghostSfx.currentTime = 0;
              ghostSfx.play().catch(err => console.warn('Ghost SFX playback failed:', err));
            }
          } catch (err) {
            console.warn('Ghost SFX error:', err);
          }
          gameRunning = false;
          showWinMessage("Game Over! You touched a ghost.");
          return;
        }
      }

      document.getElementById("score").textContent = score;

      // Continue or end game
      if (isEasyMode) {
        if (score >= 500) {
          gameRunning = false;
          showWinMessage("Good job! Jerry is filled!");
        } else if (gameRunning) {
          createDrop();
        }
      } else {
        if (score >= 1000) {
          gameRunning = false;
          showWinMessage("Congratulations! Jerry is filled with water on hard mode!");
        } else if (gameRunning) {
          createDrop();
        }
      }
    }
  }

  drop.style.position = "absolute";
  drop.style.top = startY + "px";
  gameContainer.appendChild(drop);
  requestAnimationFrame(animateDrop);
}

// ------------------- WIN / GAME OVER -------------------
function showWinMessage(msg) {
  const winMsg = document.getElementById("win-message");
  const winMsgText = document.getElementById("win-message-text");
  winMsgText.textContent = msg;
  // Play game over sound (best-effort)
  try {
    if (gameOverSfx && typeof gameOverSfx.play === 'function') {
      // Some browsers block autoplay; play in response to user interaction should succeed.
      gameOverSfx.currentTime = 0;
      gameOverSfx.play().catch(err => console.warn('SFX playback failed:', err));
    }
  } catch (err) {
    console.warn('Game over SFX error:', err);
  }
  winMsg.style.display = "block";

  // Remove all user-drawn lines
  document.querySelectorAll('.user-drawn-line').forEach(line => line.remove());

  document.getElementById("replay-btn").onclick = () => {
    winMsg.style.display = "none";
    document.getElementById("score").textContent = "0";
    if (isEasyMode) {
      lives = 3;
      document.getElementById("lives").textContent = lives;
    }
    document.querySelectorAll('.water-drop').forEach(d => d.remove());
    document.querySelectorAll('.user-drawn-line').forEach(line => line.remove());
    randomizeCatchers();
    // Ensure the title remains hidden when replaying
    const header = document.querySelector('.site-header');
    if (header) header.style.display = 'none';
    // Keep the hard-mode class as-is on replay (retain difficulty)
    const gc = document.getElementById('game-container');
    if (gc) {
      if (isEasyMode) {
        gc.classList.remove('hard-mode');
        gc.classList.add('easy-mode');
      } else {
        gc.classList.remove('easy-mode');
        gc.classList.add('hard-mode');
      }
    }
    gameRunning = true;
    createDrop();
  };

  document.getElementById("menu-btn").onclick = () => {
    winMsg.style.display = "none";
    document.getElementById("score").textContent = "0";
    if (isEasyMode) {
      lives = 3;
      document.getElementById("lives").textContent = lives;
    }
    document.querySelectorAll('.water-drop').forEach(d => d.remove());
    document.querySelectorAll('.user-drawn-line').forEach(line => line.remove());
    randomizeCatchers();
    // Show the site title again when returning to the menu
    const header = document.querySelector('.site-header');
    if (header) header.style.display = '';
    // Clear hard-mode visual state when returning to menu
    const gc = document.getElementById('game-container');
    if (gc) {
      gc.classList.remove('hard-mode');
      gc.classList.remove('easy-mode');
    }
    document.getElementById("menu-overlay").style.display = "flex";
    document.getElementById("game-wrapper").style.display = "none";
  };
}

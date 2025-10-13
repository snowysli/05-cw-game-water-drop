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
    if (d < minDist) {
      minDist = d;
      best = xs[i];
      idx = i;
    }
  }
  return { x: best, idx };
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

// ------------------- GAME STATE -------------------
let gameRunning = false;
let dropMaker; // Will store our timer that creates drops regularly

// Game speed settings
let dropFallDuration = 4; // seconds
let isEasyMode = true;
let lives = 3;

document.getElementById("lives").textContent = lives;

document.getElementById("menu-easy-btn").addEventListener("click", () => {
  dropFallDuration = 3.5;
  isEasyMode = true;
  lives = 3;
  document.getElementById("lives").textContent = lives;
  document.getElementById("menu-overlay").style.display = "none";
  document.getElementById("game-wrapper").style.display = "flex";
});

document.getElementById("menu-hard-btn").addEventListener("click", () => {
  dropFallDuration = 1.5;
  isEasyMode = false;
  lives = 1; 
  document.getElementById("lives").textContent = lives;
  document.getElementById("menu-overlay").style.display = "none";
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
  const lineIndex = Math.floor(Math.random() * linePercents.length);
  const centerX = gameWidth * linePercents[lineIndex];
  drop.style.left = (centerX - size / 2) + "px";
  drop.dataset.lineIndex = lineIndex;

  drop.style.animationDuration = dropFallDuration + "s";
  gameContainer.appendChild(drop);

  drop.addEventListener("animationend", () => {
    drop.remove();
    let score = parseInt(document.getElementById("score").textContent, 10);
    if (parseInt(drop.dataset.lineIndex, 10) === 3) {
      score += 100;
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
        // Hard mode: game over immediately on ghost
        gameRunning = false;
        showWinMessage("Game Over! You touched a ghost.");
        return;
      }
    }
    document.getElementById("score").textContent = score;

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
  });
}

// ------------------- WIN / GAME OVER -------------------
function showWinMessage(msg) {
  const winMsg = document.getElementById("win-message");
  const winMsgText = document.getElementById("win-message-text");
  winMsgText.textContent = msg;
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
    document.getElementById("menu-overlay").style.display = "flex";
    document.getElementById("game-wrapper").style.display = "none";
  };
}

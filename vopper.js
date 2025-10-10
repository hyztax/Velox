// -------------------- IMPORTS, AUTH, FIRESTORE --------------------
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { updateUserScore, liveLeaderboard } from "./score.js";

const auth = getAuth();
const db = getFirestore();
let authReady = false;

// -------------------- GLOBALS --------------------
const canvas = document.getElementById("myCanvas");
const pen = canvas.getContext("2d");

let currentScreen = "menu";
let currentLevel = 1;
let gameRunning = false;
let gameOver = false;
let gameWon = false;
let cameraOffsetY = 0;
let fade = 0;

let unlockedLevels = 1; // will be fetched per-user from Firestore
const totalLevels = 5;

const player = {
  x: canvas.width / 2,
  y: canvas.height - 60,
  radius: 20,
  color: "#ffffff",
  vy: 0,
  jumpPower: 18,
  gravity: 0.6,
  onGround: false,
  jumpCount: 0,
  maxJumps: 2
};

const moveSpeed = 5;

// -------------------- FIRESTORE HELPERS --------------------
async function fetchUserUnlockedLevels(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const val = parseInt(data.unlockedLevels, 10);
      return Number.isFinite(val) && val >= 1 ? Math.min(val, totalLevels) : 1;
    } else {
      // initialize doc with unlockedLevels = 1
      await setDoc(ref, { unlockedLevels: 1 }, { merge: true });
      return 1;
    }
  } catch (err) {
    console.error("fetchUserUnlockedLevels error:", err);
    return 1; // fallback
  }
}

async function setUserUnlockedLevels(uid, level) {
  try {
    const ref = doc(db, "users", uid);
    // Use merge to preserve other fields
    await setDoc(ref, { unlockedLevels: level }, { merge: true });
  } catch (err) {
    console.error("setUserUnlockedLevels error:", err);
  }
}

// Atomic-ish update: only write higher value
async function ensureUserUnlockedAtLeast(uid, level) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, { unlockedLevels: level }, { merge: true });
      return level;
    } else {
      const current = parseInt(snap.data().unlockedLevels || 1, 10);
      if (level > current) {
        await updateDoc(ref, { unlockedLevels: level });
        return level;
      }
      return current;
    }
  } catch (err) {
    console.error("ensureUserUnlockedAtLeast error:", err);
    return unlockedLevels; // fallback
  }
}

// -------------------- AUTH STATE --------------------
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authReady = true;
    // fetch unlocked levels for user from Firestore (synchronously before showing level screen)
    unlockedLevels = await fetchUserUnlockedLevels(user.uid);
    liveLeaderboard(user.uid);
    loop(); // start loop after we have user + unlocked levels
  } else {
    window.location.href = "signup.html";
  }
});

// -------------------- INPUT --------------------
const keys = {};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (currentScreen === "menu" && (k === " " || k === "enter")) {
    currentScreen = "game";
    startGame();
  }

  if (currentScreen === "game" && k === "r") {
    if (gameOver || gameWon) startGame();
  }
});
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

// -------------------- WORLD --------------------
let platforms = [];
let bricks = [];
let brickTimer = 0;
let brickInterval = 60;
let door = { x: canvas.width / 2 - 25, y: -2000, w: 50, h: 80 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// -------------------- GAME SETUP --------------------
function startGame() {
  gameRunning = true;
  gameOver = false;
  gameWon = false;

  player.x = canvas.width / 2;
  player.y = canvas.height - 60;
  player.vy = 0;
  player.onGround = false;
  player.jumpCount = 0;
  cameraOffsetY = 0;
  platforms = [];
  bricks = [];
  brickTimer = 0;

  platforms.push({
    x: 0,
    y: canvas.height - 30,
    w: canvas.width,
    h: 30,
    color: "#050505ff"
  });

  const count = 35 + currentLevel * 5;
  const baseGap = 120 + currentLevel * 10;
  const gapVar = 20 + currentLevel * 5;
  const platWidth = Math.max(60, 120 - currentLevel * 5);
  const platHeight = 20;

  let lastY = canvas.height - 120;
  for (let i = 0; i < count; i++) {
    const gap = baseGap + Math.random() * gapVar;
    const y = lastY - gap;
    const x = Math.random() * (canvas.width - platWidth);
    platforms.push({ x, y, w: platWidth, h: platHeight, color: "#3069b3ff" });
    lastY = y;
  }

  const topPlat = platforms.reduce((min, p) => (p.y < min.y ? p : min), platforms[0]);
  door.y = topPlat.y - 400;
  door.x = clamp(topPlat.x + topPlat.w / 2 - door.w / 2, 20, canvas.width - door.w - 20);
}

// -------------------- COLLISION --------------------
function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}

// -------------------- END-OF-GAME / SAVE LOGIC --------------------
// Save score to firestore via your existing updateUserScore function
// Accepts optional level param to ensure we save the exact completed level.
async function saveScoreIfBetter(optionalLevel) {
  const user = auth.currentUser;
  if (!user) return;

  const progress = Math.max(0, Math.floor((canvas.height - player.y) / 10));
  const name = user.displayName || `Player-${user.uid.slice(0, 4)}`;
  const levelToSave = typeof optionalLevel === "number" ? optionalLevel : currentLevel;

  try {
    await updateUserScore(user.uid, name, progress, levelToSave);
    // refresh leaderboard after updating
    liveLeaderboard(user.uid);
  } catch (err) {
    console.error("saveScoreIfBetter error:", err);
  }
}

// Handle win asynchronously so the main update loop isn't blocked.
// completedLevel is the level the player just finished.
async function handleWin(completedLevel) {
  const user = auth.currentUser;
  if (user) {
    // Ensure unlockedLevels in Firestore is at least completedLevel+1
    if (completedLevel < totalLevels) {
      const newUnlocked = Math.min(totalLevels, completedLevel + 1);
      const result = await ensureUserUnlockedAtLeast(user.uid, newUnlocked);
      unlockedLevels = result; // keep local copy in sync
    }
  }

  // Save score for the completed level (important: pass completedLevel explicitly)
  await saveScoreIfBetter(completedLevel);
}

// Handle game over as well (save score)
async function handleGameOver() {
  await saveScoreIfBetter();
}

// -------------------- UPDATE --------------------
function update(delta) {
  if (keys["a"]) player.x -= moveSpeed * delta;
  if (keys["d"]) player.x += moveSpeed * delta;
  player.x = clamp(player.x, player.radius, canvas.width - player.radius);

  if (keys[" "] && player.jumpCount < player.maxJumps) {
    player.vy = -player.jumpPower;
    player.jumpCount++;
    keys[" "] = false;
  }

  player.vy += player.gravity * delta;
  player.y += player.vy * delta;
  cameraOffsetY = player.y - canvas.height / 2;

  // --- collisions ---
  player.onGround = false;
  for (const plat of platforms) {
    const withinX = player.x + player.radius > plat.x && player.x - player.radius < plat.x + plat.w;
    const comingDown = player.vy >= 0;
    const topHit = player.y + player.radius > plat.y && player.y + player.radius < plat.y + plat.h;
    if (withinX && comingDown && topHit) {
      player.y = plat.y - player.radius;
      player.vy = 0;
      player.onGround = true;
      player.jumpCount = 0;
    }
  }

  // --- bricks ---
  brickTimer += delta;
  const heightClimbed = Math.max(0, canvas.height - player.y);
  brickInterval = Math.max(20, 60 - currentLevel * 2 - Math.floor(heightClimbed / 200));
  if (brickTimer >= brickInterval) {
    brickTimer = 0;
    const size = 28 + Math.random() * 10;
    const bx = Math.random() * (canvas.width - size);
    const by = cameraOffsetY - 120;
    const vy = 4 + currentLevel * 0.5 + Math.random() * 2;
    bricks.push({ x: bx, y: by, w: size, h: size, vy });
  }

  for (let i = bricks.length - 1; i >= 0; i--) {
    const b = bricks[i];
    b.y += b.vy * delta;
    if (circleRectCollision(player.x, player.y, player.radius, b.x, b.y, b.w, b.h)) {
      gameOver = true;
      gameRunning = false;
      // call handler (fire & forget)
      handleGameOver();
    }
    if (b.y - cameraOffsetY > canvas.height + 120) bricks.splice(i, 1);
  }

  // --- door (level complete) ---
  if (
    player.x > door.x &&
    player.x < door.x + door.w &&
    player.y > door.y &&
    player.y < door.y + door.h &&
    !gameWon
  ) {
    // Mark win immediately to avoid double triggers
    gameWon = true;
    gameRunning = false;

    // Save completed level before we mutate it
    const completedLevel = currentLevel;

    // Unlock next level in Firestore + local copy (handled async)
    handleWin(completedLevel).catch((err) => console.error("handleWin error:", err));

    // Move to next level locally (optional; keeps previous behavior)
    if (currentLevel < totalLevels) {
      currentLevel++;
    } else {
      // if last level, keep it at last level
      currentLevel = totalLevels;
    }
  }
}

// -------------------- MENU / LEVEL SELECT DRAW --------------------
let mouseY = 0;
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseY = e.clientY - rect.top;
});

function drawMenu() {
  pen.clearRect(0, 0, canvas.width, canvas.height);
  fade = Math.min(fade + 0.05, 1);
  pen.globalAlpha = fade;

  pen.fillStyle = "#2e093021";
  pen.fillRect(0, 0, canvas.width, canvas.height);

  pen.fillStyle = "#49a8d4ff";
  pen.font = "bold 48px Arial";
  pen.textAlign = "center";
  pen.fillText("Vopper", canvas.width / 2, 200);

  const buttons = [
    { text: "Start Game", y: 350 },
    { text: "Choose Level", y: 440 }
  ];

  buttons.forEach((btn) => {
    const isHover = Math.abs(mouseY - btn.y) < 25;
    pen.fillStyle = isHover ? "#b6af4eff" : "#e7e7e7ff";
    pen.font = isHover ? "bold 32px Arial" : "28px Arial";
    pen.fillText(btn.text, canvas.width / 2, btn.y);
  });

  pen.globalAlpha = 1;
}

function drawLevelSelect() {
  pen.clearRect(0, 0, canvas.width, canvas.height);
  fade = Math.min(fade + 0.05, 1);
  pen.globalAlpha = fade;

  pen.fillStyle = "#111";
  pen.fillRect(0, 0, canvas.width, canvas.height);

  pen.fillStyle = "white";
  pen.font = "bold 36px Arial";
  pen.textAlign = "center";
  pen.fillText("Select Level", canvas.width / 2, 150);

  for (let i = 1; i <= totalLevels; i++) {
    const y = 200 + i * 70;
    const isHover = Math.abs(mouseY - y) < 25;
    const isLocked = i > unlockedLevels;

    if (isLocked) {
      pen.fillStyle = "#777";
      pen.font = "26px Arial";
      pen.fillText("🔒 Level " + i, canvas.width / 2, y);
    } else {
      pen.fillStyle = isHover ? "#FFD700" : "#FFFFFF";
      pen.font = isHover ? "bold 30px Arial" : "26px Arial";
      pen.fillText("Level " + i, canvas.width / 2, y);
    }
  }

  pen.fillStyle = "#ff6666";
  pen.font = "24px Arial";
  pen.fillText("⬅ Back", canvas.width / 2, 650);
  pen.globalAlpha = 1;
}

// -------------------- RENDER GAME --------------------
function renderGame() {
  pen.clearRect(0, 0, canvas.width, canvas.height);
  pen.fillStyle = "#111";
  pen.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 40; i++) {
    const sx = (i * 97) % canvas.width;
    const sy = (i * 131 - Math.floor(cameraOffsetY * 0.2)) % (canvas.height + 50) - 50;
    pen.fillStyle = "#222";
    pen.fillRect(sx, sy, 2, 2);
  }

  pen.fillStyle = "#fff";
  pen.fillRect(door.x, door.y - cameraOffsetY, door.w, door.h);
  pen.strokeStyle = "#ccc";
  pen.strokeRect(door.x, door.y - cameraOffsetY, door.w, door.h);

  for (const plat of platforms) {
    pen.fillStyle = plat.color;
    pen.fillRect(plat.x, plat.y - cameraOffsetY, plat.w, plat.h);
  }

  pen.fillStyle = "rgba(173, 11, 11, 1)";
  for (const b of bricks) pen.fillRect(b.x, b.y - cameraOffsetY, b.w, b.h);

  pen.save();
  pen.beginPath();
  pen.arc(player.x, player.y - cameraOffsetY, player.radius, 0, Math.PI * 2);
  pen.shadowColor = "#fff";
  pen.shadowBlur = 20;
  pen.fillStyle = player.color;
  pen.fill();
  pen.restore();

  pen.fillStyle = "#fff";
  pen.font = "16px Arial";
  pen.textAlign = "left";
  const progress = Math.max(0, Math.floor((canvas.height - player.y) / 10));
  pen.fillText(`Height: ${progress} m`, 10, 24);
  pen.fillText(`Level: ${currentLevel}`, 10, 44);

  if (gameOver || gameWon) {
    pen.fillStyle = "rgba(0,0,0,0.6)";
    pen.fillRect(0, 0, canvas.width, canvas.height);
    pen.fillStyle = "#fff";
    pen.font = "40px Arial";
    pen.textAlign = "center";
    pen.fillText(gameWon ? "LEVEL COMPLETE!" : "GAME OVER", canvas.width / 2, canvas.height / 2 - 10);
    pen.font = "20px Arial";
    pen.fillText("Press R to restart", canvas.width / 2, canvas.height / 2 + 26);
  }
}

// -------------------- CLICK HANDLING --------------------
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;

  if (currentScreen === "menu") {
    if (y > 320 && y < 370) {
      currentLevel = 1;
      currentScreen = "game";
      fade = 0;
      startGame();
    } else if (y > 410 && y < 470) {
      currentScreen = "level";
      fade = 0;
    }
  } else if (currentScreen === "level") {
    for (let i = 1; i <= totalLevels; i++) {
      const top = 200 + i * 70 - 25;
      const bottom = 200 + i * 70 + 25;
      if (y > top && y < bottom) {
        if (i <= unlockedLevels) {
          currentLevel = i;
          currentScreen = "game";
          fade = 0;
          startGame();
        } else {
          console.log("Level locked!");
        }
      }
    }
    if (y > 630 && y < 670) {
      currentScreen = "menu";
      fade = 0;
    }
  }
});

// -------------------- LOOP --------------------
let lastTime = performance.now();

function loop(now = performance.now()) {
  const delta = (now - lastTime) / 16.67;
  lastTime = now;

  switch (currentScreen) {
    case "menu":
      drawMenu();
      break;
    case "level":
      drawLevelSelect();
      break;
    case "game":
      if (authReady && gameRunning && !gameOver && !gameWon) update(delta);
      renderGame();
      break;
  }

  requestAnimationFrame(loop);
}

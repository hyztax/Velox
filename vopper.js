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





const canvas = document.getElementById("myCanvas");
const pen = canvas.getContext("2d");

let currentScreen = "menu";
let currentLevel = 1;
let gameRunning = false;
let gameOver = false;
let gameWon = false;
let cameraOffsetY = 0;
let fade = 0;

let unlockedLevels = 1;
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
  maxJumps: 2,
  glow: true,
  trail: "#00f"
};

const moveSpeed = 5;




async function fetchUserUnlockedLevels(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const val = parseInt(snap.data().unlockedLevels, 10);
      return Number.isFinite(val) && val >= 1 ? Math.min(val, totalLevels) : 1;
    } else {
      await setDoc(ref, { unlockedLevels: 1 }, { merge: true });
      return 1;
    }
  } catch (err) {
    console.error("fetchUserUnlockedLevels error:", err);
    return 1;
  }
}

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
    return unlockedLevels;
  }
}



async function loadUserCustomization(uid) {
  try {
    const ref = doc(db, "scores", uid);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().customization) {
      return {
        color: snap.data().customization.color || "#ffffff",
        glow: snap.data().customization.glow ?? true,
        trail: snap.data().customization.trail || "#00f"
      };
    }
  } catch (err) {
    console.error("loadUserCustomization error:", err);
  }
  // fallback
  return { color: "#ffffff", glow: true, trail: "#00f" };
}



let authReady = false;
let playerCustomizationReady = false;


onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "signup.html";
    return;
  }

  
  unlockedLevels = await fetchUserUnlockedLevels(user.uid);
  liveLeaderboard(user.uid);

  
  const customization = await loadUserCustomization(user.uid);
  player.color = customization.color;
  player.glow = customization.glow;
  player.trail = customization.trail;

  
  const savedColor = localStorage.getItem("vopperBallColor");
  if (savedColor) player.color = savedColor;

  const savedTrail = localStorage.getItem("vopperBallTrail");
  if (savedTrail) player.trail = savedTrail;

  
  player.trailPositions = [];

  
  authReady = true;
  playerCustomizationReady = true;

  
  loop();
});




const keys = {};
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys[k] = true;


  if (currentScreen === "game" && k === "r") {
    if (gameOver || gameWon) startGame();
  }
});
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));


let platforms = [];
let bricks = [];
let brickTimer = 0;
let brickInterval = 60;
let door = { x: canvas.width / 2 - 25, y: -2000, w: 50, h: 80 };

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }


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

  platforms.push({ x: 0, y: canvas.height - 30, w: canvas.width, h: 30, color: "#050505ff" });

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


function circleRectCollision(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < r * r;
}


async function saveScoreIfBetter(optionalLevel) {
  const user = auth.currentUser;
  if (!user) return;

  const progress = Math.max(0, Math.floor((canvas.height - player.y) / 10));
  const name = user.displayName || `Player-${user.uid.slice(0, 4)}`;
  const levelToSave = typeof optionalLevel === "number" ? optionalLevel : currentLevel;

  try {
    await updateUserScore(user.uid, name, progress, levelToSave);
    liveLeaderboard(user.uid);
  } catch (err) {
    console.error("saveScoreIfBetter error:", err);
  }
}

async function handleWin(completedLevel) {
  const user = auth.currentUser;
  if (user) {
    if (completedLevel < totalLevels) {
      const newUnlocked = Math.min(totalLevels, completedLevel + 1);
      const result = await ensureUserUnlockedAtLeast(user.uid, newUnlocked);
      unlockedLevels = result;
    }
  }
  await saveScoreIfBetter(completedLevel);
}

async function handleGameOver() {
  await saveScoreIfBetter();
}


function update(delta) {
  // movement using customizable keys
  if (keys[keyMap.left]) player.x -= moveSpeed * delta;
  if (keys[keyMap.right]) player.x += moveSpeed * delta;
  player.x = clamp(player.x, player.radius, canvas.width - player.radius);

  if (keys[keyMap.jump] && player.jumpCount < player.maxJumps) {
    player.vy = -player.jumpPower;
    player.jumpCount++;
    keys[keyMap.jump] = false;
  }

  
  player.vy += player.gravity * delta;
  player.y += player.vy * delta;
  cameraOffsetY = player.y - canvas.height / 2;

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
      handleGameOver();
    }
    if (b.y - cameraOffsetY > canvas.height + 120) bricks.splice(i, 1);
  }

  if (player.x > door.x && player.x < door.x + door.w && player.y > door.y && player.y < door.y + door.h && !gameWon) {
    gameWon = true;
    gameRunning = false;
    const completedLevel = currentLevel;
    handleWin(completedLevel).catch(err => console.error("handleWin error:", err));
    if (currentLevel < totalLevels) currentLevel++;
    else currentLevel = totalLevels;
  }
}

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

    
for (const b of bricks) {
    pen.save(); 
    pen.fillStyle = `rgba(173,11,11,1)`; 
    pen.fillRect(
        b.x,
        b.y - cameraOffsetY,
        b.w,
        b.h
    );
    pen.restore(); 
}


const trailLength = 15;
if (!player.trailPositions) player.trailPositions = [];
player.trailPositions.push({ x: player.x, y: player.y });
if (player.trailPositions.length > trailLength) player.trailPositions.shift();

for (let i = 0; i < player.trailPositions.length; i++) {
    const pos = player.trailPositions[i];
    const alpha = ((i + 1) / player.trailPositions.length) * 0.5;
    const scale = 0.6 + 0.4 * ((i + 1) / player.trailPositions.length);

    pen.save(); 
    pen.beginPath();
    pen.arc(pos.x, pos.y - cameraOffsetY, player.radius * scale, 0, Math.PI * 2);
    pen.fillStyle = hexToRGBA(player.trail, alpha); 
    pen.fill();
    pen.restore(); 
}


pen.save();
pen.beginPath();
pen.arc(player.x, player.y - cameraOffsetY, player.radius, 0, Math.PI * 2);
if (player.glow) {
    pen.shadowColor = player.color;
    pen.shadowBlur = 20;
} else {
    pen.shadowBlur = 0;
}
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


function hexToRGBA(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}


pen.save();
pen.beginPath();
pen.arc(player.x, player.y - cameraOffsetY, player.radius, 0, Math.PI * 2);
pen.fillStyle = player.color;
if (player.glow) {
    pen.shadowColor = player.color;
    pen.shadowBlur = 20;
} else {
    pen.shadowBlur = 0;
}
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


let mouseY = 0;
canvas.addEventListener("mousemove", e => {
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

  const buttons = [{ text: "Start Game", y: 350 }, { text: "Choose Level", y: 440 }];

  buttons.forEach(btn => {
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
        } else console.log("Level locked!");
      }
    }
    if (y > 630 && y < 670) {
      currentScreen = "menu";
      fade = 0;
    }
  }
});


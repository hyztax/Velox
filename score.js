import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// -------------------- FIREBASE CONFIG --------------------
const firebaseConfig = {
  apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
  authDomain: "velox-c39ad.firebaseapp.com",
  projectId: "velox-c39ad",
  storageBucket: "velox-c39ad.appspot.com",
  messagingSenderId: "404832661601",
  appId: "1:404832661601:web:9ad221c8bfb459410bba20",
  measurementId: "G-X8W755KRF6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// -------------------- SAVE SCORE --------------------
export async function updateUserScore(uid, name, score, level) {
  try {
    const docRef = doc(db, "scores", uid);
    const docSnap = await getDoc(docRef);

    let best = score;
    let progress = level; // highest unlocked level

    if (docSnap.exists()) {
      const data = docSnap.data();

      // keep highest meters climbed
      best = Math.max(score, data.best || 0);

      // keep highest unlocked level (PB)
      progress = Math.max(level, data.progress || 1);
    }

    await setDoc(docRef, {
      name,
      best,      // best meters
      level,     // current run level
      progress,  // highest unlocked level
      current: score // current run meters
    });

    console.log(
      `💾 Saved ${name}: Run L${level} (${score}m) | PB L${progress} (${best}m)`
    );
  } catch (error) {
    console.error("Error updating score:", error);
  }
}

// -------------------- LOAD UNLOCKED LEVELS --------------------
export async function loadUnlockedLevels(uid) {
  try {
    const docRef = doc(db, "scores", uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.progress || 1;
    } else {
      return 1;
    }
  } catch (error) {
    console.error("Error loading unlocked levels:", error);
    return 1;
  }
}

// -------------------- LIVE LEADERBOARD --------------------
export function liveLeaderboard(currentUid) {
  const list = document.getElementById("scores-list");
  if (!list) return;

  const scoresRef = collection(db, "scores");
  const topQuery = query(scoresRef, orderBy("progress", "desc"));

  onSnapshot(topQuery, (snapshot) => {
    list.innerHTML = ""; 
    snapshot.forEach((doc) => {
      const data = doc.data();
      const item = document.createElement("div");
      item.style.padding = "6px 0";
      item.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
      
      if (doc.id === currentUid) {
        item.style.backgroundColor = "rgba(85, 185, 180, 0.2)"; // highlight current user
      }

      item.innerHTML = `
        <b>${data.name}</b><br>
        PB: LVL ${data.progress || 1} : ${data.best || 0}m<br>
        Current: LVL ${data.level || 1} : ${data.current || 0}m
      `;
      list.appendChild(item);
    });
  });
}

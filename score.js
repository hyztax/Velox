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

    if (!docSnap.exists() || docSnap.data().level < level) {
      await setDoc(docRef, { 
        name, 
        best: score,
        level // now we mainly use this for ranking
      });
      console.log(`💾 Saved new best level for ${name}: Level ${level} (${score}m)`);
    }
  } catch (error) {
    console.error("Error updating score:", error);
  }
}

// -------------------- LIVE LEADERBOARD --------------------
export function liveLeaderboard() {
  const list = document.getElementById("scores-list");
  if (!list) return;

  const scoresRef = collection(db, "scores");
  // 🔥 Sort by level instead of best (meters)
  const topQuery = query(scoresRef, orderBy("level", "desc"), limit(10));

  onSnapshot(topQuery, (snapshot) => {
    list.innerHTML = "";
    snapshot.forEach((doc) => {
      const data = doc.data();
      const item = document.createElement("div");
      item.style.padding = "6px 0";
      item.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
      // show highest levels first
      item.innerHTML = `<b>${data.name}</b> — Level ${data.level || 1} (${data.best || 0}m)`;
      list.appendChild(item);
    });
  });
}

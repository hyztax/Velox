// Firebase v10+ modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
  authDomain: "velox-c39ad.firebaseapp.com",
  projectId: "velox-c39ad",
  storageBucket: "velox-c39ad.appspot.com",
  messagingSenderId: "404832661601",
  appId: "1:404832661601:web:9ad221c8bfb459410bba20",
  measurementId: "G-X8W755KRF6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Admin UID
const adminUID = "AS1sGNXa2HMfrOzsSxo1bj5zQaL2";
let currentUser = null;

// DOM references
const messagesContainer = document.getElementById("messagesContainer");
const sendBtn = document.getElementById("sendButton");
const messageInput2 = document.getElementById("messageInput2");

// Disable inputs if not admin
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (!user || user.uid !== adminUID) {
    if (sendBtn) sendBtn.disabled = true;
    if (messageInput2) messageInput2.disabled = true;
  } else {
    if (sendBtn && messageInput2) sendBtn.addEventListener("click", sendMessage);
  }
});

// Send a new global message
async function sendMessage() {
  const text = messageInput2.value.trim();
  if (!text) return;

  await addDoc(collection(db, "globalMessages"), {
    text,
    sender: currentUser.displayName || "Admin",
    timestamp: serverTimestamp()
  });

  messageInput2.value = "";
}

// Show latest message only if still within visibility window
if (messagesContainer) {
  const latestMessageQuery = query(
    collection(db, "globalMessages"),
    orderBy("timestamp", "desc"),
    limit(1)
  );

  let lastMessageId = null;

  onSnapshot(latestMessageQuery, (snapshot) => {
    if (snapshot.empty) return;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Calculate message age
    const now = Date.now();
    const msgTime = data.timestamp?.seconds ? data.timestamp.seconds * 1000 : now;
    const age = now - msgTime;
    const visibleDuration = 8000; // 8 seconds visibility

    // Only show if still valid
    if (age > visibleDuration) return;

    // Only update if it's a new message
    if (doc.id === lastMessageId) return;
    lastMessageId = doc.id;

    // Clear old message
    messagesContainer.innerHTML = "";

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("messageBox");

    // Add "!" icon
    const icon = document.createElement("span");
    icon.classList.add("icon");
    icon.textContent = "!";
    msgDiv.appendChild(icon);

    // Add message text
    const textDiv = document.createElement("span");
    textDiv.classList.add("text");
    textDiv.textContent = data.text;
    msgDiv.appendChild(textDiv);

    messagesContainer.appendChild(msgDiv);

    // Auto-remove after remaining time
    setTimeout(() => {
      msgDiv.remove();
      lastMessageId = null; // allow next message
    }, visibleDuration - age);
  });
}

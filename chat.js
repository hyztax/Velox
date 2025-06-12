// --- Firebase Setup ---
const firebaseConfig = {
  apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
  authDomain: "velox-c39ad.firebaseapp.com",
  projectId: "velox-c39ad",
  storageBucket: "velox-c39ad.appspot.com",
  messagingSenderId: "404832661601",
  appId: "1:404832661601:web:9ad221c8bfb459410bba20",
  measurementId: "G-X8W755KRF6"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM References ---
const sections = {
  friends: document.getElementById("friendsSection"),
  profile: document.getElementById("profileSection"),
  chat: document.getElementById("chatSection"),
};
const appHeader = document.getElementById("appHeader");

const friendsListEl = document.getElementById("friendsList");
const profileAvatarEl = document.getElementById("profileAvatar");
const profileNameEl = document.getElementById("profileName");
const profileBioEl = document.getElementById("profileBio");
const backToFriendsBtn = document.getElementById("backToFriendsBtn");
const messageUserBtn = document.getElementById("messageUserBtn");

const chatHeader = document.getElementById("chatHeader");
const chatMessages = document.getElementById("chatMessages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");

let currentUser = null;
let selectedUser = null;
let chatUnsubscribe = null;
let chatId = null;

// --- Helper Functions ---
const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

function showSection(name) {
  Object.values(sections).forEach(s => s.classList.remove("active"));
  if (sections[name]) sections[name].classList.add("active");

  appHeader.textContent =
    name === "friends" ? "Velox Chat" :
    name === "profile" ? "Profile" :
    name === "chat" ? `${selectedUser?.displayName || ""}` : "";
}

// --- Load Friends ---
async function loadFriends() {
  if (!currentUser || !currentUser.uid) {
    friendsListEl.textContent = "User not logged in or user ID missing";
    return;
  }

  friendsListEl.textContent = "Loading friends...";

  try {
    const friendsRef = db.collection("friends").doc(currentUser.uid).collection("list");
    const snapshot = await friendsRef.get();

    if (snapshot.empty) {
      console.log(`No friends found for user ${currentUser.uid}`);
      friendsListEl.textContent = "No friends yet.";
      return;
    }

    friendsListEl.textContent = "";

    const friendElementsPromises = snapshot.docs.map(async (doc) => {
      const friendUid = doc.id;
      console.log(`Loading friend UID: ${friendUid}`);

      const userDoc = await db.collection("users").doc(friendUid).get();
      if (!userDoc.exists) {
        console.warn(`Friend UID ${friendUid} missing in users collection`);
        return null;
      }
      return renderFriendItem(friendUid);
    });

    const friendElements = (await Promise.all(friendElementsPromises)).filter(Boolean);

    if (friendElements.length === 0) {
      friendsListEl.textContent = "No friends found in users collection.";
      return;
    }

    friendElements.forEach(friendEl => friendsListEl.appendChild(friendEl));

  } catch (error) {
    console.error("Error loading friends:", error);
    friendsListEl.textContent = `Failed to load friends: ${error.message || error}`;
  }
}


// --- Render Friend Item ---
async function renderFriendItem(friendUid) {
  try {
    const userDoc = await db.collection("users").doc(friendUid).get();
    if (!userDoc.exists) return null;

    const userData = userDoc.data();

    const container = document.createElement("div");
    container.classList.add("friend-item");
    container.setAttribute("role", "listitem");
    container.tabIndex = 0;

    const avatar = document.createElement("div");
    avatar.classList.add("friend-avatar");
    if (userData.avatarUrl) {
      avatar.style.backgroundImage = `url(${escapeHtml(userData.avatarUrl)})`;
      avatar.style.backgroundColor = "";
    } else {
      avatar.style.backgroundColor = "#555";
    }
    container.appendChild(avatar);

    const nameSpan = document.createElement("span");
    nameSpan.textContent = userData.displayName || "Unknown";
    container.appendChild(nameSpan);

    // Open profile on click or keyboard enter/space
    container.addEventListener("click", () => openProfile(friendUid));
    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProfile(friendUid);
      }
    });

    return container;
  } catch (err) {
    console.error("Error rendering friend:", err);
    return null;
  }
}

// --- Open Profile ---
function openProfile(uid) {
  db.collection("users").doc(uid).get()
    .then(doc => {
      if (!doc.exists) return alert("User not found");
      selectedUser = { uid, ...doc.data() };

      profileNameEl.textContent = selectedUser.displayName || "No Name";
      profileBioEl.textContent = selectedUser.bio || "";

      if (selectedUser.avatarUrl) {
        profileAvatarEl.style.backgroundImage = `url(${escapeHtml(selectedUser.avatarUrl)})`;
        profileAvatarEl.style.backgroundColor = "";
      } else {
        profileAvatarEl.style.backgroundImage = "none";
        profileAvatarEl.style.backgroundColor = "#bbb";
      }

      showSection("profile");
    })
    .catch(err => {
      console.error(err);
      alert("Failed to load profile.");
    });
}

// --- Start Chat ---
function startChat(uid) {
  if (!currentUser) return alert("Not logged in");

  // Create chat ID consistently: sorted UIDs joined with "_"
  chatId = [currentUser.uid, uid].sort().join("_");

  chatMessages.innerHTML = "";
  showSection("chat");

  // Load selected user info for chat header
 db.collection("users").doc(uid).get().then(doc => {
  if (!doc.exists) {
    selectedUser = { uid, displayName: "Unknown" };
  } else {
    selectedUser = { uid, ...doc.data() };
  }

  // Remove or comment out this line to prevent header update:
  // chatHeader.textContent = `${selectedUser.displayName || "Unknown"}`;
});


  messageInput.value = "";
  sendBtn.disabled = true;

  messageInput.oninput = () => {
    sendBtn.disabled = messageInput.value.trim() === "";
  };

  // Unsubscribe previous listener if any to avoid duplicates
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

  // Listen to messages realtime, ordered by timestamp
  chatUnsubscribe = db.collection("chats").doc(chatId).collection("messages")
    .orderBy("timestamp")
    .onSnapshot(snapshot => {
      chatMessages.innerHTML = "";

      snapshot.forEach(doc => {
        const msg = doc.data();

        const div = document.createElement("div");
        div.className = `message ${msg.sender === currentUser.uid ? "sent" : "received"}`;

        const p = document.createElement("p");
        p.textContent = msg.text;
        div.appendChild(p);

        chatMessages.appendChild(div);
      });

      chatMessages.scrollTop = chatMessages.scrollHeight;
    });

  // Send message handler
  sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;

    db.collection("chats").doc(chatId).collection("messages").add({
      sender: currentUser.uid,
      text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      messageInput.value = "";
      sendBtn.disabled = true;
    }).catch(err => {
      console.error("Error sending message:", err);
      alert("Failed to send message.");
      sendBtn.disabled = false;
    });
  };
}

// --- Profile Buttons ---
backToFriendsBtn.onclick = () => {
  selectedUser = null;
  showSection("friends");
};

messageUserBtn.onclick = () => {
  if (selectedUser) startChat(selectedUser.uid);
};

// --- Auth Listener (only one) ---
auth.onAuthStateChanged(async user => {
  if (user) {
    // Try to load user profile from Firestore
    try {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        currentUser = { uid: user.uid, ...userDoc.data() };
      } else {
        currentUser = { uid: user.uid, displayName: user.email || "No Name" };
      }
    } catch {
      currentUser = { uid: user.uid, displayName: user.email || "No Name" };
    }

    showSection("friends");
    loadFriends();

  } else {
    currentUser = null;
    selectedUser = null;
    showSection("friends");
    friendsListEl.textContent = "Please log in to see your friends.";
    if (chatUnsubscribe) {
      chatUnsubscribe();
      chatUnsubscribe = null;
    }
  }
});

async function addFriend(currentUserUid, friendUid) {
  const timestamp = firebase.firestore.FieldValue.serverTimestamp();

  // Add friend to your list
  await db.collection("friends").doc(currentUserUid).collection("list").doc(friendUid).set({ addedAt: timestamp });

  // Add yourself to their friend list
  await db.collection("friends").doc(friendUid).collection("list").doc(currentUserUid).set({ addedAt: timestamp });
}

async function cleanFriendList(uid) {
  const friendsRef = db.collection("friends").doc(uid).collection("list");
  const snapshot = await friendsRef.get();

  for (const doc of snapshot.docs) {
    const friendUid = doc.id;
    const userDoc = await db.collection("users").doc(friendUid).get();
    if (!userDoc.exists) {
      console.log(`Removing friend UID ${friendUid} from user ${uid} friend list`);
      await friendsRef.doc(friendUid).delete();
    }
  }
}

document.addEventListener("click", function(event) {
  const chatColumn = document.getElementById("chatColumn");
  if (!chatColumn) return;

  const rect = chatColumn.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;

  // Check if click is inside the chatColumn extended by 50px margin
  const insideExtendedArea =
    x >= rect.left - 50 &&
    x <= rect.right + 50 &&
    y >= rect.top - 50 &&
    y <= rect.bottom + 50;

  if (!insideExtendedArea) {
    // Click is outside chatColumn + 50px margin — hide it
    chatColumn.style.display = "none";
  }
});


// fixa så chatatrna kan expandera ordentligt
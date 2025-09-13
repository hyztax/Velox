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
let chatId = null;
let chatUnsubscribe = null;
let selectedUserUnsubscribe = null;
let profileUnsubscribe = null;
let friendListeners = {}; // track friends list real-time listeners

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
    name === "friends" ? "Admin profile" :
    name === "profile" ? "Profile" :
    name === "chat" ? `${selectedUser?.displayName || ""}` : "";
}

// --- Load Friends (real-time) ---
function loadFriends() {
  if (!currentUser || !currentUser.uid) return;

  // Remove old listeners
  Object.values(friendListeners).forEach(unsub => unsub());
  friendListeners = {};

  db.collection("friends").doc(currentUser.uid).collection("list")
    .onSnapshot(snapshot => {
      friendsListEl.innerHTML = "";

      snapshot.docs.forEach(doc => {
        const friendUid = doc.id;

        // Create friend element
        let friendEl = document.createElement("div");
        friendEl.classList.add("friend-item");
        friendEl.dataset.uid = friendUid;
        friendEl.tabIndex = 0;

        const avatarDiv = document.createElement("div");
        avatarDiv.classList.add("friend-avatar");
        friendEl.appendChild(avatarDiv);

        const nameSpan = document.createElement("span");
        friendEl.appendChild(nameSpan);

        friendsListEl.appendChild(friendEl);

        // Open profile on click or enter/space
        friendEl.addEventListener("click", () => openProfile(friendUid));
        friendEl.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openProfile(friendUid);
          }
        });

        // Real-time friend profile listener
        const unsub = db.collection("users").doc(friendUid)
          .onSnapshot(userDoc => {
            const userData = userDoc.data() || {};

            // Update avatar
            if (userData.avatarUrl) {
              avatarDiv.style.backgroundImage = `url(${escapeHtml(userData.avatarUrl)})`;
              avatarDiv.style.backgroundColor = "";
            } else {
              avatarDiv.style.backgroundImage = "none";
              avatarDiv.style.backgroundColor = userData.profileColor || "#555";
            }

            // Update username
            nameSpan.textContent = userData.displayName || "Unknown";
          });

        friendListeners[friendUid] = unsub;
      });
    });
}

// --- Open Profile (real-time) ---
function openProfile(uid) {
  // Unsubscribe previous profile listener
  if (profileUnsubscribe) profileUnsubscribe();

  profileUnsubscribe = db.collection("users").doc(uid)
    .onSnapshot(doc => {
      if (!doc.exists) return alert("User not found");
      selectedUser = { uid, ...doc.data() };

      profileNameEl.textContent = selectedUser.displayName || "No Name";
      profileBioEl.textContent = selectedUser.bio || "";

      if (selectedUser.avatarUrl) {
        profileAvatarEl.style.backgroundImage = `url(${escapeHtml(selectedUser.avatarUrl)})`;
        profileAvatarEl.style.backgroundColor = "";
      } else {
        profileAvatarEl.style.backgroundImage = "none";
        profileAvatarEl.style.backgroundColor = selectedUser.profileColor || "#bbb";
      }

      showSection("profile");
    });
}

// --- Start Chat (real-time) ---
function startChat(uid) {
  if (!currentUser) return alert("Not logged in");

  chatId = [currentUser.uid, uid].sort().join("_");
  chatMessages.innerHTML = "";
  showSection("chat");

  // Unsubscribe previous listener
  if (selectedUserUnsubscribe) selectedUserUnsubscribe();

  selectedUserUnsubscribe = db.collection("users").doc(uid)
    .onSnapshot(doc => {
      if (!doc.exists) return;

      selectedUser = { uid, ...doc.data() };

      chatHeader.textContent = selectedUser.displayName || "Unknown";

      if (selectedUser.avatarUrl) {
        chatHeader.style.backgroundImage = `url(${escapeHtml(selectedUser.avatarUrl)})`;
        chatHeader.style.backgroundColor = "";
      } else {
        chatHeader.style.backgroundImage = "none";
        chatHeader.style.backgroundColor = selectedUser.profileColor || "#bbb";
      }
    });

  messageInput.value = "";
  sendBtn.disabled = true;
  messageInput.oninput = () => {
    sendBtn.disabled = messageInput.value.trim() === "";
  };

  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }

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

// --- Auth Listener ---
auth.onAuthStateChanged(async user => {
  if (user) {
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
    friendsListEl.innerHTML = 'Please <a href="signin.html" style="color:red; text-decoration: underline;">log in</a> to see your friends.';

    if (chatUnsubscribe) {
      chatUnsubscribe();
      chatUnsubscribe = null;
    }
  }
});

// --- Friend Management ---
async function addFriend(currentUserUid, friendUid) {
  const timestamp = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection("friends").doc(currentUserUid).collection("list").doc(friendUid).set({ addedAt: timestamp });
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

// --- Click outside chat to hide ---
document.addEventListener("click", function(event) {
  const chatColumn = document.getElementById("chatColumn");
  if (!chatColumn) return;

  const rect = chatColumn.getBoundingClientRect();
  const x = event.clientX;
  const y = event.clientY;

  const insideExtendedArea =
    x >= rect.left - 50 &&
    x <= rect.right + 50 &&
    y >= rect.top - 50 &&
    y <= rect.bottom + 50;

  if (!insideExtendedArea) {
    chatColumn.style.display = "none";
  }
});

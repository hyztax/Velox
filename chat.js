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
    name === "chat" ? `Chat with ${selectedUser?.displayName || ""}` : "";
}

function renderFriendItem(friend) {
  const div = document.createElement("div");
  div.className = "friend-item";
  div.tabIndex = 0;

  const avatar = document.createElement("div");
  avatar.className = "friend-avatar";
  const avatarUrl = friend.avatarUrl || null; // Use null for missing avatars
  if (avatarUrl) {
    avatar.style.backgroundImage = `url(${escapeHtml(avatarUrl)})`;
  } else {
    avatar.style.backgroundColor = "#666"; // fallback color for no avatar
  }
  div.appendChild(avatar);

  const displayName = friend.displayName || "Unknown User"; // Default name
  const nameSpan = document.createElement("span");
  nameSpan.textContent = displayName;
  div.appendChild(nameSpan);

  div.onclick = () => openProfile(friend.uid);
  div.onkeypress = e => { if (e.key === 'Enter') openProfile(friend.uid); };

  return div;
}

// --- Load Friends ---
async function loadFriends() {
  if (!currentUser) {
    friendsListEl.textContent = "Not logged in";
    return;
  }

  friendsListEl.textContent = "Loading friends...";

  try {
    const friendsRef = db.collection("friends").doc(currentUser.uid).collection("list");
    console.log("Friends reference:", friendsRef.path);

    const snapshot = await friendsRef.get();
    console.log("Snapshot size:", snapshot.size);

    friendsListEl.textContent = "";

    if (snapshot.empty) {
      friendsListEl.textContent = "No friends yet.";
      return;
    }

    const friendPromises = snapshot.docs.map(async doc => {
      const friendId = doc.id;
      console.log("Friend ID:", friendId);
      try {
        const userDoc = await db.collection("users").doc(friendId).get();
        if (userDoc.exists) {
          const friendData = userDoc.data();
          console.log("Friend data:", friendData);
          return { ...friendData, uid: friendId };
        } else {
          console.warn(`User document not found for friend ID: ${friendId}`);
          return { uid: friendId, displayName: "Unknown User", bio: "Profile Missing", avatarUrl: null };
        }
      } catch (error) {
        console.error(`Error fetching user data for friend ${friendId}:`, error);
        return null;
      }
    });

    const friends = (await Promise.all(friendPromises)).filter(friend => friend !== null);

    if (friends.length === 0) {
      friendsListEl.textContent = "No friends found.";
      return;
    }

    friends.forEach(friend => {
      const item = renderFriendItem(friend);
      friendsListEl.appendChild(item);
    });

  } catch (error) {
    console.error("Error loading friends:", error);
    friendsListEl.textContent = "Failed to load friends.";
  }
}


// --- Profile ---
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
  chatId = [currentUser.uid, uid].sort().join("_");
  chatMessages.innerHTML = "";
  showSection("chat");

  db.collection("users").doc(uid).get().then(doc => {
    selectedUser = { uid, ...doc.data() };
    chatHeader.textContent = `Chat with ${selectedUser.displayName || "Unknown"}`;
  });

  messageInput.value = "";
  sendBtn.disabled = true;

  messageInput.oninput = () => {
    sendBtn.disabled = messageInput.value.trim() === "";
  };

  // Unsubscribe previous listener if any
  if (chatUnsubscribe) chatUnsubscribe();

  // Listen to chat messages realtime
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

// --- Auth Listener ---
auth.onAuthStateChanged(async user => {
  if (user) {
    // Try to get user data from localStorage first
    let userData = localStorage.getItem('user');
    if (userData) {
      userData = JSON.parse(userData);
      currentUser = { ...user, ...userData }; // Combine Firebase user with local data
      console.log("User data loaded from localStorage:", currentUser);
    } else {
      // If not in localStorage, fetch from Firestore
      try {
        const userDoc = await db.collection("users").doc(user.uid).get();
        if (userDoc.exists) {
          userData = userDoc.data();
          currentUser = { ...user, ...userData, uid: user.uid };
          console.log("User data loaded from Firestore:", currentUser);
          localStorage.setItem('user', JSON.stringify(currentUser)); // Store in localStorage
        } else {
          console.warn("User document not found in Firestore.");
          currentUser = user; // Use basic Firebase user data
        }
      } catch (error) {
        console.error("Error fetching user document:", error);
        currentUser = user; // Use basic Firebase user data
      }
    }

    loadFriends();
    showSection("friends");
  } else {
    currentUser = null;
    console.log("Logged out");
    localStorage.removeItem('user'); // Clear localStorage on logout
    window.location.href = 'signin.html';
  }
});


// --- Profile Buttons ---
backToFriendsBtn.onclick = () => {
  selectedUser = null;
  showSection("friends");
};

messageUserBtn.onclick = () => {
  if (selectedUser) startChat(selectedUser.uid);
};

// --- Auth Functions ---
async function signUp(email, password) {
  try {
    const { user } = await auth.createUserWithEmailAndPassword(email, password);
    const userData = {
      displayName: email.split('@')[0],
      bio: "",
      avatarUrl: null,
      email
    };
    await db.collection("users").doc(user.uid).set(userData);

    // Store user data in localStorage
    localStorage.setItem('user', JSON.stringify({ ...userData, uid: user.uid }));

    console.log("Signed up:", user);
  } catch (error) {
    console.error("Signup error:", error);
    alert(error.message);
  }
}

async function signIn(email, password) {
  try {
    await auth.signInWithEmailAndPassword(email, password);
    console.log("Signed in:", email);
  } catch (error) {
    console.error("Signin error:", error);
    alert(error.message);
  }
}

async function signOut() {
  try {
    await auth.signOut();
    console.log("Signed out");
    localStorage.removeItem('user'); // Clear localStorage on logout
  } catch (error) {
    console.error("Signout error:", error);
    alert(error.message);
  }
}

// Check if the user is logged in
function isLoggedIn() {
  return currentUser !== null;
}

// Function to get the current user
function getCurrentUser() {
  return currentUser;
}

// works


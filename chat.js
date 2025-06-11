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

async function loadFriends() {
  if (!currentUser  || !currentUser .uid) {
    friendsListEl.textContent = "User  not logged in or user ID missing";
    return;
  }

  friendsListEl.textContent = "Loading friends...";

  try {
    // Fetch only the direct friends from the 'list' subcollection
    const friendsRef = db.collection("friends").doc(currentUser .uid).collection("list");
    const snapshot = await friendsRef.get();

    friendsListEl.textContent = ""; // Clear loading text

    if (snapshot.empty) {
      friendsListEl.textContent = "No friends yet.";
      return;
    }

    const friendElementsPromises = snapshot.docs.map(async (doc) => {
      const friendUid = doc.id; // Get the UID of the friend
      return renderFriendItem(friendUid); // Render the friend item
    });

    // Wait for all promises to resolve and filter out null values
    const friendElements = (await Promise.all(friendElementsPromises)).filter(Boolean);

    // Clear existing friends list to avoid duplicates
    friendsListEl.innerHTML = '';
    friendElements.forEach(friendEl => {
      friendsListEl.appendChild(friendEl);
    });

  } catch (error) {
    console.error("Error loading friends:", error);
    friendsListEl.textContent = `Failed to load friends: ${error.message || error}`;
  }
}


// Place this function anywhere in your script (outside loadFriends)
async function testLoadFriends() {
  if (!currentUser || !currentUser.uid) {
    console.log("User not logged in or no uid");
    return;
  }

  try {
    const friendsRef = db.collection("friends").doc(currentUser.uid).collection("list");
    const snapshot = await friendsRef.get();

    console.log("Friends count:", snapshot.size);

    snapshot.forEach(doc => {
      console.log("Friend ID:", doc.id, "Data:", doc.data());
    });
  } catch (error) {
    console.error("Error loading friends in test:", error);
  }
}

// Call testLoadFriends after login, like:
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    loadFriends();
    testLoadFriends(); // <---- call it here to check debug output
  } else {
    currentUser = null;
  }
});


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

// Make sure Firebase is initialized and firebase.auth() is available

firebase.auth().onAuthStateChanged((user) => {
  if (user) {
    const username = user.displayName || user.email || "User";
    const welcomeMsg = document.getElementById("welcomeMsg");
    if (welcomeMsg) {
      welcomeMsg.textContent = `Hi there ${username}!`;
    }
  } else {
    // Optional: user is not logged in
    const welcomeMsg = document.getElementById("welcomeMsg");
    if (welcomeMsg) {
      welcomeMsg.textContent = "Welcome guest!";
    }
  }
});

// Assume you have a function to fetch friends list from your database (Firebase or elsewhere)
async function loadFriends() {
  if (!currentUser  || !currentUser .uid) {
    friendsListEl.textContent = "User  not logged in or user ID missing";
    return;
  }

  friendsListEl.textContent = "Loading friends...";

  try {
    // Only load friends who are in the 'list' subcollection
    const friendsRef = db.collection("friends").doc(currentUser .uid).collection("list");
    const snapshot = await friendsRef.get();

    friendsListEl.textContent = ""; // Clear the loading text

    if (snapshot.empty) {
      friendsListEl.textContent = "No friends yet.";
      return;
    }

    const friendElementsPromises = snapshot.docs.map(async (doc) => {
      const friendUid = doc.id; // Friend UID from subcollection
      // Check if the user exists in the users collection, and only render if they do
      const userDoc = await db.collection("users").doc(friendUid).get();
      if (!userDoc.exists) {
        console.warn(`Friend UID ${friendUid} does not exist in 'users' collection`);
        return null;  // Do not display this friend if they don't have a valid profile
      }
      return renderFriendItem(friendUid); // Proceed to render if the user exists
    });

    // Wait for all promises to resolve, and filter out null values
    const friendElements = (await Promise.all(friendElementsPromises)).filter(Boolean);

    // Append friend elements to the list container
    friendElements.forEach(friendEl => {
      friendsListEl.appendChild(friendEl);
    });

  } catch (error) {
    console.error("Error loading friends:", error);
    friendsListEl.textContent = `Failed to load friends: ${error.message || error}`;
  }
}

// Render friend item by fetching full user profile from 'users' collection by UID
async function renderFriendItem(friendUid) {
  try {
    const userDoc = await db.collection("users").doc(friendUid).get();
    if (!userDoc.exists) {
      console.warn(`User  profile not found for UID: ${friendUid}`);
      return createFriendPlaceholder("Unknown User", friendUid);
    }

    const userData = userDoc.data();

    // Create container div for friend item
    const container = document.createElement("div");
    container.classList.add("friend-item");
    container.setAttribute("role", "listitem");
    container.tabIndex = 0;

    // Avatar div
    const avatar = document.createElement("div");
    avatar.classList.add("friend-avatar");
    if (userData.avatarUrl) {
      avatar.style.backgroundImage = `url(${userData.avatarUrl})`;
      avatar.style.backgroundColor = "";
    } else {
      avatar.style.backgroundColor = "#555";
    }
    container.appendChild(avatar);

    // Name span
    const nameSpan = document.createElement("span");
    nameSpan.textContent = userData.displayName || "Unknown";
    container.appendChild(nameSpan);

    // Click handler to open profile
    container.addEventListener("click", () => openProfile(friendUid));

    // Keyboard accessibility: open profile on Enter or Space
    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openProfile(friendUid);
      }
    });

    return container;

  } catch (err) {
    console.error(`Error fetching user profile for UID ${friendUid}:`, err);
    return createFriendPlaceholder("Unknown User", friendUid);
  }
}


// Helper: create placeholder friend item if user data missing
function createFriendPlaceholder(name, uid) {
  const container = document.createElement("div");
  container.classList.add("friend-item");
  container.setAttribute("role", "listitem");
  container.tabIndex = 0;

  const avatar = document.createElement("div");
  avatar.classList.add("friend-avatar");
  avatar.style.backgroundColor = "#555";

  const nameSpan = document.createElement("span");
  nameSpan.textContent = name;

  container.appendChild(avatar);
  container.appendChild(nameSpan);

  // Optional: open profile on click or keyboard
  container.addEventListener("click", () => openProfile(uid));
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProfile(uid);
    }
  });

  return container;
}

window.addEventListener('load', () => {
  console.log('🔥 Debug Mode: Velox Chat JS Loaded');

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      const currentUserId = user.uid;
      console.log('Current User ID:', currentUserId);

      const friendsRef = firebase.firestore()
        .collection('users')
        .doc(currentUserId)
        .collection('friends');

      const friendsListDiv = document.getElementById('friendsList');
      friendsListDiv.innerHTML = '';

      friendsRef.get().then(friendSnapshots => {
        console.log('Number of friends found:', friendSnapshots.size);

        if (friendSnapshots.empty) {
          friendsListDiv.textContent = '';
          return;
        }

        friendSnapshots.forEach(friendDoc => {
          const friendId = friendDoc.id;
          console.log('Friend ID:', friendId);

          firebase.firestore().collection('users').doc(friendId).get()
            .then(friendData => {
              if (friendData.exists) {
                const friendInfo = friendData.data();
                console.log('Friend Info:', friendInfo);

                const friendElem = document.createElement('div');
                friendElem.textContent = friendInfo.displayName || 'Unnamed Friend';
                friendElem.classList.add('friend-item');
                friendsListDiv.appendChild(friendElem);
              }
            })
            .catch(err => {
              console.error('Error fetching friend data:', err);
            });
        });
      }).catch(err => {
        console.error('Error fetching friends:', err);
      });
    } else {
      document.getElementById('friendsList').textContent = 'Please log in to see friends.';
    }
  });
});

//hyz
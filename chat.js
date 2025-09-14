// --- Firebase Setup ---
const firebaseConfig = {
    apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
    authDomain: "velox-c39ad.firebaseapp.com",
    projectId: "velox-c39ad",
    storageBucket: "velox-c39ad.appspot.com",
    messagingSenderId: "404832601",
    appId: "1:404832601:web:9ad221c8bfb459410bba20",
    measurementId: "G-X8W755KRF6"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const friendsListEl = document.getElementById('friendsList');
const profileAvatarEl = document.getElementById('profileAvatar');
const profileNameEl = document.getElementById('profileName');
const profileBioEl = document.getElementById('profileBio');
const backToFriendsBtn = document.getElementById('backToFriendsBtn');
const messageUserBtn = document.getElementById('messageUserBtn');
const chatHeader = document.getElementById('chatHeader');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const searchFriends = document.getElementById('searchFriends');
const fakeProfile = document.getElementById('fakeProfile');
const welcomeMsg = document.getElementById('welcomeMsg');

let currentUser = null;
let selectedUser = null;
let chatId = null;
let chatUnsubscribe = null;

// --- Helpers ---
function setAvatar(el, avatarUrl, color) {
    if (!el) return;
    if (avatarUrl) {
        el.style.backgroundImage = `url(${avatarUrl})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.textContent = '';
    } else {
        el.style.backgroundImage = '';
        el.style.backgroundColor = color || '#000';
        el.textContent = '';
    }
}

function showSection(name) {
    document.getElementById('friendsSection').style.display = name === 'friends' ? 'block' : 'none';
    document.getElementById('profileSection').style.display = name === 'profile' ? 'flex' : 'none';
    document.getElementById('chatSection').style.display = name === 'chat' ? 'flex' : 'none';

    if (name === 'profile' && selectedUser && selectedUser.uid !== 'adminFake') {
        fakeProfile.style.display = 'none';
        welcomeMsg.style.display = 'none';
    } else if (name === 'friends') {
        fakeProfile.style.display = 'block';
        welcomeMsg.style.display = 'block';
    }
}

function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Listen to friends with live online status ---
function listenToFriends() {
    if (!currentUser) return;

    db.collection('friends').doc(currentUser.uid).collection('list')
      .onSnapshot(async snapshot => {
        friendsListEl.innerHTML = '';

        // Optional: admin fake
        const adminLi = document.createElement('li');
        adminLi.textContent = 'Admin';
        adminLi.style.display = 'none';
        friendsListEl.appendChild(adminLi);

        // Track listeners to avoid duplicates
        const unsubscribers = [];

        for (const doc of snapshot.docs) {
          const friendUid = doc.id;

          // Create li element
          const li = document.createElement('li');
          li.style.cursor = 'pointer';
          li.onclick = () => openProfile(friendUid);

          // Avatar
          const avatar = document.createElement('div');
          avatar.className = 'avatar';

          // Name
          const name = document.createElement('span');
          name.className = 'friendName';

          // Status dot
          const statusDot = document.createElement('div');
          statusDot.className = 'statusDot status-offline';

          li.appendChild(avatar);
          li.appendChild(name);
          li.appendChild(statusDot);
          friendsListEl.appendChild(li);

          // Real-time listener for this friend's profile
          const unsubscribe = db.collection('profiles').doc(friendUid)
              .onSnapshot(profileDoc => {
                  const data = profileDoc.data() || {};
                  setAvatar(avatar, data.avatarUrl, data.profileColor || '#000000ff');
                  name.textContent = data.displayName || 'Unknown';
                  statusDot.className = 'statusDot ' + (data.online ? 'status-online' : 'status-offline');
              });

          unsubscribers.push(unsubscribe);
        }

        // Clean up previous listeners when snapshot updates
        return () => unsubscribers.forEach(fn => fn());
    });
}





 

// --- Open Profile ---
function openProfile(uid) {
    if (uid === 'adminFake') {
        selectedUser = { uid: 'adminFake' };
        profileNameEl.textContent = 'Admin';
        profileBioEl.textContent = 'Welcome to Velox! This is the admin profile.';
        setAvatar(profileAvatarEl, 'velox.image/Velox_logo.png', '#000');
        showSection('profile');
        fakeProfile.style.display = 'block';
        welcomeMsg.style.display = 'block';
        return;
    }

    fakeProfile.style.display = 'none';
    welcomeMsg.style.display = 'none';

    db.collection('profiles').doc(uid).get().then(doc => {
        const data = doc.data() || {};
        selectedUser = { uid, ...data };
        profileNameEl.textContent = data.displayName || 'Unknown';
        profileBioEl.textContent = data.bio || '';
        setAvatar(profileAvatarEl, data.avatarUrl, data.profileColor || '#000');
        showSection('profile');
    });
}

// --- Start chat ---
async function startChat(uid) {
    if (!currentUser || !uid || uid === 'adminFake') return alert("Cannot chat with this user.");

    const profileDoc = await db.collection('profiles').doc(uid).get();
    selectedUser = { uid, ...profileDoc.data() };
    chatId = [currentUser.uid, uid].sort().join('_');

    chatMessages.innerHTML = '';
    chatHeader.textContent = selectedUser.displayName || 'Unknown';

    if (chatUnsubscribe) chatUnsubscribe();

    // Listen to messages
    chatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(async snapshot => {
            snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    let senderName = 'Unknown';

                    if (msg.sender === currentUser.uid) {
                        senderName = 'You';
                    } else if (msg.sender === selectedUser.uid) {
                        senderName = selectedUser.displayName || 'Unknown';
                    } else {
                        // Fetch unknown sender
                        const unknownProfile = await db.collection('profiles').doc(msg.sender).get();
                        senderName = unknownProfile.data()?.displayName || msg.sender;
                    }

                    const div = document.createElement('div');
                    div.textContent = `${senderName}: ${msg.text}`;
                    div.classList.add('message', msg.sender === currentUser.uid ? 'sent' : 'received');
                    chatMessages.appendChild(div);
                    scrollChatToBottom();
                }
            });
        });

    showSection('chat');
}

// --- Send message ---
async function sendMessage(e) {
    if (e) e.preventDefault();
    if (!chatId || !currentUser) return;

    const text = messageInput.value.trim();
    if (!text) return;

    try {
        await db.collection('chats').doc(chatId).collection('messages').add({
            sender: currentUser.uid,
            text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = '';
    } catch (err) {
        console.error("Error sending message:", err);
        alert("Failed to send message. Check console.");
    }
}

// --- Event listeners ---
sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Enable send button only when typing
messageInput.addEventListener('input', () => {
    sendBtn.disabled = messageInput.value.trim() === '';
});

// --- Buttons ---
backToFriendsBtn.onclick = () => { selectedUser = null; showSection('friends'); };
messageUserBtn.onclick = () => { if (selectedUser) startChat(selectedUser.uid); };

// --- Search friends ---
searchFriends.addEventListener('input', () => {
    const term = searchFriends.value.toLowerCase();
    friendsListEl.querySelectorAll('li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});

// --- Auth Listener with online status ---
auth.onAuthStateChanged(user => {
    if (!user) return location.href = 'signin.html';
    currentUser = user;
    
    listenToFriends();
    showSection('friends');

    // --- Online status logic ---
    const userRef = db.collection('profiles').doc(currentUser.uid);

    // Set online true when page loads
    userRef.set({ online: true }, { merge: true })
      .then(() => console.log("Online set!"))
      .catch(err => console.error("Failed to set online:", err));

    // Set online false when page closes or refreshes
    window.addEventListener('beforeunload', () => {
        userRef.set({ online: false }, { merge: true });
    });
}); // ← close auth.onAuthStateChanged properly

// Go back button listener
const goBackBtn = document.getElementById('goBackBtn');
goBackBtn.addEventListener('click', () => {
    window.location.href = 'chat.html'; // redirect to chat.html
});




// kind of works
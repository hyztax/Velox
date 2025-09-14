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
const goBackBtn = document.getElementById('goBackBtn');

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

// --- Format timestamp ---
function formatTimestamp(timestamp) {
    if (!timestamp) return { dayLabel: '', time: '' };
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    let dayLabel;
    if (date.toDateString() === now.toDateString()) dayLabel = 'Today';
    else if (date.toDateString() === yesterday.toDateString()) dayLabel = 'Yesterday';
    else dayLabel = date.toDateString();

    const hours = date.getHours().toString().padStart(2,'0');
    const minutes = date.getMinutes().toString().padStart(2,'0');

    return { dayLabel, time: `${hours}:${minutes}` };
}

// --- Render message ---
let lastRenderedDate = null; // reset per chat when opening a new chat

function renderMessage(msg, msgId = null) {
    const container = document.createElement('div');
    container.className = 'messageContainer ' + (msg.sender === currentUser.uid ? 'sent' : 'received');
    container.dataset.msgId = msgId || '';

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.textContent = msg.deleted ? "*deleted message*" : msg.text;

    // Apply deleted styling if needed
    if (msg.deleted) {
        msgDiv.style.fontStyle = 'italic';
        msgDiv.style.color = '#aaa';
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'messageTime';

    // Determine message date
    let msgDate = null;
    if (msg.timestamp) {
        if (msg.timestamp.toDate) {
            msgDate = msg.timestamp.toDate();
        } else {
            msgDate = new Date(msg.timestamp);
        }
        timeDiv.textContent = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        timeDiv.textContent = '';
    }

    // Insert date separator if date changed
    if (msgDate) {
        const msgDateStr = msgDate.toDateString();
        if (lastRenderedDate !== msgDateStr) {
            lastRenderedDate = msgDateStr;

            const separator = document.createElement('div');
            separator.className = 'dateSeparator';

            const now = new Date();
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);

            if (msgDate.toDateString() === now.toDateString()) {
                separator.textContent = ' Today ';
            } else if (msgDate.toDateString() === yesterday.toDateString()) {
                separator.textContent = ' Yesterday ';
            } else {
                separator.textContent = '' + msgDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + '';
            }

            chatMessages.appendChild(separator);
        }
    }

    container.appendChild(msgDiv);
    container.appendChild(timeDiv);

    // Context menu for message actions
    container.addEventListener('contextmenu', e => {
        e.preventDefault();
        showContextMenu(msgId, msg, container, e);
    });

    chatMessages.appendChild(container);
    scrollChatToBottom();

    // --- Live update for deletion ---
    if (msg.deleted) {
        // Immediate DOM update is already applied above
        // If using real-time listener, update this message in place
        const observer = new MutationObserver(() => scrollChatToBottom());
        observer.observe(msgDiv, { childList: true, characterData: true });
    }
}

// --- Optional helper: instant delete a message ---
function deleteMessage(msgId) {
    const msgContainer = chatMessages.querySelector(`[data-msg-id='${msgId}']`);
    if (msgContainer) {
        const msgDiv = msgContainer.querySelector('.message');
        msgDiv.textContent = "*deleted message*";
        msgDiv.style.fontStyle = 'italic';
        msgDiv.style.color = '#aaa';
        scrollChatToBottom();
    }
}




// --- Context Menu ---
function showContextMenu(msgId, msg, container, event) {
    const menu = document.createElement('div');
    menu.className = 'contextMenu';
    menu.style.position = 'absolute';
    menu.style.background = '#222';
    menu.style.color = '#fff';
    menu.style.padding = '5px';
    menu.style.borderRadius = '5px';
    menu.style.zIndex = '999';
    menu.style.top = `${event.pageY}px`;
    menu.style.left = `${event.pageX}px`;

    if (msg.sender === currentUser.uid && !msg.deleted) {
        const remove = document.createElement('div');
        remove.textContent = 'Remove';
        remove.style.cursor = 'pointer';
        remove.onclick = async () => {
    // Instant local update
    const msgEl = chatMessages.querySelector(`[data-msg-id='${msgId}']`);
    if (msgEl) {
        const msgDiv = msgEl.querySelector('.message');
        msgDiv.textContent = "*deleted message*";
        msgDiv.style.fontStyle = 'italic';
        msgDiv.style.color = '#aaa';
    }

    // Firestore update in background
    try {
        await db.collection('chats').doc(chatId)
                .collection('messages')
                .doc(msgId)
                .update({ deleted: true });
    } catch (err) {
        console.error('Failed to delete message:', err);
    }

    menu.remove();
};

        menu.appendChild(remove);
    }

    const copy = document.createElement('div');
    copy.textContent = 'Copy';
    copy.style.cursor = 'pointer';
    copy.onclick = () => { navigator.clipboard.writeText(msg.text); menu.remove(); };
    menu.appendChild(copy);

    const report = document.createElement('div');
    report.textContent = 'Report';
    report.style.cursor = 'pointer';
    report.onclick = () => { alert('Reported!'); menu.remove(); };
    menu.appendChild(report);

    document.body.appendChild(menu);
    document.addEventListener('click', () => menu.remove(), { once: true });
}

// --- Listen to friends ---
function listenToFriends() {
    if (!currentUser) return;
    db.collection('friends').doc(currentUser.uid).collection('list')
      .onSnapshot(async snapshot => {
        friendsListEl.innerHTML = '';
        for (const doc of snapshot.docs) {
            const friendUid = doc.id;
            const profileDoc = await db.collection('profiles').doc(friendUid).get();
            const data = profileDoc.data() || {};

            const li = document.createElement('li');
            li.style.cursor = 'pointer';
            li.onclick = () => openProfile(friendUid);

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            setAvatar(avatar, data.avatarUrl, data.profileColor || '#000');

            const name = document.createElement('span');
            name.className = 'friendName';
            name.textContent = data.displayName || 'Unknown';

            const latestMsg = document.createElement('span');
            latestMsg.className = 'latestMsg';
            latestMsg.style.color = '#aaa5a5ff';
            latestMsg.style.fontSize = '0.8em';
            latestMsg.style.display = 'block';

        // Latest message preview (skip deleted)
const chatIdTemp = [currentUser.uid, friendUid].sort().join('_');
const messagesSnapshot = await db.collection('chats').doc(chatIdTemp)
                               .collection('messages')
                               .orderBy('timestamp', 'desc')
                               .get();
if (!messagesSnapshot.empty) {
    const msgDoc = messagesSnapshot.docs.find(d => !d.data().deleted);
    latestMsg.textContent = msgDoc ? msgDoc.data().text.slice(0, 20) : '';
}


            const statusDot = document.createElement('div');
            statusDot.className = 'statusDot ' + (data.online ? 'status-online' : 'status-offline');

            li.appendChild(avatar);
            li.appendChild(name);
            li.appendChild(latestMsg);
            li.appendChild(statusDot);

            friendsListEl.appendChild(li);
        }
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

// --- Start Chat ---
async function startChat(uid) {
    if (!currentUser || !uid || uid === 'adminFake') return;

    const chatSection = document.getElementById('chatSection');
    chatSection.style.display = 'none'; // hide chat immediately

    chatMessages.innerHTML = '';
    chatHeader.textContent = '...'; // optional placeholder

    const profileDoc = await db.collection('profiles').doc(uid).get();
    selectedUser = { uid, ...profileDoc.data() };
    chatId = [currentUser.uid, uid].sort().join('_');

    // Unsubscribe previous listener
    if (chatUnsubscribe) chatUnsubscribe();

    // Keep track of rendered messages to prevent duplicates
    const renderedMsgIds = new Set();

    // Attach real-time listener for all messages
    chatUnsubscribe = db.collection('chats').doc(chatId)
        .collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                const msg = change.doc.data();
                const msgId = change.doc.id;

                // Already rendered check
                if (change.type === 'added' && !renderedMsgIds.has(msgId)) {
                    renderMessage(msg, msgId);
                    renderedMsgIds.add(msgId);
                }

                // Handle modifications (deleted or edited)
                else if (change.type === 'modified') {
                    const msgEl = chatMessages.querySelector(`[data-msg-id="${msgId}"]`);
                    if (msgEl) {
                        const msgDiv = msgEl.querySelector('.message');
                        if (msg.deleted) {
                            msgDiv.textContent = "*deleted message*";
                            msgDiv.style.fontStyle = 'italic';
                            msgDiv.style.color = '#aaa';
                        } else {
                            msgDiv.textContent = msg.text;
                            msgDiv.style.fontStyle = 'normal';
                            msgDiv.style.color = '';
                        }
                    }
                }
            });

            scrollChatToBottom();
        });

    // Finally, show the chat section AFTER messages are rendering
    chatHeader.textContent = selectedUser.displayName || 'Unknown';
    chatSection.style.display = 'flex';
    showSection('chat');
}



// --- Send Message ---
async function sendMessage(e) {
    if (e) e.preventDefault();
    if (!chatId || !currentUser) return;

    const text = messageInput.value.trim();
    if (!text) return;

    sendBtn.disabled = true;
    messageInput.disabled = true;

    try {
        await db.collection('chats').doc(chatId).collection('messages').add({
            sender: currentUser.uid,
            text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        messageInput.value = '';
        // No local render → Firestore listener handles everything
    } catch (err) {
        console.error(err);
        alert("Failed to send message.");
    } finally {
        sendBtn.disabled = false;
        messageInput.disabled = false;
    }
}

// --- Event Listeners ---
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
messageInput.addEventListener('input', () => { sendBtn.disabled = messageInput.value.trim() === ''; });
backToFriendsBtn.addEventListener('click', () => { selectedUser = null; showSection('friends'); });
messageUserBtn.addEventListener('click', () => { if (selectedUser) startChat(selectedUser.uid); });
searchFriends.addEventListener('input', () => {
    const term = searchFriends.value.toLowerCase();
    friendsListEl.querySelectorAll('li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});
goBackBtn.addEventListener('click', () => { showSection('friends'); });

// --- Auth & Online Status ---
auth.onAuthStateChanged(user => {
    if (!user) return location.href = 'signin.html';
    currentUser = user;
    listenToFriends();
    showSection('friends');

    const userRef = db.collection('profiles').doc(currentUser.uid);
    userRef.set({ online: true, lastOnline: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

    window.addEventListener('beforeunload', () => {
        userRef.set({ online: false, lastOnline: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
});


// works
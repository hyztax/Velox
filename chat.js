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

// --- Chat settings ---
const MAX_LENGTH = 300;

// --- Globals ---
let currentUser = null;
let selectedUser = null;
let chatId = null;
let chatUnsubscribe = null;
let lastRenderedDate = null;
const friendsState = {}; // store friend info
const friendElements = {}; // store friend list DOM elements

// --- Character counter ---
let charCounter = document.getElementById('charCounter');
if (!charCounter) {
    charCounter = document.createElement('span');
    charCounter.id = 'charCounter';
    charCounter.style.fontSize = '0.8em';
    charCounter.style.color = '#aaa';
    charCounter.style.marginLeft = '5px';
    messageInput.parentNode.appendChild(charCounter);
}

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
    // friendsSection always visible
    document.getElementById('friendsSection').style.display = 'block';
    // profileSection only visible if 'profile' selected
    document.getElementById('profileSection').style.display = name === 'profile' ? 'flex' : 'none';
    // chatSection visible if 'chat' selected
    document.getElementById('chatSection').style.display = name === 'chat' ? 'flex' : 'none';
}

function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// --- Auto-focus chat input on keypress ---
document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement.tagName.toLowerCase();
    if (activeTag !== 'input' && activeTag !== 'textarea') {
        messageInput.focus();
    }
});

// --- Render Messages ---
function renderMessage(msg, msgId = null) {
    const container = document.createElement('div');
    container.className = 'messageContainer ' + (msg.sender === currentUser.uid ? 'sent' : 'received');
    container.dataset.msgId = msgId || '';

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.textContent = msg.deleted ? "*deleted message*" : msg.text;

    if (msg.deleted) {
        msgDiv.style.fontStyle = 'italic';
        msgDiv.style.color = '#aaa';
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'messageTime';

    let msgDate = null;
    if (msg.timestamp) {
        msgDate = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
        timeDiv.textContent = msgDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Date separator
    if (msgDate) {
        const msgDateStr = msgDate.toDateString();
        if (lastRenderedDate !== msgDateStr) {
            lastRenderedDate = msgDateStr;
            const separator = document.createElement('div');
            separator.className = 'dateSeparator';

            const now = new Date();
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);

            if (msgDate.toDateString() === now.toDateString()) separator.textContent = ' Today ';
            else if (msgDate.toDateString() === yesterday.toDateString()) separator.textContent = ' Yesterday ';
            else separator.textContent = msgDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

            chatMessages.appendChild(separator);
        }
    }

    container.appendChild(msgDiv);
    container.appendChild(timeDiv);

    // Context menu
    container.addEventListener('contextmenu', e => {
        e.preventDefault();
        showContextMenu(msgId, msg, container, e);
    });

    chatMessages.appendChild(container);
    scrollChatToBottom();
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
            const msgEl = chatMessages.querySelector(`[data-msg-id='${msgId}']`);
            if (msgEl) {
                const msgDiv = msgEl.querySelector('.message');
                msgDiv.textContent = "*deleted message*";
                msgDiv.style.fontStyle = 'italic';
                msgDiv.style.color = '#aaa';
            }
            try {
                await db.collection('chats').doc(chatId).collection('messages').doc(msgId).update({ deleted: true });
            } catch(err) { console.error(err); }
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
function listenToFriendsRealtime() {
    if (!currentUser) return;

    db.collection('friends').doc(currentUser.uid).collection('list')
      .onSnapshot(async (snapshot) => {
        for (const docChange of snapshot.docChanges()) {
            const friendUid = docChange.doc.id;
            const data = docChange.doc.data() || {};

            const profileDoc = await db.collection('profiles').doc(friendUid).get();
            const profileData = profileDoc.data() || {};

            friendsState[friendUid] = {
                uid: friendUid,
                data: profileData,
                latestMsg: data.lastMessage || '',
                lastChatTimestamp: data.lastChatTimestamp ? data.lastChatTimestamp.toMillis() : 0
            };
        }

        const friendsArray = Object.values(friendsState)
                                   .sort((a,b) => b.lastChatTimestamp - a.lastChatTimestamp);

        friendsListEl.innerHTML = '';
        friendsArray.forEach(friend => renderOrUpdateFriend(friend.uid));

        const lastChatUid = localStorage.getItem('lastChatUid');
        if (lastChatUid && chatId !== [currentUser.uid, lastChatUid].sort().join('_')) {
            startChat(lastChatUid, false);
        }
    });
}



// --- Render or update single friend ---
function renderOrUpdateFriend(friendUid) {
    const friend = friendsState[friendUid];
    if (!friend) return;

    let li = friendElements[friendUid];
    if (!li) {
        li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.addEventListener('click', e => { e.preventDefault(); startChat(friendUid); });
        li.addEventListener('contextmenu', e => { e.preventDefault(); openProfile(friendUid); });
        friendElements[friendUid] = li;
    }
    li.innerHTML = '';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    setAvatar(avatar, friend.data.avatarUrl, friend.data.profileColor || '#000');

    const name = document.createElement('span');
    name.className = 'friendName';
    name.textContent = friend.data.displayName || 'Unknown';

    const latestMsg = document.createElement('span');
    latestMsg.className = 'latestMsg';
    latestMsg.style.color = '#aaa5a5ff';
    latestMsg.style.fontSize = '0.8em';
    latestMsg.style.display = 'block';
    latestMsg.textContent = friend.latestMsg;

    const statusDot = document.createElement('div');
    statusDot.className = 'statusDot ' + (friend.data.online ? 'status-online' : 'status-offline');

    li.appendChild(avatar);
    li.appendChild(name);
    li.appendChild(latestMsg);
    li.appendChild(statusDot);

    friendsListEl.appendChild(li);
}


// --- Open Profile ---
function openProfile(uid) {
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
async function startChat(uid, remember = true) {
    if (!currentUser || !uid) return;

    if (chatId !== [currentUser.uid, uid].sort().join('_')) {
        chatMessages.innerHTML = '';
        chatHeader.textContent = '...';
    }

    const profileDoc = await db.collection('profiles').doc(uid).get();
    selectedUser = { uid, ...(profileDoc.data() || {}) };
    chatId = [currentUser.uid, uid].sort().join('_');

    if (remember) localStorage.setItem('lastChatUid', uid);

    if (chatUnsubscribe) chatUnsubscribe();

    const renderedMsgIds = new Set();
    chatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                const msg = change.doc.data();
                const msgId = change.doc.id;
                if (change.type === 'added' && !renderedMsgIds.has(msgId)) {
                    renderMessage(msg, msgId);
                    renderedMsgIds.add(msgId);
                } else if (change.type === 'modified') {
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

    chatHeader.textContent = selectedUser.displayName || 'Unknown';
    showSection('chat');
}

// --- Send Message ---
async function sendMessage(e) {
    if (e) e.preventDefault();
    if (!chatId || !currentUser) return;

    const text = messageInput.value.trim();
    if (!text || text.length > MAX_LENGTH) return;

    sendBtn.disabled = true;
    messageInput.disabled = true;

    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        await db.collection('chats').doc(chatId).collection('messages').add({
            sender: currentUser.uid,
            text,
            timestamp
        });

        // Update lastMessage and lastChatTimestamp for both users
        const friendUid = selectedUser.uid;
        await db.collection('friends').doc(currentUser.uid)
                .collection('list').doc(friendUid)
                .set({ lastMessage: text.slice(0,20), lastChatTimestamp: timestamp }, { merge: true });

        await db.collection('friends').doc(friendUid)
                .collection('list').doc(currentUser.uid)
                .set({ lastMessage: text.slice(0,20), lastChatTimestamp: timestamp }, { merge: true });

        messageInput.value = '';
    } catch (err) {
        console.error(err);
        alert("Failed to send message.");
    } finally {
        sendBtn.disabled = false;
        messageInput.disabled = false;
    }
}


// --- Input events ---
messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = messageInput.scrollHeight + 'px';

    const length = messageInput.value.length;
    charCounter.textContent = `${length} / ${MAX_LENGTH}`;

    if (length > MAX_LENGTH) {
        messageInput.style.border = '2px solid red';
        charCounter.style.color = 'red';
        sendBtn.disabled = true;
    } else {
        messageInput.style.border = '';
        charCounter.style.color = '#aaa';
        sendBtn.disabled = messageInput.value.trim() === '';
    }
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// --- Navigation ---
backToFriendsBtn.addEventListener('click', () => { selectedUser = null; showSection('friends'); });
messageUserBtn.addEventListener('click', () => { if (selectedUser) startChat(selectedUser.uid); });
searchFriends.addEventListener('input', () => {
    const term = searchFriends.value.toLowerCase();
    friendsListEl.querySelectorAll('li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});

// --- Auth ---
auth.onAuthStateChanged(async user => {
    if (!user) return location.href = 'signin.html';
    currentUser = user;

    listenToFriendsRealtime();

    showSection('friends');

    const userRef = db.collection('profiles').doc(currentUser.uid);
    await userRef.set({ online: true, lastOnline: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

    const lastChatUid = localStorage.getItem('lastChatUid');
    if (lastChatUid) startChat(lastChatUid, false);

    window.addEventListener('beforeunload', () => {
        userRef.set({ online: false, lastOnline: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
});

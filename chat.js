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
const createGroupBtn = document.getElementById('createGroupBtn');

// --- Chat settings ---
const MAX_LENGTH = 300;

// --- Globals ---
let currentUser = null;
let selectedUser = null; // For 1-on-1: {uid, displayName...,}, for group: {chatId, displayName, isGroup:true, members:[]}
let chatId = null; // current chat document id (for 1-on-1 we still store the combined id)
let chatUnsubscribe = null;
let lastRenderedDate = null;
const friendsState = {}; // keyed by uid
const friendElements = {}; // keyed by uid or chatId
const groupChatsState = {}; // keyed by chatId

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
    document.getElementById('friendsSection').style.display = 'block';
    document.getElementById('profileSection').style.display = name === 'profile' ? 'flex' : 'none';
    document.getElementById('chatSection').style.display = name === 'chat' ? 'flex' : 'none';
}

function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// auto-focus chat input on keypress (keeps your behavior)
document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement.tagName.toLowerCase();
    if (activeTag !== 'input' && activeTag !== 'textarea') {
        messageInput.focus();
    }
});

// --- Render Messages (unified for 1-on-1 and group) ---
// msg model (from Firestore): { sender, text, timestamp, deleted, senderName? }
function renderMessage(msg, msgId = null, isGroup = false) {
    const container = document.createElement('div');
    const isMe = msg.sender === currentUser.uid;
    container.className = 'messageContainer ' + (isMe ? 'sent' : 'received');
    container.dataset.msgId = msgId || '';

    // If group and not me: show sender name above message
    if (isGroup && !isMe) {
        const senderDiv = document.createElement('div');
        senderDiv.className = 'groupSenderName';
        // Prefer senderName stored in message (faster), otherwise derive from friendsState or fallback
        senderDiv.textContent = msg.senderName || (friendsState[msg.sender] && friendsState[msg.sender].data.displayName) || 'Unknown';
        senderDiv.style.fontSize = '0.75em';
        senderDiv.style.fontWeight = 'bold';
        senderDiv.style.color = '#ccc';
        senderDiv.style.marginBottom = '2px';
        container.appendChild(senderDiv);
    }

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

    // Date separator (keeps your behavior)
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

    // context menu (copy/remove/report) - same logic as original
    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(msgId, msg, container);
    });

    chatMessages.appendChild(container);
    scrollChatToBottom();
}

function showContextMenu(msgId, msg, container) {
    const menu = document.createElement('div');
    menu.className = 'contextMenu';
    menu.style.position = 'absolute';
    menu.style.background = '#222';
    menu.style.color = '#fff';
    menu.style.padding = '5px';
    menu.style.borderRadius = '5px';
    menu.style.zIndex = '999';
    // Use page coords from event available as lastMouseEvent; fallback if missing
    const top = (window.lastMouseEvent && window.lastMouseEvent.pageY) || (container.getBoundingClientRect().top + window.scrollY);
    const left = (window.lastMouseEvent && window.lastMouseEvent.pageX) || (container.getBoundingClientRect().left + window.scrollX);
    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;

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
            } catch (err) { console.error(err); }
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

// track last mouse position for context menu placement
document.addEventListener('mousemove', e => { window.lastMouseEvent = e; });

// --- Listeners for friends and groups (real-time) ---
function listenToFriendsRealtime() {
    if (!currentUser) return;

    // Friends list (same as original)
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

        renderCombinedList();
    });

    // Groups listener
    db.collection('chats').where('members', 'array-contains', currentUser.uid)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            const data = change.doc.data();
            groupChatsState[change.doc.id] = {
                chatId: change.doc.id,
                name: data.name || 'Unknown',
                members: data.members || [],
                lastChatTimestamp: data.lastChatTimestamp ? data.lastChatTimestamp.toMillis() : (data.createdAt ? data.createdAt.toMillis() : Date.now())
            };
        });

        renderCombinedList();
    });
}

// Render combined friends + groups list (keeps order by lastChatTimestamp)
function renderCombinedList() {
    const combinedArray = [
        ...Object.values(friendsState),
        ...Object.values(groupChatsState)
            .filter(g => g.members && g.members.includes(currentUser.uid)) // 🚀 skip groups you left
    ].sort((a, b) => {
        const timeA = a.lastChatTimestamp || 0;
        const timeB = b.lastChatTimestamp || 0;

        if (timeA === timeB) {
            // ✅ Friends before groups if timestamp is equal
            if (a.chatId && !b.chatId) return 1;
            if (!a.chatId && b.chatId) return -1;
        }
        return timeB - timeA;
    });

    friendsListEl.innerHTML = '';

    for (const item of combinedArray) {
        if (item.chatId) {
            // 🚀 Group (purple name)
            renderOrUpdateGroup(item);
        } else {
            renderOrUpdateFriend(item.uid);
        }
    }
}


// --- Render or update single friend (unchanged behavior) ---
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
    name.style.color = '#fff';

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

// --- Render or update group in list ---
function renderOrUpdateGroup(group) {
    let li = friendElements[group.chatId];
    if (!li) {
        li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.addEventListener('click', e => { e.preventDefault(); startGroupChat(group.chatId); });
        friendElements[group.chatId] = li;
    }
    li.innerHTML = '';

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.backgroundColor = '#800080'; // purple-ish

    const name = document.createElement('span');
    name.className = 'friendName';
    name.textContent = group.name || 'Group Chat';
    name.style.color = '#a64ca6'; // purple

    const latestMsg = document.createElement('span');
    latestMsg.className = 'latestMsg';
    latestMsg.style.color = '#aaa5a5ff';
    latestMsg.style.fontSize = '0.8em';
    latestMsg.style.display = 'block';
    latestMsg.textContent = ''; // group last message summary could be implemented later

    li.appendChild(avatar);
    li.appendChild(name);
    li.appendChild(latestMsg);

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

// --- Start Chat (1-on-1) ---
async function startChat(uid, remember = true) {
    if (!currentUser || !uid) return;

    if (chatId !== [currentUser.uid, uid].sort().join('_')) {
        chatMessages.innerHTML = '';
        chatHeader.textContent = '...';
    }

    const profileDoc = await db.collection('profiles').doc(uid).get();
    selectedUser = { uid, ...(profileDoc.data() || {}) };
    chatId = [currentUser.uid, uid].sort().join('_');

    if (remember) {
        localStorage.setItem('lastChatUid', uid);
        localStorage.removeItem('lastGroupChatId');
    }

    // unsubscribe old
    if (chatUnsubscribe) chatUnsubscribe();

    const renderedMsgIds = new Set();
    chatUnsubscribe = db.collection('chats').doc(chatId).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(snap => {
            snap.docChanges().forEach(change => {
                const msg = change.doc.data();
                const msgId = change.doc.id;
                if (change.type === 'added' && !renderedMsgIds.has(msgId)) {
                    renderMessage(msg, msgId, false);
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

// --- Send Message (handles both 1-on-1 and groups) ---
async function sendMessage(e) {
    if (e) e.preventDefault();
    if (!chatId || !currentUser) return;

    const text = messageInput.value.trim();
    if (!text || text.length > MAX_LENGTH) return;

    sendBtn.disabled = true;
    messageInput.disabled = true;

    try {
        const timestamp = firebase.firestore.FieldValue.serverTimestamp();

        // Determine if current selected chat is a group
        const isGroup = selectedUser?.isGroup === true;

        const msgData = {
            sender: currentUser.uid,
            text,
            timestamp
        };

        // For groups, include a senderName (helps with display after reloads)
        if (isGroup) {
            // try to get displayName from profile (or fallback)
            const profileSnap = await db.collection('profiles').doc(currentUser.uid).get();
            msgData.senderName = (profileSnap.exists && profileSnap.data().displayName) ? profileSnap.data().displayName : '';
        }

        await db.collection('chats').doc(chatId).collection('messages').add(msgData);

        // Update lastMessage / lastChatTimestamp for sorting
        if (isGroup) {
            await db.collection('chats').doc(chatId).update({ lastChatTimestamp: timestamp });
        } else {
            const friendUid = selectedUser.uid;
            await db.collection('friends').doc(currentUser.uid)
                .collection('list').doc(friendUid)
                .set({ lastMessage: text.slice(0,20), lastChatTimestamp: timestamp }, { merge: true });

            await db.collection('friends').doc(friendUid)
                .collection('list').doc(currentUser.uid)
                .set({ lastMessage: text.slice(0,20), lastChatTimestamp: timestamp }, { merge: true });
        }

        messageInput.value = '';
    } catch (err) {
        console.error(err);
        alert("Failed to send message.");
    } finally {
        sendBtn.disabled = false;
        messageInput.disabled = false;
    }
}

// --- Input events (char counter, auto-grow) ---
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
messageUserBtn.addEventListener('click', () => { if (selectedUser && !selectedUser.isGroup) startChat(selectedUser.uid); });
searchFriends.addEventListener('input', () => {
    const term = searchFriends.value.toLowerCase();
    friendsListEl.querySelectorAll('li').forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
});

// --- Auth handling & restore last chat (keeps original behavior + groups) ---
auth.onAuthStateChanged(async user => {
    if (!user) return location.href = 'signin.html';
    currentUser = user;

    listenToFriendsRealtime();

    showSection('friends');

    const userRef = db.collection('profiles').doc(currentUser.uid);
    await userRef.set({ online: true, lastOnline: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

    // Restore last 1-on-1 chat or last group chat
    const lastChatUid = localStorage.getItem('lastChatUid');
    const lastGroupId = localStorage.getItem('lastGroupChatId');

    if (lastChatUid) {
        // ensure group listener has a chance to populate if needed
        startChat(lastChatUid, false);
    } else if (lastGroupId) {
        startGroupChat(lastGroupId);
    }

    window.addEventListener('beforeunload', () => {
        userRef.set({ online: false, lastOnline: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
});

// ========== GROUP CHAT FUNCTIONS ==========

// Open Create Group Modal (uses same UI elements you had)
createGroupBtn?.addEventListener('click', () => openCreateGroupModal());
function openCreateGroupModal() {
    const modal = document.getElementById('groupModal');
    const friendsListDiv = document.getElementById('groupFriendsList');
    friendsListDiv.innerHTML = '';

    const friends = Object.values(friendsState).filter(f => f.uid !== currentUser.uid);
    if (friends.length === 0) return alert("No friends to add!");

    friends.forEach(f => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.color = 'white';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = f.uid;
        checkbox.style.marginRight = '5px';
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(f.data.displayName || 'Unknown'));
        friendsListDiv.appendChild(label);
    });

    modal.style.display = 'flex';
}

// Modal buttons (cancel/confirm)
document.getElementById('createGroupCancelBtn')?.addEventListener('click', () => {
    document.getElementById('groupModal').style.display = 'none';
});

document.getElementById('createGroupConfirmBtn')?.addEventListener('click', async () => {
    const modal = document.getElementById('groupModal');
    const groupName = document.getElementById('groupNameInput').value.trim();
    if (!groupName) return alert("Enter a group name!");

    const checkboxes = document.querySelectorAll('#groupFriendsList input[type="checkbox"]:checked');
    const memberUids = Array.from(checkboxes).map(cb => cb.value);

    if (memberUids.length === 0) return alert("Select at least one friend!");

    await createGroupChat(memberUids, groupName);

    modal.style.display = 'none';
    document.getElementById('groupNameInput').value = '';
});

// Create group chat in Firestore (and local state)
async function createGroupChat(memberUids, groupName) {
    if (!currentUser) return;

    try {
        const chatDoc = await db.collection('chats').add({
            members: [...memberUids, currentUser.uid],
            name: groupName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastChatTimestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Add to local state immediately
        groupChatsState[chatDoc.id] = {
            chatId: chatDoc.id,
            name: groupName,
            members: [...memberUids, currentUser.uid],
            lastChatTimestamp: Date.now()
        };

        renderCombinedList();
        startGroupChat(chatDoc.id);
    } catch (err) {
        console.error(err);
        alert("Failed to create group chat.");
    }
}

// Start group chat (fetches group data, sets up listener, leave button)
async function startGroupChat(chatIdParam) {
    if (!currentUser || !chatIdParam) return;

    chatMessages.innerHTML = '';

    // fetch group doc (ensure we have name/members)
    const chatDoc = await db.collection('chats').doc(chatIdParam).get();
    if (!chatDoc.exists) return alert("Group does not exist.");

    const chatData = chatDoc.data();
    const groupName = chatData.name || 'Group Chat';

    // mark selectedUser as group
    selectedUser = {
        displayName: groupName,
        chatId: chatIdParam,
        isGroup: true,
        members: chatData.members || []
    };
    chatId = chatIdParam;
    localStorage.setItem('lastGroupChatId', chatIdParam);
    localStorage.removeItem('lastChatUid');

    chatHeader.textContent = groupName;

   // leave button (create if missing)
let leaveBtn = document.getElementById('leaveGroupBtn');
if (!leaveBtn) {
    leaveBtn = document.createElement('button');
    leaveBtn.id = 'leaveGroupBtn';
    leaveBtn.textContent = "Leave Group";
    leaveBtn.style.cursor = 'pointer';

    // 🚀 append to the header container instead of inside the name
    chatHeader.parentElement.appendChild(leaveBtn);
}

leaveBtn.style.display = 'inline-block';
leaveBtn.onclick = async () => {
    if (!confirm("Leave this group?")) return;
    try {
        await db.collection('chats').doc(chatIdParam).update({
            members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        });

        // update local state
        if (groupChatsState[chatIdParam]) {
            groupChatsState[chatIdParam].members =
                groupChatsState[chatIdParam].members.filter(uid => uid !== currentUser.uid);
        }

        chatMessages.innerHTML = '';
        chatHeader.textContent = '';
        selectedUser = null;
        chatId = null;
        leaveBtn.style.display = 'none';
        localStorage.removeItem('lastGroupChatId');

        renderCombinedList();
        showSection('friends');
    } catch (err) {
        console.error(err);
        alert("Failed to leave group.");
    }
};


    // subscribe to messages for group
    if (chatUnsubscribe) chatUnsubscribe();

    const renderedMsgIds = new Set();
    chatUnsubscribe = db.collection('chats').doc(chatIdParam).collection('messages')
        .orderBy('timestamp')
        .onSnapshot(async snap => {
            snap.docChanges().forEach(async change => {
                const msg = change.doc.data();
                const msgId = change.doc.id;
                if (change.type === 'added' && !renderedMsgIds.has(msgId)) {
                    // if message lacks senderName but is group, try to get it (non-blocking)
                    if (!msg.senderName) {
                        try {
                            const profileDoc = await db.collection('profiles').doc(msg.sender).get();
                            msg.senderName = (profileDoc.exists && profileDoc.data().displayName) ? profileDoc.data().displayName : '';
                        } catch(e) { /*ignore*/ }
                    }
                    renderMessage(msg, msgId, true);
                    renderedMsgIds.add(msgId);
                } else if (change.type === 'modified') {
                    const msgEl = chatMessages.querySelector(`[data-msg-id="${msgId}"]`);
                    if (msgEl) {
                        const msgDiv = msgEl.querySelector('.message');
                        msgDiv.textContent = msg.deleted ? "*deleted message*" : msg.text;
                        msgDiv.style.fontStyle = msg.deleted ? 'italic' : 'normal';
                        msgDiv.style.color = msg.deleted ? '#aaa' : '';
                    }
                }
            });
            scrollChatToBottom();
        });

    showSection('chat');
}


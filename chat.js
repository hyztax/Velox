// chat.js - full chat logic (friends + groups)
// Requires firebase compat libs (app-compat, auth-compat, firestore-compat)
// Match IDs to your HTML (friendsList, groupModal, groupSidebar, etc.)

// -------------------- Firebase Setup --------------------
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
  
  // -------------------- DOM --------------------
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
  
  const groupModal = document.getElementById('groupModal');
  const groupFriendsList = document.getElementById('groupFriendsList');
  const groupNameInput = document.getElementById('groupNameInput');
  
  const groupSidebar = document.getElementById('groupSidebar');
  
  const groupMembersList = document.getElementById('groupMembersList');
  
  const addMemberSearch = document.getElementById('addMemberSearch');
  const addMemberBtn = document.getElementById('addMemberBtn');
  
  let charCounter = document.getElementById('charCounter');
  if (!charCounter) {
    charCounter = document.createElement('div');
    charCounter.id = 'charCounter';
    charCounter.style.fontSize = '0.8em';
    charCounter.style.color = '#aaa';
    if (messageInput && messageInput.parentNode) messageInput.parentNode.appendChild(charCounter);
  }
  
  // -------------------- State --------------------
  const MAX_LENGTH = 300;
  let currentUser = null;
  let selectedUser = null; // { uid } for 1-on-1 OR { isGroup:true, chatId, displayName, members, createdBy }
  let chatId = null;
  let chatUnsubscribe = null;
  let lastRenderedDate = null;
  
  const friendsState = {};    // uid -> { uid, data:profileData, latestMsg, lastChatTimestamp }
  const friendElements = {};  // uid or chatId -> li
  const groupChatsState = {}; // chatId -> { chatId, name, members, lastChatTimestamp, createdBy, lastMessagePreview }
  
  // UI elements created lazily:
  let leaveBtn = null;
  let toggleMembersBtn = null;
  
  // track last mouse event for context menu placement
  window.lastMouseEvent = null;
  document.addEventListener('mousemove', e => { window.lastMouseEvent = e; });
  
  // -------------------- Helpers --------------------
  function setAvatar(el, avatarUrl, color) {
    if (!el) return;
    if (avatarUrl) {
      el.style.backgroundImage = `url(${avatarUrl})`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.textContent = '';
    } else {
      el.style.backgroundImage = '';
      el.style.backgroundColor = color || '#333333ff';
      el.textContent = '';
    }
  }
  
  function showSection(name) {
    const friendsSection = document.getElementById('friendsSection');
    const profileSection = document.getElementById('profileSection');
    const chatSection = document.getElementById('chatSection');
    if (friendsSection) friendsSection.style.display = 'block';
    if (profileSection) profileSection.style.display = name === 'profile' ? 'flex' : 'none';
    if (chatSection) chatSection.style.display = name === 'chat' ? 'flex' : 'none';
  }
  
  function scrollChatToBottom() {
    if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // ensure leave button (app-level, hidden by default)
  function createLeaveButtonIfMissing() {
    if (leaveBtn) return;
    const app = document.getElementById('app') || document.body;
    leaveBtn = document.createElement('button');
    leaveBtn.id = 'leaveGroupBtn';
    leaveBtn.className = 'leave-btn';
    leaveBtn.textContent = 'Leave Group';
    leaveBtn.style.display = 'none';
    leaveBtn.style.position = 'fixed';
    leaveBtn.style.top = '14px';
    leaveBtn.style.right = '20px';
    leaveBtn.style.background = '#red';
    leaveBtn.style.color = '#fff';
    leaveBtn.style.border = 'none';
    leaveBtn.style.borderRadius = '6px';
    leaveBtn.style.padding = '6px 10px';
    leaveBtn.style.cursor = 'pointer';
    leaveBtn.style.zIndex = '2000';
    app.appendChild(leaveBtn);
  }
  
  // toggle members button
  function createToggleMembersButtonIfMissing() {
    if (toggleMembersBtn) return;
    const app = document.getElementById('app') || document.body;
    toggleMembersBtn = document.createElement('button');
    toggleMembersBtn.id = 'toggleMembersBtn';
    toggleMembersBtn.className = 'toggle-members-btn';
    toggleMembersBtn.title = 'Toggle members';
    toggleMembersBtn.textContent = '👥';
    toggleMembersBtn.style.display = 'none';

    //positioning
    toggleMembersBtn.style.position = 'fixed';
    toggleMembersBtn.style.top = '13px';
    toggleMembersBtn.style.right = '120px'; 
    toggleMembersBtn.style.background = 'transparent';
    toggleMembersBtn.style.color = '#fff';
    toggleMembersBtn.style.border = 'none';
    toggleMembersBtn.style.fontSize = '18px';
    toggleMembersBtn.style.cursor = 'pointer';
    toggleMembersBtn.style.zIndex = '2000';

    app.appendChild(toggleMembersBtn);

    toggleMembersBtn.addEventListener('click', () => {
        if (!groupSidebar) return;
        if (groupSidebar.style.display === 'flex') hideGroupSidebar();
        else showGroupSidebar(selectedUser);
    });
}


  
  // small helper to dedupe arrays
  function uniqueArray(arr) {
    return Array.from(new Set(arr || []));
  }
  
// -------------------- Helper --------------------
function formatChatDate(d) {
  const now = new Date();
  const diffTime = now - d; // difference in ms
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const isSameDay = d.getDate() === now.getDate() &&
                    d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() &&
                      d.getMonth() === yesterday.getMonth() &&
                      d.getFullYear() === yesterday.getFullYear();

  if (isSameDay) {
    return "Today";
  } else if (isYesterday) {
    return "Yesterday";
  } else if (diffDays < 7) {
    // within the last week
    return d.toLocaleDateString([], { weekday: 'long' }); // "Monday"
  } else if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }); // "Sep 23"
  } else {
    return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }); // "2024 May 12"
  }
}

// -------------------- Main Message Rendering --------------------
function renderMessage(msg, msgId = null) {
    if (!chatMessages) return;

    let d = new Date();
    if (msg.timestamp) {
        if (typeof msg.timestamp.toDate === 'function') {
            d = msg.timestamp.toDate();
        } else if (msg.timestamp.seconds) {
            d = new Date(msg.timestamp.seconds * 1000);
        } else {
            d = new Date(msg.timestamp);
        }
    }

    

    const dateStr = formatChatDate(d);
    if (lastRenderedDate !== dateStr) {
        const divider = document.createElement('div');
        divider.className = 'dateDivider';
        divider.textContent = dateStr;
        chatMessages.appendChild(divider);
        lastRenderedDate = dateStr;
    }

    const container = document.createElement('div');
    const isMe = msg.sender === currentUser.uid;
    container.className = 'messageContainer ' + (isMe ? 'sent' : 'received');
    container.dataset.msgId = msgId || '';

    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';

    // --- ADD SENDER NAME FOR GROUP CHATS ---
    if (selectedUser?.isGroup && !isMe) {
        const nameDiv = document.createElement('div');
        nameDiv.className = 'messageSenderName';
        // fallback to senderName field, else show UID
        nameDiv.textContent = msg.senderName || msg.sender || 'Unknown';
        nameDiv.style.fontWeight = '600';
        nameDiv.style.fontSize = '0.85em';
        nameDiv.style.marginBottom = '2px';
        nameDiv.style.color = '#c38bd6';
        container.appendChild(nameDiv);
    }

if (msg.deleted) {
    msgDiv.textContent = '*deleted message*';
    msgDiv.style.fontStyle = 'italic';
    msgDiv.style.color = '#aaa';
} else if (msg.text) {
    const parts = msg.text.split(/(https?:\/\/[^\s]+)/g);

    parts.forEach(part => {
        if (/^https?:\/\//.test(part)) {
            const link = document.createElement('a');
            link.textContent = part;
            link.style.color = '#4da6ff';
            link.style.textDecoration = 'underline';
            link.style.cursor = 'pointer'; // changes mouse pointer on hover

            link.addEventListener('click', e => {
                e.preventDefault();
                const urlToOpen = part;

                // Electron (preload API)
                if (window.electronAPI?.openExternal) {
                    window.electronAPI.openExternal(urlToOpen);
                } 
                // Electron (renderer with require)
                else if (window.require) {
                    const { shell } = require('electron');
                    shell.openExternal(urlToOpen);
                } 
                // Browser fallback
                else {
                    window.open(urlToOpen, '_blank');
                }
            });

            msgDiv.appendChild(link);
        } else {
            msgDiv.appendChild(document.createTextNode(part));
        }

        
    });
}


    container.appendChild(msgDiv);

    const timeDiv = document.createElement('div');
    timeDiv.className = 'messageTime';
    timeDiv.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    container.appendChild(timeDiv);

    chatMessages.appendChild(container);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(msgId, msg, container);
    });
}




// -------------------- Context menu: Remove / Copy / Report --------------------
function showContextMenu(msgId, msg, container) {
  // remove existing menus
  document.querySelectorAll('.contextMenuPopup').forEach(el => el.remove());

  const menu = document.createElement('div');
  menu.className = 'contextMenuPopup';
  menu.style.position = 'absolute';
  menu.style.background = '#222';
  menu.style.color = '#fff';
  menu.style.padding = '6px';
  menu.style.borderRadius = '6px';
  menu.style.zIndex = 30000;
  menu.style.minWidth = '120px';

  const top =
    (window.lastMouseEvent && window.lastMouseEvent.pageY) ||
    (container.getBoundingClientRect().top + window.scrollY);
  const left =
    (window.lastMouseEvent && window.lastMouseEvent.pageX) ||
    (container.getBoundingClientRect().left + window.scrollX);
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  // --- REMOVE ---
  if (msg.sender === currentUser.uid && !msg.deleted) {
    const remove = document.createElement('div');
    remove.textContent = 'Remove';
    remove.style.cursor = 'pointer';
    remove.style.padding = '4px 2px';
    remove.onclick = async () => {
      try {
        const el = chatMessages.querySelector(`[data-msg-id="${msgId}"]`);
        if (el) {
          const mDiv = el.querySelector('.message');
          if (mDiv) {
            mDiv.textContent = '*deleted message*';
            mDiv.style.fontStyle = 'italic';
            mDiv.style.color = '#aaa';
          }
        }
        msg.deleted = true;
        await db.collection('chats').doc(chatId).collection('messages').doc(msgId).update({ deleted: true });
        await updateLastPreviewForChat(chatId);
      } catch (err) {
        console.error('Remove failed', err);
      } finally {
        menu.remove();
      }
    };
    menu.appendChild(remove);
  }

  // --- COPY ---
  if (!msg.deleted) {
    const copy = document.createElement('div');
    copy.textContent = 'Copy';
    copy.style.cursor = 'pointer';
    copy.style.padding = '4px 2px';
    copy.onclick = () => {
      navigator.clipboard.writeText(msg.text || '');
      menu.remove();
    };
    menu.appendChild(copy);
  }

  // --- REPORT ---
  const report = document.createElement('div');
  report.textContent = 'Report';
  report.style.cursor = 'pointer';
  report.style.padding = '4px 2px';
  report.onclick = () => {
    const modal = document.getElementById('reportModal');
    const reasonInput = document.getElementById('reportReason');
    const submitBtn = document.getElementById('submitReport');
    const cancelBtn = document.getElementById('cancelReport');

    if (!modal || !reasonInput || !submitBtn || !cancelBtn) {
      console.error("Report modal elements not found in DOM");
      return;
    }

    reasonInput.value = '';
    modal.style.display = 'flex';

    submitBtn.replaceWith(submitBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));

    const newSubmitBtn = document.getElementById('submitReport');
    const newCancelBtn = document.getElementById('cancelReport');

    newCancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      reasonInput.value = '';
    }, { once: true });

    newSubmitBtn.addEventListener('click', async () => {
      const reason = reasonInput.value.trim();
      if (reason) {
        try {
          await db.collection('reports').add({
            chatId,
            msgId,
            reportedBy: currentUser.uid,
            messageText: msg.text || '',
            reason,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
          alert('Thank you, your report has been submitted.');
        } catch (err) {
          console.error('Report failed', err);
          alert('Failed to submit report.');
        }
      }
      modal.style.display = 'none';
      reasonInput.value = '';
    }, { once: true });
  };
  menu.appendChild(report);

  document.body.appendChild(menu);

  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 10);
}


  
  // -------------------- Friends & Groups listeners --------------------
  function listenToFriendsRealtime() {
    if (!currentUser) return;
  
    // friends (1-on-1 metadata)
    db.collection('friends').doc(currentUser.uid).collection('list')
      .onSnapshot(async snapshot => {
        for (const change of snapshot.docChanges()) {
          const friendUid = change.doc.id;
          const data = change.doc.data() || {};
          try {
            const prof = await db.collection('profiles').doc(friendUid).get();
            const profileData = prof.data() || {};
            friendsState[friendUid] = {
              uid: friendUid,
              data: profileData,
              latestMsg: data.lastMessage || '',
              lastChatTimestamp: data.lastChatTimestamp ? data.lastChatTimestamp.toMillis() : 0
            };
          } catch (e) {
            console.error('Profile fetch error', e);
          }
        }
        renderCombinedList();
      });
  
    // groups (chats where current user is member)
    db.collection('chats').where('members', 'array-contains', currentUser.uid)
      .onSnapshot(snapshot => {
        for (const change of snapshot.docChanges()) {
          const id = change.doc.id;
          const data = change.doc.data() || {};
          groupChatsState[id] = {
            chatId: id,
            name: data.name || 'Group',
            members: uniqueArray(data.members || []),
            lastChatTimestamp: data.lastChatTimestamp ? data.lastChatTimestamp.toMillis() : (data.createdAt ? data.createdAt.toMillis() : Date.now()),
            createdBy: data.createdBy || null,
            lastMessagePreview: data.lastMessagePreview || ''
          };
        }
        renderCombinedList();
        
      });
  }
  
  // -------------------- Render combined (friends + groups) --------------------
  function renderCombinedList() {
    if (!friendsListEl) return;
    const combined = [
      ...Object.values(friendsState),
      ...Object.values(groupChatsState).filter(g => g.members && g.members.includes(currentUser.uid))
    ].sort((a, b) => {
      const tA = a.lastChatTimestamp || 0;
      const tB = b.lastChatTimestamp || 0;
      if (tA === tB) {
        if (a.chatId && !b.chatId) return 1;
        if (!a.chatId && b.chatId) return -1;
      }
      return tB - tA;
    });
  
    friendsListEl.innerHTML = '';
    for (const item of combined) {
      if (item.chatId) renderOrUpdateGroup(item);
      else renderOrUpdateFriend(item.uid);
    }
  }
  
  // friend list item
  function renderOrUpdateFriend(friendUid) {
    const friend = friendsState[friendUid];
    if (!friend) return;
    let li = friendElements[friendUid];
    if (!li) {
      li = document.createElement('li');
      li.className = 'friend-item';
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '8px';
      li.style.cursor = 'pointer';
      li.addEventListener('click', (e) => { e.preventDefault(); startChat(friendUid); });
      li.addEventListener('contextmenu', (e) => { e.preventDefault(); openProfile(friendUid); });
      friendElements[friendUid] = li;
    }
    li.innerHTML = '';
    const avatar = document.createElement('div'); avatar.className = 'avatar'; setAvatar(avatar, friend.data.avatarUrl, friend.data.profileColor || '#444');
    avatar.style.width = '40px'; avatar.style.height = '40px'; avatar.style.borderRadius = '8px';
    const name = document.createElement('div'); name.className = 'friendName'; name.textContent = friend.data.displayName || 'Unknown'; name.style.color = '#fff'; name.style.fontWeight = '600';
    const latest = document.createElement('div'); latest.className = 'latestMsg'; latest.textContent = friend.latestMsg || ''; latest.style.color = '#aaa'; latest.style.fontSize = '0.8em';
    li.appendChild(avatar); li.appendChild(name); li.appendChild(latest);
    friendsListEl.appendChild(li);
  }
  
  function renderOrUpdateGroup(group) {
  let li = friendElements[group.chatId];
  if (!li) {
    li = document.createElement('li');
    li.className = 'group-item';
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.background = "#350a4642";
    li.style.gap = "10px";
    li.style.whiteSpace = "normal";
    li.style.maxHeight = "60px";
    li.style.cursor = 'pointer';
    li.addEventListener('click', (e) => { e.preventDefault(); startGroupChat(group.chatId); });
    friendElements[group.chatId] = li;
  }

  li.innerHTML = '';
  
  const avatar = document.createElement('div'); 
  avatar.className = 'avatar';
  avatar.style.width = '40px'; 
  avatar.style.height = '40px'; 
  avatar.style.borderRadius = '8px'; 
  avatar.style.backgroundColor = '#6a2c6f';

  const name = document.createElement('div'); 
  name.className = 'friendName';
  let groupName = group.name || 'Group Chat';
  // truncate to 9 characters
  if (groupName.length > 9) groupName = groupName.slice(0, 9) + '...';
  name.textContent = groupName;
  name.style.color = '#c38bd6'; 
  name.style.fontWeight = '700';

  const preview = document.createElement('div'); 
  preview.className = 'groupPreview';
  let lastMessage = group.lastMessagePreview || '';
  // truncate preview to 9 characters
  if (lastMessage.length > 9) lastMessage = lastMessage.slice(0, 9) + '...';
  preview.textContent = lastMessage;
  preview.style.color = '#aaa'; 
  preview.style.fontSize = '0.8em';

  li.appendChild(avatar); 
  li.appendChild(name); 
  li.appendChild(preview);

  friendsListEl.appendChild(li);
}

  
  // -------------------- Open profile --------------------
  function openProfile(uid) {
    db.collection('profiles').doc(uid).get().then(doc => {
      const data = doc.data() || {};
      selectedUser = { uid, ...data, isGroup: false };
      profileNameEl.textContent = data.displayName || 'Unknown';
      profileBioEl.textContent = data.bio || '';
      setAvatar(profileAvatarEl, data.avatarUrl, data.profileColor || '#000');
      showSection('profile');
    }).catch(console.error);
  }
  
  // -------------------- 1-on-1 chat --------------------
  async function startChat(uid, remember = true) {
    if (!currentUser || !uid) return;
    const newChatId = [currentUser.uid, uid].sort().join('_');
  
    if (chatId !== newChatId) {
      chatMessages.innerHTML = '';
      chatHeader.textContent = '...';
    }
  
    const profileSnap = await db.collection('profiles').doc(uid).get();
    const profileData = profileSnap.data() || {};
    selectedUser = { uid, ...profileData, isGroup: false };
    chatId = newChatId;
  
    if (remember) {
      localStorage.setItem('lastChatUid', uid);
      localStorage.removeItem('lastGroupChatId');
    }
  
    if (chatUnsubscribe) chatUnsubscribe();
  
   const rendered = new Set();

if (chatUnsubscribe) chatUnsubscribe();

chatUnsubscribe = db.collection('chats')
  .doc(chatId)
  .collection('messages')
  .orderBy('timestamp')
  .onSnapshot(snap => {
    snap.docChanges().forEach(change => {
      const msg = change.doc.data();
      const id = change.doc.id;

      if (change.type === 'added' && !rendered.has(id)) {
        renderMessage(msg, id, false);
        rendered.add(id);

      } else if (change.type === 'modified') {
        const el = chatMessages.querySelector(`[data-msg-id="${id}"]`);
        if (el) {
          const mDiv = el.querySelector('.message');
          mDiv.textContent = ''; // clear previous content
          mDiv.style.fontStyle = 'normal';
          mDiv.style.color = '';

          if (msg.deleted) {
            mDiv.textContent = '*deleted message*';
            mDiv.style.fontStyle = 'italic';
            mDiv.style.color = '#aaa';
          } else if (msg.text) {
            const parts = msg.text.split(/(https?:\/\/[^\s]+)/g);
            parts.forEach(part => {
              if (/^https?:\/\//.test(part)) {
                const link = document.createElement('a');
                link.textContent = part;
                link.href = '#';
                link.style.color = '#4da6ff';
                link.style.textDecoration = 'underline';
                link.addEventListener('click', e => {
                  e.preventDefault();
                  window.electronAPI.openExternal(part);
                });
                mDiv.appendChild(link);
              } else {
                mDiv.appendChild(document.createTextNode(part));
              }
            });
          }
        }

        if (msg.deleted) updateLastPreviewForChat(chatId);
      }
    });

    scrollChatToBottom();
  });

    chatHeader.textContent = selectedUser.displayName || 'Unknown';
    showSection('chat');
  
    // hide group-only UI
    createLeaveButtonIfMissing();
    createToggleMembersButtonIfMissing();
    if (leaveBtn) leaveBtn.style.display = 'none';
    if (toggleMembersBtn) toggleMembersBtn.style.display = 'none';
    hideGroupSidebar();
  
    // ensure input cleared and focused
    messageInput.value = '';
    messageInput.focus();
    charCounter.textContent = `0 / ${MAX_LENGTH}`;
  }
  
  // -------------------- Send message --------------------
  async function sendMessage(e) {
    if (e) e.preventDefault();
    if (!chatId || !currentUser) return;
    const text = messageInput.value.trim();
    if (!text || text.length > MAX_LENGTH) return;
  
    sendBtn.disabled = true;
    messageInput.disabled = true;
  
    try {
      const timestamp = firebase.firestore.FieldValue.serverTimestamp();
      const isGroup = selectedUser?.isGroup === true;
      const msgData = { sender: currentUser.uid, text, timestamp };
  
      if (isGroup) {
        // embed senderName for easier display later
        const profSnap = await db.collection('profiles').doc(currentUser.uid).get();
        msgData.senderName = (profSnap.exists && profSnap.data().displayName) ? profSnap.data().displayName : '';
      }
  
      await db.collection('chats').doc(chatId).collection('messages').add(msgData);
  
      if (isGroup) {
        await db.collection('chats').doc(chatId).update({ lastChatTimestamp: timestamp, lastMessagePreview: text.slice(0, 120) });
      } else {
        // update friend previews for both sides
        const parts = chatId.split('_');
        const other = parts[0] === currentUser.uid ? parts[1] : parts[0];
        await db.collection('friends').doc(currentUser.uid).collection('list').doc(other)
          .set({ lastMessage: text.slice(0, 20), lastChatTimestamp: timestamp }, { merge: true });
        await db.collection('friends').doc(other).collection('list').doc(currentUser.uid)
          .set({ lastMessage: text.slice(0, 20), lastChatTimestamp: timestamp }, { merge: true });
      }
  
      // reset input
      messageInput.value = '';
      charCounter.textContent = `0 / ${MAX_LENGTH}`;
    } catch (err) {
      console.error('sendMessage error', err);
      alert('Failed to send message');
    } finally {
      sendBtn.disabled = false;
      messageInput.disabled = false;
      messageInput.focus();
    }
  }
  
  // -------------------- Input autosize / char counter / focus on typing --------------------
  messageInput.addEventListener('input', () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 140) + 'px';
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
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  
  // global focus: if you start typing anywhere (and not inside input) focus input
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement && document.activeElement.tagName.toLowerCase();
    if (active !== 'input' && active !== 'textarea') {
      messageInput.focus();
    }
  });
  
  // -------------------- Navigation --------------------
  backToFriendsBtn?.addEventListener('click', () => { selectedUser = null; showSection('friends'); hideGroupSidebar(); });
  messageUserBtn?.addEventListener('click', () => { if (selectedUser && !selectedUser.isGroup) startChat(selectedUser.uid); });
  searchFriends?.addEventListener('input', () => {
    const term = searchFriends.value.toLowerCase();
    friendsListEl.querySelectorAll('li').forEach(li => {
      li.style.display = li.textContent.toLowerCase().includes(term) ? '' : 'none';
    });
  });
  

// -------------------- Auth handling & restore --------------------
auth.onAuthStateChanged(async (user) => {
  if (!user) return location.href = 'signin.html';
  currentUser = user;

  // ensure input starts empty and focused
  if (messageInput) { messageInput.value = ''; messageInput.focus(); }
  if (charCounter) charCounter.textContent = `0 / ${MAX_LENGTH}`;

  listenToFriendsRealtime();
  showSection('friends');

  const userRef = db.collection('profiles').doc(currentUser.uid);
  await userRef.set(
    { online: true, lastOnline: firebase.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  const lastChatUid = localStorage.getItem('lastChatUid'); // friend UID
  const lastGroupId = localStorage.getItem('lastGroupChatId'); // group chat ID

  // -------------------- Restore last private chat --------------------
  if (lastChatUid && lastChatUid !== currentUser.uid) {
    try {
      const friendDoc = await db.collection('friends')
        .doc(currentUser.uid)
        .collection('list')
        .doc(lastChatUid)
        .get();

      if (friendDoc.exists) {
        // Open chat with friend UID
        startChat(lastChatUid, false); // false = do not overwrite localStorage
      } else {
        localStorage.removeItem('lastChatUid'); // no longer a friend
      }
    } catch (err) {
      console.error('Failed to restore last private chat:', err);
      localStorage.removeItem('lastChatUid');
    }
  }
  // -------------------- Restore last group chat --------------------
  else if (lastGroupId) {
    try {
      const groupDoc = await db.collection('chats').doc(lastGroupId).get();
      if (groupDoc.exists) {
        const members = groupDoc.data().members || [];
        if (members.includes(currentUser.uid)) {
          startGroupChat(lastGroupId, false); // false = do not overwrite localStorage
        } else {
          localStorage.removeItem('lastGroupChatId'); // kicked
        }
      } else {
        localStorage.removeItem('lastGroupChatId'); // deleted
      }
    } catch (err) {
      console.error('Failed to restore last group chat:', err);
      localStorage.removeItem('lastGroupChatId');
    }
  }

  window.addEventListener('beforeunload', async () => {
    await userRef.set(
      { online: false, lastOnline: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  });
});



  
  // -------------------- ========== GROUPS ========== --------------------
  
  // Ensure UI elements exist and hidden initially
  (function initUI() {
    createLeaveButtonIfMissing();
    createToggleMembersButtonIfMissing();
    if (leaveBtn) leaveBtn.style.display = 'none';
    if (toggleMembersBtn) toggleMembersBtn.style.display = 'none';
    if (groupSidebar) groupSidebar.style.display = 'none';
  })();
  
  // open create group modal
  createGroupBtn?.addEventListener('click', openCreateGroupModal);
  function openCreateGroupModal() {
    if (!currentUser) return alert('Not signed in');
    if (!groupModal || !groupFriendsList) return;
    groupFriendsList.innerHTML = '';
    // show all friends except self
    const friends = Object.values(friendsState).filter(f => f.uid !== currentUser.uid);
    if (friends.length === 0) return alert('No friends to add!');
    friends.forEach(f => {
      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.color = '#fff';
      label.style.marginBottom = '6px';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = f.uid;
      cb.style.marginRight = '8px';
      label.appendChild(cb);
      label.appendChild(document.createTextNode(f.data.displayName || f.uid));
      groupFriendsList.appendChild(label);
    });
    groupModal.style.display = 'flex';
  }
  
  // modal buttons
  document.getElementById('createGroupCancelBtn')?.addEventListener('click', () => { if (groupModal) groupModal.style.display = 'none'; });
  document.getElementById('createGroupConfirmBtn')?.addEventListener('click', async () => {
    const name = (groupNameInput && groupNameInput.value.trim()) || '';
    if (!name) return alert('Enter a group name!');
    const boxes = Array.from(groupFriendsList.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    if (boxes.length === 0) return alert('Select at least one friend!');
    await createGroupChat(boxes, name);
    if (groupModal) groupModal.style.display = 'none';
    if (groupNameInput) groupNameInput.value = '';
  });
  
  async function createGroupChat(memberUids, groupName) {
    if (!currentUser) return;
    // dedupe and ensure current user included, max 20
    const members = uniqueArray([...memberUids, currentUser.uid]).slice(0, 20);
    try {
      const chatRef = await db.collection('chats').add({
        members,
        name: groupName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastChatTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: currentUser.uid,
        lastMessagePreview: ''
      });
  
      groupChatsState[chatRef.id] = {
        chatId: chatRef.id,
        name: groupName,
        members,
        lastChatTimestamp: Date.now(),
        createdBy: currentUser.uid,
        lastMessagePreview: ''
      };
  
      renderCombinedList();
      startGroupChat(chatRef.id);
    } catch (err) {
      console.error('createGroupChat fail', err);
      alert('Failed to create group chat.');
    }
  }
  
  // start group chat
  async function startGroupChat(chatIdParam) {
    if (!currentUser || !chatIdParam) return;
    chatMessages.innerHTML = '';
    chatHeader.textContent = '...';
  
    const chatDoc = await db.collection('chats').doc(chatIdParam).get();
    if (!chatDoc.exists) return alert('Group does not exist.');
    const data = chatDoc.data() || {};
  
    selectedUser = {
      isGroup: true,
      chatId: chatIdParam,
      displayName: data.name || 'Group Chat',
      members: uniqueArray(data.members || []),
      createdBy: data.createdBy || null
    };
    chatId = chatIdParam;
    localStorage.setItem('lastGroupChatId', chatIdParam);
    localStorage.removeItem('lastChatUid');
  
    chatHeader.textContent = selectedUser.displayName || 'Group Chat';
    showSection('chat');
  
    // show leave / toggle members only for group
    createLeaveButtonIfMissing();
    createToggleMembersButtonIfMissing();
    if (leaveBtn) leaveBtn.style.display = 'inline-block';
    if (toggleMembersBtn) toggleMembersBtn.style.display = 'inline-block';
  
    // leave action (only hides when user leaves)
    leaveBtn.onclick = async () => {
      if (!confirm('Leave this group?')) return;
      try {
        await db.collection('chats').doc(chatIdParam).update({ members: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
        // update local cache
        if (groupChatsState[chatIdParam]) groupChatsState[chatIdParam].members = groupChatsState[chatIdParam].members.filter(u => u !== currentUser.uid);
        selectedUser = null;
        chatId = null;
        chatMessages.innerHTML = '';
        chatHeader.textContent = '';
        leaveBtn.style.display = 'none';
        toggleMembersBtn.style.display = 'none';
        localStorage.removeItem('lastGroupChatId');
        renderCombinedList();
        showSection('friends');
        hideGroupSidebar();
      } catch (err) {
        console.error('leave failed', err);
        alert('Failed to leave group.');
      }
    };
  
    // wire add member button
    if (addMemberBtn) {
      try { addMemberBtn.removeEventListener('click', addMemberHandler); } catch(e) {}
      addMemberBtn.addEventListener('click', addMemberHandler);
    }
  
    // subscribe to messages in this group
    if (chatUnsubscribe) chatUnsubscribe();
    const rendered = new Set();
    chatUnsubscribe = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp')
  .onSnapshot(snap => {
    snap.docChanges().forEach(change => {
      const msg = change.doc.data();
      const id = change.doc.id;

      if (change.type === 'added' && !rendered.has(id)) {
        renderMessage(msg, id, false);
        rendered.add(id);

      // <-- Replace this block with the fixed one:
      } else if (change.type === 'modified') {
        const el = chatMessages.querySelector(`[data-msg-id="${id}"]`);
        if (el) {
          const mDiv = el.querySelector('.message');
          mDiv.textContent = ''; // clear previous content
          mDiv.style.fontStyle = 'normal';
          mDiv.style.color = '';

          if (msg.deleted) {
            mDiv.textContent = '*deleted message*';
            mDiv.style.fontStyle = 'italic';
            mDiv.style.color = '#aaa';
          } else if (msg.text) {
            const parts = msg.text.split(/(https?:\/\/[^\s]+)/g);
            parts.forEach(part => {
              if (/^https?:\/\//.test(part)) {
                const link = document.createElement('a');
                link.textContent = part;
                link.href = '#';
                link.style.color = '#4da6ff';
                link.style.textDecoration = 'underline';
                link.addEventListener('click', e => {
                  e.preventDefault();
                  window.electronAPI.openExternal(part);
                });
                mDiv.appendChild(link);
              } else {
                mDiv.appendChild(document.createTextNode(part));
              }
            });
          }
        }
        if (msg.deleted) updateLastPreviewForChat(chatId);
      }

    });
    scrollChatToBottom();
  });

  }
  
  // add member handler (any group member can add ANY friend from their list)
  async function addMemberHandler() {
    if (!selectedUser || !selectedUser.isGroup) return alert('No group selected');
    const query = (addMemberSearch && addMemberSearch.value.trim()) || '';
    if (!query) return alert('Enter friend name or uid to add');
    // search within your friendsState (displayName or uid)
    const candidates = Object.values(friendsState).filter(f => {
      const n = (f.data.displayName || '').toLowerCase();
      return f.uid === query || n.includes(query.toLowerCase());
    });
    if (candidates.length === 0) return alert('No matching friend found in your friends list');
    const toAdd = candidates[0].uid;
    // ensure not already member and max 20
    const chatRef = await db.collection('chats').doc(selectedUser.chatId).get();
    if (!chatRef.exists) return alert('Group not found');
    const data = chatRef.data() || {};
    const currentMembers = uniqueArray(data.members || []);
    if (currentMembers.includes(toAdd)) return alert('User already in group');
    if (currentMembers.length >= 20) return alert('Group max members (20) reached');
    try {
      await db.collection('chats').doc(selectedUser.chatId).update({ members: firebase.firestore.FieldValue.arrayUnion(toAdd) });
      // local updates
      if (groupChatsState[selectedUser.chatId]) groupChatsState[selectedUser.chatId].members.push(toAdd);
      selectedUser.members.push(toAdd);
      renderGroupMembers(selectedUser);
      addMemberSearch.value = '';
    } catch (err) {
      console.error('add member failed', err);
      alert('Failed to add member');
    }
  }
  
  // kick member (only creator)
// -------------------- Group member listener --------------------
let unsubscribeCurrentGroup = null;

function listenToGroupMembersSafe(chatId) {
    if (!chatId || !currentUser) return;

    // Unsubscribe previous listener
    if (unsubscribeCurrentGroup) unsubscribeCurrentGroup();

    const chatRef = db.collection('chats').doc(chatId);
    unsubscribeCurrentGroup = chatRef.onSnapshot(doc => {
        if (!doc.exists) return;

        const data = doc.data();
        const members = data.members || [];

        // If current user was kicked
        if (!members.includes(currentUser.uid)) {
            closeGroupChatUI();
            alert('You were removed from this group!');
            unsubscribeCurrentGroup(); // stop listening
            return;
        }

        // Update local state
        if (selectedUser && selectedUser.chatId === chatId) {
            selectedUser.members = members;
        }
        if (groupChatsState[chatId]) groupChatsState[chatId].members = members;

        // Render members
        if (typeof renderGroupMembers === 'function') {
            renderGroupMembers(selectedUser);
        }
    }, err => {
        console.error('Group member listener error:', err);
    });

    return unsubscribeCurrentGroup;
}



// -------------------- Kick member --------------------
async function kickMember(uidToKick) {
    if (!selectedUser || !selectedUser.isGroup) return;

    const chatRef = db.collection('chats').doc(selectedUser.chatId);
    const chatDoc = await chatRef.get();
    if (!chatDoc.exists) return alert('Group not found');

    const data = chatDoc.data() || {};
    if (data.createdBy !== currentUser.uid) return alert('Only the creator can kick.');
    if (!confirm('Kick this member?')) return;

    try {
        // Remove member from Firestore
        await chatRef.update({
            members: firebase.firestore.FieldValue.arrayRemove(uidToKick)
        });

        // Local update for the current client
        selectedUser.members = selectedUser.members.filter(u => u !== uidToKick);
        if (groupChatsState[selectedUser.chatId]) {
            groupChatsState[selectedUser.chatId].members = selectedUser.members;
        }

        renderGroupMembers(selectedUser);
        if (uidToKick !== currentUser.uid) alert('Member kicked successfully!');
    } catch (err) {
        console.error('Kick failed', err);
        alert('Failed to kick member.');
    }
}// works

// -------------------- Real-time member listener --------------------
function listenToGroupMembers(chatId) {
  const chatRef = db.collection('chats').doc(chatId);

  const unsubscribe = chatRef.onSnapshot(doc => {
      if (!doc.exists) return;

      const data = doc.data();
      const members = data.members || [];

      // ✅ Update local state
      if (selectedUser && selectedUser.chatId === chatId) {
          selectedUser.members = members;
      }
      if (groupChatsState[chatId]) {
          groupChatsState[chatId].members = members;
      }

      // ✅ Re-render members for everyone
      if (typeof renderGroupMembers === 'function') {
          renderGroupMembers(selectedUser);
      }

      // ✅ If current user was kicked, close UI and stop listening
      if (!members.includes(currentUser.uid)) {
          closeGroupChatUI();

          // Unsubscribe from this snapshot so they don’t keep getting updates
          unsubscribe();

          alert('You were removed from the group!');
      }
  });

  // Return unsubscribe so caller can stop it manually too
  return unsubscribe;
}

// -------------------- Usage --------------------
// Call this once when opening a group chat
if (selectedUser && selectedUser.isGroup) {
    listenToGroupMembers(selectedUser.chatId);
}


// -------------------- Close UI helper --------------------
function closeGroupChatUI() {
  selectedUser = null;
  chatId = null;
  chatMessages.innerHTML = '';
  chatHeader.textContent = '';
  if (leaveBtn) leaveBtn.style.display = 'none';
  if (toggleMembersBtn) toggleMembersBtn.style.display = 'none';
  hideGroupSidebar();
  localStorage.removeItem('lastGroupChatId');
  showSection('friends');
  renderCombinedList();
}


// Firestore reference
const groupRef = db.collection("groups").doc(groupId);

// Listen for member updates
groupRef.onSnapshot((doc) => {
    if (!doc.exists) return;
    const data = doc.data();
    const members = data.members || [];

    // Remove kicked user from the UI instantly
    renderGroupMembers(members);

    // If current user was kicked, auto-close chat
    if (!members.includes(currentUser.uid)) {
        closeGroupChat(); // Hide chat UI, maybe alert the user
    }
});


function openGroupChat(groupId) {
    // Unsubscribe previous listener
    if (unsubscribeGroupListener) unsubscribeGroupListener();

    const groupRef = db.collection('chats').doc(groupId);

    unsubscribeGroupListener = groupRef.onSnapshot(doc => {
        try {
            if (!doc.exists) return;

            const data = doc.data();
            const members = data.members || [];

            console.log('Group snapshot:', groupId, members);

            // If current user is removed
            if (!members.includes(currentUser.uid)) {
                closeGroupChatUI();
                alert('You were removed from this group.');
                return;
            }

            // If no selected user or different chat
            if (!selectedUser || selectedUser.chatId !== groupId) {
                console.log('Selected user not matching groupId, skipping render.');
                return;
            }

            // Update local state
            selectedUser.members = members;
            if (groupChatsState[groupId]) groupChatsState[groupId].members = members;

            // Render members
            if (typeof renderGroupMembers === 'function') {
                renderGroupMembers({
                    members: members,
                    createdBy: data.createdBy
                });
            } else {
                console.error('renderGroupMembers is not a function or missing!');
            }
        } catch (err) {
            console.error('Error in group chat listener:', err);
        }
    }, err => {
        console.error('Firestore onSnapshot error:', err);
    });
}



  
  // -------------------- Group sidebar UI --------------------
  function showGroupSidebar(group) {
    if (!group || !group.chatId) {
      if (groupSidebar) groupSidebar.style.display = 'none';
      return;
    }
    renderGroupMembers(group);
    if (!groupSidebar) return;
    // position to right-middle, square-ish
    groupSidebar.style.display = 'flex';
    groupSidebar.style.position = 'fixed';
    groupSidebar.style.top = '50%';
    groupSidebar.style.right = '29%';
    groupSidebar.style.transform = 'translateY(-50%)';
    groupSidebar.style.width = '360px';
    groupSidebar.style.maxHeight = '75vh';
    groupSidebar.style.background = '#000000';
    groupSidebar.style.padding = '12px';
    groupSidebar.style.borderRadius = '10px'; // rounded corners
    groupSidebar.style.borderColor = 'purple';   // border color
    groupSidebar.style.borderStyle = 'solid'; // you also need a border style for color to show
    groupSidebar.style.borderWidth = '1px';   // optional: set border width
    groupSidebar.style.boxShadow = '0 10px 40px rgba(120, 37, 131, 0.37)';
    groupSidebar.style.flexDirection = 'column';
    groupSidebar.style.overflow = 'hidden';
    groupMembersList.style.overflowY = 'auto';
    groupMembersList.style.maxHeight = 'calc(75vh - 120px)';
    groupMembersList.style.padding = '6px';
    // hide native scrollbar for firefox + IE
    groupMembersList.style.scrollbarWidth = 'none';
    groupMembersList.style.msOverflowStyle = 'none';
    // add close X
    let closeX = groupSidebar.querySelector('.sidebar-close-x');
    if (!closeX) {
      closeX = document.createElement('button');
      closeX.className = 'sidebar-close-x';
      closeX.textContent = '✕';
      closeX.title = 'Close';
      closeX.style.position = 'absolute';
      closeX.style.top = '8px';
      closeX.style.right = '8px';
      closeX.style.background = 'transparent';
      closeX.style.color = '#fff';
      closeX.style.border = 'none';
      closeX.style.fontSize = '16px';
      closeX.style.cursor = 'pointer';
      closeX.style.zIndex = '4000';
      groupSidebar.appendChild(closeX);
      closeX.addEventListener('click', hideGroupSidebar);
      hideGroupSidebar();
    }
    // ensure add section visible
    const addSection = document.getElementById('addMemberSection');
    if (addSection) {
      addSection.style.display = 'flex';
      addSection.style.marginTop = '8px';
      addSection.style.gap = '6px';
    }
    // ensure leave & toggle are visible (handled in startGroupChat)
  }
  
// hide sidebar on page load
document.addEventListener('DOMContentLoaded', () => {
    hideGroupSidebar();
});
  function hideGroupSidebar() {
    if (groupSidebar) groupSidebar.style.display = 'none';
  }


  // render members (deduped)
async function renderGroupMembers(group) {
    if (!group || !Array.isArray(group.members) || !groupMembersList) return;
    groupMembersList.innerHTML = '';

    const members = [...new Set(group.members)];

    for (const uid of members) {
        let displayName = uid, avatarUrl = null;
        if (friendsState[uid]) {
            const f = friendsState[uid].data;
            displayName = f.displayName || uid;
            avatarUrl = f.avatarUrl || null;
        } else {
            try {
                const p = await db.collection('profiles').doc(uid).get();
                if (p.exists) { displayName = p.data().displayName || uid; avatarUrl = p.data().avatarUrl || null; }
            } catch(e) { console.error('Failed profile fetch', uid, e); }
        }

        const canKick = group.createdBy === currentUser.uid && uid !== currentUser.uid;
        const li = makeMemberListItem(uid, displayName, avatarUrl, canKick, kickMember);
        groupMembersList.appendChild(li);
    }
}

  function makeMemberListItem(uid, displayName, avatarUrl, canKick = false, onKick = null) {
    const li = document.createElement('li');
    li.className = 'member-item';
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '8px';
    li.style.padding = '6px 2px';
    li.style.borderBottom = '1px solid rgba(255,255,255,0.03)';

    const av = document.createElement('div');
    av.style.width = '40px'; av.style.height = '40px'; av.style.borderRadius = '8px';
    setAvatar(av, avatarUrl, '#6a2c6f');

    const nameDiv = document.createElement('div');
    nameDiv.textContent = displayName; nameDiv.style.color = '#fff'; nameDiv.style.fontWeight = '600';
    nameDiv.style.flex = '1';

    li.appendChild(av);
    li.appendChild(nameDiv);

    if (canKick && onKick) {
        const btn = document.createElement('button');
        btn.textContent = 'Kick';
        btn.style.background = 'red';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.padding = '4px 8px';
        btn.style.cursor = 'pointer';
        btn.onclick = () => onKick(uid);
        li.appendChild(btn);
    }

    return li;
}

  
  // -------------------- Update last preview after deletion --------------------
  async function updateLastPreviewForChat(chatIdToUpdate) {
    if (!chatIdToUpdate) return;
    try {
      const msgsSnap = await db.collection('chats').doc(chatIdToUpdate).collection('messages').orderBy('timestamp', 'desc').get();
      let found = false;
      for (const doc of msgsSnap.docs) {
        const m = doc.data();
        if (!m.deleted && m.text && m.text.trim()) {
          const preview = m.text.slice(0, 120);
          // if chatId looks like "uid1_uid2" treat as 1-on-1 and update friends entries
          const parts = chatIdToUpdate.split('_');
          if (parts.length === 2) {
            const other = parts[0] === currentUser.uid ? parts[1] : parts[0];
            await db.collection('friends').doc(currentUser.uid).collection('list').doc(other)
              .set({ lastMessage: preview.slice(0,20), lastChatTimestamp: m.timestamp || firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            await db.collection('friends').doc(other).collection('list').doc(currentUser.uid)
              .set({ lastMessage: preview.slice(0,20), lastChatTimestamp: m.timestamp || firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          } else {
            // group: update chats doc preview
            await db.collection('chats').doc(chatIdToUpdate).update({ lastMessagePreview: preview });
          }
          found = true;
          break;
        }
      }
      if (!found) {
        // no messages left -> clear preview
        const parts = chatIdToUpdate.split('_');
        if (parts.length === 2) {
          const other = parts[0] === currentUser.uid ? parts[1] : parts[0];
          await db.collection('friends').doc(currentUser.uid).collection('list').doc(other)
            .set({ lastMessage: '', lastChatTimestamp: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
          await db.collection('friends').doc(other).collection('list').doc(currentUser.uid)
            .set({ lastMessage: '', lastChatTimestamp: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
        } else {
          await db.collection('chats').doc(chatIdToUpdate).update({ lastMessagePreview: '' }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('updateLastPreviewForChat error', err);
    }
  }
  
  

  // Force hide any element with id "groupSidebar" on page load
window.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.getElementById('groupSidebar');
    if (sidebar) {
        sidebar.style.display = 'none';
    }
});

function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}


 // FIXA REFRESH FOR KICKED USER!! 

   // -------------------- End of script --------------------


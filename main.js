// --- CONFIG + INIT ---
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

// --- DOM ELEMENTS ---
const editorColor = document.getElementById('avatarColorPicker');
const usernameDisplay = document.getElementById('usernameDisplay');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const logoutBtn = document.getElementById('logoutBtn');
const profileBtn = document.getElementById('showProfileBtn');
const inviteBtn = document.getElementById('inviteBtn');

const usersUl = document.getElementById('usersUl');
const profileModal = document.getElementById('profileModal');
const profileNameDisplay = document.getElementById('profileName');
const profileBioDisplay = document.getElementById('profileBio');
const profileAvatar = document.getElementById('profileAvatar');
const profileCloseBtn = document.getElementById('profileCloseBtn');

const editorModal = document.getElementById('profileEditor');
const editorName = document.getElementById('editorName');
const editorBio = document.getElementById('editorBio');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const editorCloseBtn = document.getElementById('editorCloseBtn');

const searchInput = document.getElementById('searchInput');
const friendsList = document.getElementById('friendsList');
const friendRequestsList = document.getElementById('friendRequestsList');

let currentUser;
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
let allOnlineUsers = [];
let renderVersion = 0;

// --- UI helpers ---
settingsBtn.addEventListener('click', () => settingsMenu.classList.toggle('hidden'));
document.addEventListener('click', e => {
  if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
    settingsMenu.classList.add('hidden');
  }
});
profileCloseBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
editorCloseBtn.addEventListener('click', () => editorModal.classList.add('hidden'));

// --- FIRESTORE HELPERS ---
function tsToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (typeof ts === 'number') return ts;
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? null : parsed;
}

function setUserPresence(user, state) {
  return db.collection('status').doc(user.uid).set({
    state,
    lastChanged: firebase.firestore.FieldValue.serverTimestamp(),
    displayName: user.displayName || user.email || 'User',
    email: user.email,
    profileColor: user.profileColor || '#000000'
  }, { merge: true });
}

function ensureUserProfile(user) {
  const ref = db.collection('profiles').doc(user.uid);
  ref.get().then(doc => {
    if (!doc.exists) {
      ref.set({
        displayName: user.displayName || user.email || 'User',
        bio: '',
        profileColor: editorColor?.value || '#111211'
      });
    }
  }).catch(console.error);
}

// --- ONLINE USERS ---
function listenUsersList() {
  return db.collection('status').onSnapshot(snapshot => {
    const now = Date.now();
    const usersMap = new Map();

    snapshot.forEach(doc => {
      const d = doc.data() || {};
      const lastMillis = tsToMillis(d.lastChanged);
      const isOnline = (d.state === 'online') &&
        (lastMillis === null ? true : ((now - lastMillis) < ONLINE_THRESHOLD_MS));
      if (!isOnline) return;
      usersMap.set(doc.id, {
        uid: doc.id,
        displayName: d.displayName || 'Unknown',
        profileColor: d.profileColor || '#000000',
        lastChanged: lastMillis
      });
    });

    const arr = Array.from(usersMap.values());
    arr.sort((a, b) => {
      if (a.lastChanged && b.lastChanged) return b.lastChanged - a.lastChanged;
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    allOnlineUsers = arr;
    renderUsers(allOnlineUsers);
  }, err => console.error('listenUsersList error', err));
}

async function renderUsers(users) {
  renderVersion++;
  const version = renderVersion;
  usersUl.innerHTML = ''; // clear immediately

  if (!users || users.length === 0) {
    usersUl.innerHTML = '<li>No users online</li>';
    return;
  }

  const seenUids = new Set();
  const usersToRender = [];

  // Pre-fetch all profiles first
  for (const user of users) {
    if (seenUids.has(user.uid)) continue;
    seenUids.add(user.uid);

    let profileData = {};
    try {
      const doc = await db.collection('profiles').doc(user.uid).get();
      profileData = doc.exists ? doc.data() : {};
    } catch (err) { console.warn(err); }

    usersToRender.push({
      uid: user.uid,
      displayName: profileData.displayName || user.displayName || 'Unknown',
      profileColor: profileData.profileColor || user.profileColor || '#000000',
      avatarUrl: profileData.avatarUrl || '',
      bio: profileData.bio || '',
      tag: profileData.tag || ''
    });
  }

  // Render all rows
  for (const user of usersToRender) {
    if (version !== renderVersion) return; // cancel outdated render

    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.justifyContent = 'center';
    li.style.padding = '6px 0';

    const userRow = document.createElement('div');
    userRow.className = 'userRow';
    userRow.dataset.uid = user.uid;
    userRow.style.display = 'flex';
    userRow.style.alignItems = 'center';
    userRow.style.gap = '10px';
    userRow.style.cursor = 'pointer';
    userRow.style.width = '100%';
    userRow.style.maxWidth = '420px';

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar';
    avatarDiv.style.width = '32px';
    avatarDiv.style.height = '32px';
    avatarDiv.style.borderRadius = '50%';
    avatarDiv.style.display = 'flex';
    avatarDiv.style.justifyContent = 'center';
    avatarDiv.style.alignItems = 'center';
    avatarDiv.style.background = user.avatarUrl ? 'none' : user.profileColor;
    avatarDiv.style.color = '#fff';
    avatarDiv.style.fontWeight = 'bold';
    avatarDiv.style.flex = '0 0 32px';
    avatarDiv.style.overflow = 'hidden';
    if (user.avatarUrl) {
      avatarDiv.innerHTML = `<img src="${user.avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      avatarDiv.textContent = user.displayName.charAt(0).toUpperCase();
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = (user.uid === currentUser.uid ? user.displayName + ' (You)' : user.displayName);
    nameSpan.style.flex = '1';

    userRow.appendChild(avatarDiv);
    userRow.appendChild(nameSpan);
    li.appendChild(userRow);
    usersUl.appendChild(li);

    // Click handler for showing profile
    userRow.onclick = () => {
      if (user.uid === currentUser.uid) return; // optional: don't show own profile
      showFriendProfile(user);
    };
  }
}


// --- USER ROW EVENTS ---
usersUl.addEventListener('click', async (e) => {
  const row = e.target.closest('.userRow');
  if (!row) return;

  const uid = row.dataset.uid;
  if (!uid) return;

  if (e.target.matches('.viewBtn')) {
    const doc = await db.collection('profiles').doc(uid).get();
    const p = doc.data() || {};
    profileNameDisplay.textContent = p.displayName || '—';
    profileBioDisplay.textContent = p.bio || 'No bio provided.';
    document.getElementById('profileTag').textContent = p.tag || 'Unknown';

    if (p.avatarUrl) {
      profileAvatar.innerHTML = `<img src="${p.avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      profileAvatar.style.background = 'none';
    } else {
      profileAvatar.textContent = (p.displayName || 'U').charAt(0).toUpperCase();
      profileAvatar.style.background = p.profileColor || '#000000';
    }

    profileModal.classList.remove('hidden');
    return;
  }

  if (e.target.matches('.addBtn')) {
    if (uid === currentUser.uid) return alert("Can't add yourself.");
    const alreadyFriends = await areUsersFriends(currentUser.uid, uid);
    if (alreadyFriends) return alert("You are already friends.");
    const ref = db.collection('friendRequests').doc(uid).collection('requests').doc(currentUser.uid);
    const snap = await ref.get();
    if (snap.exists) return alert("Request already sent.");
    await ref.set({
      from: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email,
      sentAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Request sent!");
    return;
  }

  const actions = row.querySelector('.profileActions');
  if (actions) actions.classList.toggle('hidden');
});

// --- FRIENDS SYSTEM ---
async function areUsersFriends(uid1, uid2) {
  try {
    const doc = await db.collection('friends').doc(uid1).collection('list').doc(uid2).get();
    return doc.exists;
  } catch (err) { console.error(err); return false; }
}

function listenToFriendRequests() {
  if (!currentUser) return;
  db.collection('friendRequests').doc(currentUser.uid).collection('requests')
    .onSnapshot(snapshot => {
      friendRequestsList.innerHTML = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement('li');
        li.innerHTML = `${data.displayName} <button data-uid="${doc.id}" class="acceptBtn">Accept</button> <button data-uid="${doc.id}" class="declineBtn">Decline</button>`;
        friendRequestsList.appendChild(li);
      });

      document.querySelectorAll('.acceptBtn').forEach(btn => {
        btn.onclick = async () => {
          const otherUid = btn.dataset.uid;
          if (otherUid === currentUser.uid) return;
          await Promise.all([
            db.collection('friends').doc(currentUser.uid).collection('list').doc(otherUid).set({ addedAt: firebase.firestore.FieldValue.serverTimestamp() }),
            db.collection('friends').doc(otherUid).collection('list').doc(currentUser.uid).set({ addedAt: firebase.firestore.FieldValue.serverTimestamp() }),
            db.collection('friendRequests').doc(currentUser.uid).collection('requests').doc(otherUid).delete()
          ]);
          alert("Friend request accepted!");
          listenToFriends();
        };
      });

      document.querySelectorAll('.declineBtn').forEach(btn => {
        btn.onclick = async () => {
          const otherUid = btn.dataset.uid;
          await db.collection('friendRequests').doc(currentUser.uid).collection('requests').doc(otherUid).delete();
          alert("Request declined.");
        };
      });
    });
}

function listenToFriends() {
  if (!currentUser) return;
  db.collection('friends').doc(currentUser.uid).collection('list').onSnapshot(async snapshot => {
    friendsList.innerHTML = '';
    if (snapshot.empty) {
      friendsList.innerHTML = '<li>No friends yet</li>';
      return;
    }

    for (const doc of snapshot.docs) {
      const friendUid = doc.id;
      try {
        const profileDoc = await db.collection('profiles').doc(friendUid).get();
        const data = profileDoc.data() || {};
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.justifyContent = 'center';
        li.style.gap = '10px';
        li.style.padding = '6px 0';
        const info = document.createElement('div');
        info.style.display = 'flex';
        info.style.alignItems = 'center';
        info.style.gap = '10px';
        info.style.cursor = 'pointer';
        info.onclick = () => showFriendProfile({ ...data, uid: friendUid });
        const avatar = document.createElement('div');
        avatar.style.width = '32px';
        avatar.style.height = '32px';
        avatar.style.borderRadius = '50%';
        avatar.style.display = 'flex';
        avatar.style.justifyContent = 'center';
        avatar.style.alignItems = 'center';
        avatar.style.background = data.profileColor || '#000000';
        avatar.style.color = '#fff';
        avatar.style.fontWeight = 'bold';
        avatar.textContent = data.avatarUrl ? '' : (data.displayName || 'U').charAt(0).toUpperCase();
        if (data.avatarUrl) avatar.innerHTML = `<img src="${data.avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        const nameSpan = document.createElement('span');
        nameSpan.textContent = data.displayName || 'Unknown';
        info.appendChild(avatar);
        info.appendChild(nameSpan);
        li.appendChild(info);
        friendsList.appendChild(li);
      } catch(err) { console.warn(err); }
    }
  });
}

// --- PROFILE EDITOR ---
profileBtn.addEventListener('click', () => {
  if (!currentUser) return;
  db.collection('profiles').doc(currentUser.uid).get().then(doc => {
    const p = doc.data() || {};
    editorName.value = p.displayName || '';
    editorBio.value = p.bio || '';
    editorColor.value = p.profileColor || '#111211';
    editorModal.classList.remove('hidden');
  });
});

saveProfileBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  const data = {
    displayName: editorName.value.trim() || undefined,
    bio: editorBio.value.trim() || undefined,
    profileColor: editorColor.value,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  await db.collection('profiles').doc(currentUser.uid).set(data, { merge: true });
  if (data.displayName) {
    await currentUser.updateProfile({ displayName: data.displayName }).catch(console.warn);
    usernameDisplay.textContent = data.displayName;
  }
  document.querySelectorAll('.userRow').forEach(row => {
    if (row.dataset.uid === currentUser.uid) {
      const avatarDiv = row.querySelector('.avatar');
      if (avatarDiv) avatarDiv.style.background = data.profileColor;
    }
  });
  editorModal.classList.add('hidden');
});

// --- AUTH & PRESENCE ---
auth.onAuthStateChanged(user => {
  if (!user) return location.href = 'signin.html';
  currentUser = user;
  usernameDisplay.textContent = user.displayName || user.email || 'User';
  ensureUserProfile(user);
  setUserPresence(user, 'online').catch(console.warn);
  listenUsersList();
  listenToFriendRequests();
  listenToFriends();

  const interval = setInterval(() => setUserPresence(user, 'online').catch(console.warn), 30000);
  window.addEventListener('beforeunload', () => {
    try { setUserPresence(user, 'offline'); } catch {} finally { clearInterval(interval); }
  }, { once: true });
});

logoutBtn.addEventListener('click', () => auth.signOut().then(() => location.href = 'signin.html'));

// --- INVITE ---
inviteBtn.addEventListener('click', () => {
  const linkToCopy = 'https://hyztax.github.io/Velox';
  const tempInput = document.createElement('input');
  tempInput.value = linkToCopy;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  alert('Successfully copied link!');
  document.body.removeChild(tempInput);
});

// --- SEARCH ONLINE USERS ---
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return renderUsers(allOnlineUsers);
  const filtered = allOnlineUsers.filter(u => (u.displayName||'').toLowerCase().includes(query));
  renderUsers(filtered);
});

// --- EDITOR COLOR PICKER ---
if (editorColor) editorColor.addEventListener('input', async () => {
  if (!currentUser) return;
  await db.collection('profiles').doc(currentUser.uid).set({ profileColor: editorColor.value }, { merge: true });
  document.querySelectorAll('.userRow').forEach(row => {
    if (row.dataset.uid === currentUser.uid) {
      const avatarDiv = row.querySelector('.avatar');
      if (avatarDiv) avatarDiv.style.background = editorColor.value;
    }
  });
});



// --- show friend profile -----//
async function showFriendProfile(friend) {
  profileNameDisplay.textContent = friend.displayName || 'Unknown';
  profileBioDisplay.textContent = friend.bio || 'No bio provided.';

  // Member since / OG user
  const profileTagEl = document.getElementById('profileTag');
  if (friend.joinedAt) {
    const date = friend.joinedAt.toDate ? friend.joinedAt.toDate() : new Date(friend.joinedAt);
    profileTagEl.textContent = `Member since ${date.toLocaleDateString()}`;
  } else {
    profileTagEl.textContent = 'OG user';
  }

  // Avatar
  profileAvatar.innerHTML = '';
  const firstLetter = (friend.displayName || 'U').charAt(0).toUpperCase();
  if (friend.avatarUrl) {
    profileAvatar.innerHTML = `<img src="${friend.avatarUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  } else {
    profileAvatar.textContent = firstLetter;
    profileAvatar.style.background = friend.profileColor || '#000000';
  }

  // --- MUTUAL FRIENDS ---
  const mutualEl = document.getElementById('mutualFriendsCount');
  try {
    const currentUserFriendsSnap = await db.collection('friends').doc(currentUser.uid).collection('list').get();
    const friendFriendsSnap = await db.collection('friends').doc(friend.uid).collection('list').get();

    const currentUserFriendIds = new Set(currentUserFriendsSnap.docs.map(d => d.id));
    const friendFriendIds = new Set(friendFriendsSnap.docs.map(d => d.id));

    let mutualCount = 0;
    friendFriendIds.forEach(id => {
      if (currentUserFriendIds.has(id)) mutualCount++;
    });

    mutualEl.textContent = `Mutual friends: ${mutualCount}`;
  } catch (err) {
    console.warn('Error calculating mutual friends:', err);
    mutualEl.textContent = `Mutual friends: 0`;
  }

  // Buttons container
  const actionsContainer = document.getElementById('profileActions');
  actionsContainer.innerHTML = ''; // Clear old buttons

  if (friend.uid === currentUser.uid) {
    // No buttons for yourself
  } else {
    const areFriends = await areUsersFriends(currentUser.uid, friend.uid);

    if (areFriends) {
      // Message button
      const msgBtn = document.createElement('button');
      msgBtn.textContent = 'Message';
      msgBtn.className = 'messageBtn';
      msgBtn.onclick = () => {
        localStorage.setItem('chatWith', friend.uid);
        window.location.href = 'chat.html';
      };
      actionsContainer.appendChild(msgBtn);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.textContent = 'Remove';
      removeBtn.className = 'removeFriendBtn';
      removeBtn.onclick = async () => {
        await db.collection('friends').doc(currentUser.uid).collection('list').doc(friend.uid).delete();
        await db.collection('friends').doc(friend.uid).collection('list').doc(currentUser.uid).delete();
        alert('Friend removed.');
        showFriendProfile(friend); // Refresh buttons
        listenToFriends();
      };
      actionsContainer.appendChild(removeBtn);

    } else {
      // Add Friend button
      const addBtn = document.createElement('button');
      addBtn.textContent = 'Add Friend';
      addBtn.className = 'addFriendBtn';
      addBtn.onclick = async () => {
        const ref = db.collection('friendRequests').doc(friend.uid).collection('requests').doc(currentUser.uid);
        const snap = await ref.get();
        if (!snap.exists) {
          await ref.set({
            from: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email,
            sentAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          alert('Friend request sent!');
          showFriendProfile(friend);
        } else {
          alert('Request already sent.');
        }
      };
      actionsContainer.appendChild(addBtn);
    }
  }

  profileModal.classList.remove('hidden');
}

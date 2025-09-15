// --- CONFIG + INIT (unchanged) ---
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

// --- DOM ELEMENTS (unchanged) ---
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

// --- UI small helpers ---
settingsBtn.addEventListener('click', () => settingsMenu.classList.toggle('hidden'));
document.addEventListener('click', e => {
  if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
    settingsMenu.classList.add('hidden');
  }
});
profileCloseBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
editorCloseBtn.addEventListener('click', () => editorModal.classList.add('hidden'));

// --- PRESENCE helpers ---
function setUserPresence(user, state) {
  // If you want to store a reliable displayName/color in status doc, keep those values,
  // but real presence should ideally be implemented with Realtime DB + onDisconnect.
  return db.collection('status').doc(user.uid).set({
    state,
    lastChanged: firebase.firestore.FieldValue.serverTimestamp(),
    displayName: user.displayName || user.email || 'User',
    email: user.email,
    profileColor: (user.profileColor || '#000000')
  }, { merge: true });
}

function ensureUserProfile(user) {
  const ref = db.collection('profiles').doc(user.uid);
  ref.get().then(doc => {
    if (!doc.exists) {
      ref.set({
        displayName: user.displayName || user.email || 'User',
        bio: '',
        profileColor: editorColor?.value || '#00ff00'
      });
    }
  }).catch(console.error);
}

// Safe helper to get timestamp millis from Firestore field that might be missing or a Timestamp
function tsToMillis(ts) {
  if (!ts) return null;
  // If it's a Firestore Timestamp object
  if (typeof ts.toDate === 'function') {
    return ts.toDate().getTime();
  }
  // If it's already a number (unlikely with serverTimestamp, but be safe)
  if (typeof ts === 'number') return ts;
  // Try Date parse as last resort
  const parsed = Date.parse(ts);
  return isNaN(parsed) ? null : parsed;
}

// --- RENDER USERS (improved) ---
async function renderUsers(users) {
  usersUl.innerHTML = '';

  if (!users || users.length === 0) {
    usersUl.innerHTML = '<li>No users online</li>';
    return;
  }

  // Sort users alphabetically by displayName (stable)
  users.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  for (const user of users) {
    // Try to fetch richer profile data, but fall back to status doc values
    let profileData = {};
    try {
      const doc = await db.collection('profiles').doc(user.uid).get();
      profileData = doc.exists ? (doc.data() || {}) : {};
    } catch (err) {
      console.warn('Failed to fetch profile for', user.uid, err);
    }

    const displayName = profileData.displayName || user.displayName || 'Unknown';
    const profileColor = profileData.profileColor || user.profileColor || '#000000';
    const avatarUrl = profileData.avatarUrl || '';

    const li = document.createElement('li');
    li.style.padding = '6px 0';
    li.style.display = 'flex';
    li.style.justifyContent = 'center';

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
    avatarDiv.style.background = avatarUrl ? 'none' : profileColor;
    avatarDiv.style.color = '#fff';
    avatarDiv.style.fontWeight = 'bold';
    avatarDiv.style.flex = '0 0 32px';
    avatarDiv.style.overflow = 'hidden';

    if (avatarUrl) {
      avatarDiv.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      avatarDiv.textContent = (displayName || 'U').charAt(0).toUpperCase();
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = displayName;
    nameSpan.style.flex = '1';

    // actions (hidden by default)
    const profileActions = document.createElement('div');
    profileActions.className = 'profileActions hidden';
    profileActions.dataset.uid = user.uid;
    profileActions.style.marginLeft = 'auto';
    profileActions.innerHTML = `<button class="viewBtn">👁 View</button> <button class="addBtn">➕ Add</button>`;

    userRow.appendChild(avatarDiv);
    userRow.appendChild(nameSpan);
    userRow.appendChild(profileActions);

    li.appendChild(userRow);
    usersUl.appendChild(li);
  }
}

// --- EVENT DELEGATION for user rows (replaces attachUserRowEvents) ---
usersUl.addEventListener('click', async (e) => {
  const row = e.target.closest('.userRow');
  if (!row) return;

  // Clicked a specific button?
  if (e.target.matches('.viewBtn')) {
    const uid = e.target.parentElement.dataset.uid;
    if (!uid) return;
    const doc = await db.collection('profiles').doc(uid).get();
    const p = doc.data() || {};
    const displayName = p.displayName || '—';
    const avatarUrl = p.avatarUrl || '';
    const firstLetter = displayName.charAt(0).toUpperCase();

    profileNameDisplay.textContent = displayName;
    profileBioDisplay.textContent = p.bio || 'No bio provided.';
    document.getElementById('profileTag').textContent = p.tag || 'Unknown';

    if (avatarUrl) {
      profileAvatar.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
      profileAvatar.style.background = 'none';
    } else {
      profileAvatar.textContent = firstLetter;
      profileAvatar.style.background = p.profileColor || '#000000';
    }

    profileAvatar.style.margin = '0 auto';
    profileAvatar.style.display = 'flex';
    profileAvatar.style.justifyContent = 'center';
    profileAvatar.style.alignItems = 'center';
    profileNameDisplay.style.textAlign = 'center';
    profileBioDisplay.style.textAlign = 'center';
    document.getElementById('profileTag').style.textAlign = 'center';
    profileModal.classList.remove('hidden');
    return;
  }

  if (e.target.matches('.addBtn')) {
    const recipientUid = e.target.parentElement.dataset.uid;
    if (!recipientUid) return;
    if (recipientUid === currentUser.uid) return alert("Can't add yourself.");
    const alreadyFriends = await areUsersFriends(currentUser.uid, recipientUid);
    if (alreadyFriends) return alert("You are already friends with this user.");

    const ref = db.collection('friendRequests').doc(recipientUid).collection('requests').doc(currentUser.uid);
    const snap = await ref.get();
    if (snap.exists) return alert("Friend request already sent.");
    await ref.set({
      from: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email,
      sentAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    alert("Request sent!");
    return;
  }

  // Otherwise toggle the action panel for that row
  const actions = row.querySelector('.profileActions');
  if (actions) actions.classList.toggle('hidden');
});

// --- LISTEN ONLINE USERS (robust) ---
function listenUsersList() {
  return db.collection('status').onSnapshot(snapshot => {
    const now = Date.now();
    const usersMap = new Map();

    snapshot.forEach(doc => {
      const d = doc.data() || {};
      const lastMillis = tsToMillis(d.lastChanged);
      // Consider user online if:
      //  - they explicitly set state === 'online' AND (lastChanged within threshold OR lastChanged missing but state === 'online')
      // We accept missing lastChanged if state === 'online' (this avoids users disappearing when timestamp not yet resolved)
      const isOnline = (d.state === 'online') && (lastMillis === null ? true : ((now - lastMillis) < ONLINE_THRESHOLD_MS));
      if (!isOnline) return;

      // add or update map (dedupe)
      usersMap.set(doc.id, {
        uid: doc.id,
        displayName: d.displayName || 'Unknown',
        profileColor: d.profileColor || '#000000',
        lastChanged: lastMillis
      });
    });

    // Convert to array and sort newest-first by lastChanged when available, else alphabetically
    const arr = Array.from(usersMap.values());
    arr.sort((a, b) => {
      if (a.lastChanged && b.lastChanged) return b.lastChanged - a.lastChanged; // recent first
      return (a.displayName || '').localeCompare(b.displayName || '');
    });

    // Remove duplicates and set global
    allOnlineUsers = arr;
    renderUsers(allOnlineUsers);
  }, err => {
    console.error('listenUsersList error', err);
  });
}

// --- SEARCH filter for online users ---
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return renderUsers(allOnlineUsers);
  const filtered = allOnlineUsers.filter(user => (user.displayName || '').toLowerCase().includes(query));
  renderUsers(filtered);
});

// --- PROFILE EDITOR ---
profileBtn.addEventListener('click', () => {
  if (!currentUser) return;
  const ref = db.collection('profiles').doc(currentUser.uid);
  ref.get().then(doc => {
    const p = doc.data() || {};
    editorName.value = p.displayName || '';
    editorBio.value = p.bio || '';
    editorColor.value = p.profileColor || '#00ff00';
    editorModal.classList.remove('hidden');
  }).catch(console.error);
});

saveProfileBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  const data = {
    displayName: editorName.value.trim() || undefined,
    bio: editorBio.value.trim() || undefined,
    profileColor: editorColor.value,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };
  // remove undefined fields from update object
  Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
  await db.collection('profiles').doc(currentUser.uid).set(data, { merge: true });

  if (currentUser.displayName !== data.displayName && data.displayName) {
    await currentUser.updateProfile({ displayName: data.displayName }).catch(console.warn);
    usernameDisplay.textContent = data.displayName;
  }

  // Update color in UI if present
  document.querySelectorAll('.userRow').forEach(row => {
    if (row.dataset.uid === currentUser.uid) {
      const avatarDiv = row.querySelector('.avatar');
      if (avatarDiv) avatarDiv.style.background = data.profileColor;
    }
  });

  editorModal.classList.add('hidden');
});

// --- FRIENDS system (kept essentially same, just small safety/catches added) ---
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

      // attach listeners (delegation would be better if this grows)
      document.querySelectorAll('.acceptBtn').forEach(btn => {
        btn.onclick = async () => {
          const otherUid = btn.dataset.uid;
          if (otherUid === currentUser.uid) return;
          try {
            await Promise.all([
              db.collection('friends').doc(currentUser.uid).collection('list').doc(otherUid).set({ addedAt: firebase.firestore.FieldValue.serverTimestamp() }),
              db.collection('friends').doc(otherUid).collection('list').doc(currentUser.uid).set({ addedAt: firebase.firestore.FieldValue.serverTimestamp() }),
              db.collection('friendRequests').doc(currentUser.uid).collection('requests').doc(otherUid).delete()
            ]);
            alert("Friend request accepted!");
            listenToFriends();
          } catch (error) { console.error(error); alert("Failed to accept request."); }
        };
      });

      document.querySelectorAll('.declineBtn').forEach(btn => {
        btn.onclick = async () => {
          const otherUid = btn.dataset.uid;
          try { await db.collection('friendRequests').doc(currentUser.uid).collection('requests').doc(otherUid).delete(); alert("Request declined."); }
          catch (error) { console.error(error); alert("Failed to decline request."); }
        };
      });
    });
}

function listenToFriends() {
  if (!currentUser) return;
  db.collection('friends').doc(currentUser.uid).collection('list').onSnapshot(async (snapshot) => {
    friendsList.innerHTML = '';
    if (snapshot.empty) {
      friendsList.innerHTML = '<li>No friends yet</li>';
      return;
    }

    const friends = [];
    for (const doc of snapshot.docs) {
      const friendUid = doc.id;
      try {
        const profileDoc = await db.collection('profiles').doc(friendUid).get();
        const data = profileDoc.data() || {};
        friends.push({
          uid: friendUid,
          displayName: data.displayName || 'Unknown',
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || '',
          profileColor: data.profileColor || '#000000'
        });
      } catch (err) {
        console.warn('Failed to load friend profile', friendUid, err);
      }
    }

    friends.forEach(friend => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.justifyContent = 'center';
      li.style.gap = '10px';
      li.style.padding = '6px 0';

      const friendInfo = document.createElement('div');
      friendInfo.style.display = 'flex';
      friendInfo.style.alignItems = 'center';
      friendInfo.style.gap = '10px';
      friendInfo.style.cursor = 'pointer';
      friendInfo.onclick = () => showFriendProfile(friend);

      const avatar = document.createElement('div');
      avatar.style.width = '32px';
      avatar.style.height = '32px';
      avatar.style.borderRadius = '50%';
      avatar.style.display = 'flex';
      avatar.style.justifyContent = 'center';
      avatar.style.alignItems = 'center';
      avatar.style.background = friend.profileColor;
      avatar.style.color = '#fff';
      avatar.style.fontWeight = 'bold';

      if (friend.avatarUrl) {
        avatar.innerHTML = `<img src="${friend.avatarUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatar.style.background = 'none';
      } else {
        avatar.textContent = friend.displayName.charAt(0).toUpperCase();
      }

      const nameSpan = document.createElement('span');
      nameSpan.textContent = friend.displayName;

      friendInfo.appendChild(avatar);
      friendInfo.appendChild(nameSpan);

      li.appendChild(friendInfo);
      friendsList.appendChild(li);
    });
  });
}

function showFriendProfile(friend) {
  profileNameDisplay.textContent = friend.displayName;
  profileBioDisplay.textContent = friend.bio || 'No bio provided.';
  document.getElementById('profileTag').textContent = friend.tag || 'Friend';
  profileAvatar.innerHTML = '';

  const firstLetter = friend.displayName.charAt(0).toUpperCase();

  if (friend.avatarUrl) {
    profileAvatar.innerHTML = `<img src="${friend.avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    profileAvatar.style.background = 'none';
  } else {
    profileAvatar.textContent = firstLetter;
    profileAvatar.style.background = friend.profileColor || '#000000';
  }

  profileAvatar.style.margin = '0 auto';
  profileAvatar.style.display = 'flex';
  profileAvatar.style.justifyContent = 'center';
  profileAvatar.style.alignItems = 'center';
  profileNameDisplay.style.textAlign = 'center';
  profileBioDisplay.style.textAlign = 'center';
  document.getElementById('profileTag').style.textAlign = 'center';

  // Actions
  const profileActions = document.getElementById('profileActions') || document.createElement('div');
  profileActions.id = 'profileActions';
  profileActions.style.marginTop = '15px';
  profileActions.style.display = 'flex';
  profileActions.style.justifyContent = 'center';
  profileActions.innerHTML = '';

  if (friend.uid !== currentUser.uid) {
    const unfriendBtn = document.createElement('button');
    unfriendBtn.textContent = 'Unfriend';
    unfriendBtn.style.backgroundColor = '#920a0a';
    unfriendBtn.style.color = 'white';
    unfriendBtn.style.padding = '8px 16px';
    unfriendBtn.style.border = 'none';
    unfriendBtn.style.borderRadius = '4px';
    unfriendBtn.style.cursor = 'pointer';
    unfriendBtn.onclick = async () => {
      if (!confirm(`Unfriend ${friend.displayName}?`)) return;
      try {
        await Promise.all([
          db.collection('friends').doc(currentUser.uid).collection('list').doc(friend.uid).delete(),
          db.collection('friends').doc(friend.uid).collection('list').doc(currentUser.uid).delete()
        ]);
        alert('Unfriended successfully.');
        profileModal.classList.add('hidden');
      } catch (error) {
        console.error(error);
        alert('Failed to unfriend. Please try again.');
      }
    };
    profileActions.appendChild(unfriendBtn);
  }

  profileModal.querySelector('.modal-content')?.appendChild(profileActions);
  profileModal.classList.remove('hidden');
}

async function removeFriend(friendUid, friendDisplayName) {
  if (!confirm(`Remove ${friendDisplayName}?`)) return;
  try {
    await Promise.all([
      db.collection('friends').doc(currentUser.uid).collection('list').doc(friendUid).delete(),
      db.collection('friends').doc(friendUid).collection('list').doc(currentUser.uid).delete()
    ]);
    alert(`${friendDisplayName} removed.`);
  } catch (error) {
    console.error(error);
    alert('Failed to remove friend.');
  }
}

// --- AUTH & lifecycle ---
auth.onAuthStateChanged(user => {
  if (!user) return location.href = 'signin.html';
  currentUser = user;
  usernameDisplay.textContent = user.displayName || user.email || 'User';
  ensureUserProfile(user);
  setUserPresence(user, 'online').catch(console.warn);
  listenUsersList();
  listenToFriendRequests();
  listenToFriends();

  // keep presence alive - call every 30s to update lastChanged
  const interval = setInterval(() => setUserPresence(user, 'online').catch(console.warn), 30000);

  // Use beforeunload to attempt to set offline. Note: Firestore calls may not complete reliably on unload.
  window.addEventListener('beforeunload', () => {
    try {
      // best-effort
      navigator.sendBeacon && navigator.sendBeacon('/__presence_ping__'); // heuristic - no direct firestore sendBeacon
      setUserPresence(user, 'offline');
    } catch (err) {
      // ignore
    } finally {
      clearInterval(interval);
    }
  }, { once: true });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut().then(() => location.href = 'signin.html');
});

// invite + copy
inviteBtn.addEventListener('click', () => {
  const linkToCopy = 'https://hyztax.github.io/Velox';
  const tempInput = document.createElement('input');
  tempInput.value = linkToCopy;
  document.body.appendChild(tempInput);
  tempInput.select();
  tempInput.setSelectionRange(0, 99999);
  try { document.execCommand('copy'); alert('Successfully copied link!'); }
  catch (err) { alert('Failed. Copy manually: ' + linkToCopy); }
  document.body.removeChild(tempInput);
});

// friends + requests search filters (unchanged)
const searchFriends = document.getElementById('searchFriends');
if (searchFriends && friendsList) searchFriends.addEventListener('input', () => {
  const searchTerm = searchFriends.value.toLowerCase();
  friendsList.querySelectorAll('li').forEach(friend => { friend.style.display = friend.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'; });
});
const searchRequests = document.getElementById('searchRequests');
if (searchRequests && friendRequestsList) searchRequests.addEventListener('input', () => {
  const searchTerm = searchRequests.value.toLowerCase();
  friendRequestsList.querySelectorAll('li').forEach(req => { req.style.display = req.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'; });
});

// avatar color picker update profile
if (editorColor) editorColor.addEventListener('input', async () => {
  if (!currentUser) return;
  try {
    await db.collection('profiles').doc(currentUser.uid).set({ profileColor: editorColor.value }, { merge: true });
    document.querySelectorAll('.userRow').forEach(row => {
      if (row.dataset.uid === currentUser.uid) {
        const avatarDiv = row.querySelector('.avatar');
        if (avatarDiv) avatarDiv.style.background = editorColor.value;
      }
    });
  } catch (err) { console.error(err); }
});


// --- RENDER USERS (dedupe + skip currentUser) ---
async function renderUsers(users) {
  usersUl.innerHTML = '';

  if (!users || users.length === 0) {
    usersUl.innerHTML = '<li>No users online</li>';
    return;
  }

  // Deduplicate by UID and skip currentUser
  const uniqueMap = new Map();
  for (const u of users) {
    if (u.uid === currentUser?.uid) continue; // skip yourself
    if (!uniqueMap.has(u.uid)) uniqueMap.set(u.uid, u);
  }
  const uniqueUsers = Array.from(uniqueMap.values());

  // Sort alphabetically
  uniqueUsers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  for (const user of uniqueUsers) {
    let profileData = {};
    try {
      const doc = await db.collection('profiles').doc(user.uid).get();
      profileData = doc.exists ? (doc.data() || {}) : {};
    } catch (err) {
      console.warn('Failed to fetch profile for', user.uid, err);
    }

    const displayName = profileData.displayName || user.displayName || 'Unknown';
    const profileColor = profileData.profileColor || user.profileColor || '#000000';
    const avatarUrl = profileData.avatarUrl || '';

    const li = document.createElement('li');
    li.style.padding = '6px 0';
    li.style.display = 'flex';
    li.style.justifyContent = 'center';

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
    avatarDiv.style.background = avatarUrl ? 'none' : profileColor;
    avatarDiv.style.color = '#fff';
    avatarDiv.style.fontWeight = 'bold';
    avatarDiv.style.flex = '0 0 32px';
    avatarDiv.style.overflow = 'hidden';

    if (avatarUrl) {
      avatarDiv.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      avatarDiv.textContent = displayName.charAt(0).toUpperCase();
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = displayName;
    nameSpan.style.flex = '1';

    const profileActions = document.createElement('div');
    profileActions.className = 'profileActions hidden';
    profileActions.dataset.uid = user.uid;
    profileActions.style.marginLeft = 'auto';
    profileActions.innerHTML = `<button class="viewBtn">👁 View</button> <button class="addBtn">➕ Add</button>`;

    userRow.appendChild(avatarDiv);
    userRow.appendChild(nameSpan);
    userRow.appendChild(profileActions);

    li.appendChild(userRow);
    usersUl.appendChild(li);
  }
}

// --- LISTEN ONLINE USERS (dedupe inside snapshot too) ---
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

      // Deduplicate by UID
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
  }, err => {
    console.error('listenUsersList error', err);
  });
}

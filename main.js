// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
  authDomain: "velox-c39ad.firebaseapp.com",
  projectId: "velox-c39ad",
  storageBucket: "velox-c39ad.appspot.com",
  messagingSenderId: "404832661601",
  appId: "1:404832661601:web:9ad221c8bfb459410bba20",
  measurementId: "G-X8W755KRF6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM Elements
const editorColor = document.getElementById('avatarColorPicker'); // color picker
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
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
let allOnlineUsers = [];

// Settings menu toggle
settingsBtn.addEventListener('click', () => settingsMenu.classList.toggle('hidden'));
document.addEventListener('click', e => {
  if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
    settingsMenu.classList.add('hidden');
  }
});
profileCloseBtn.addEventListener('click', () => profileModal.classList.add('hidden'));
editorCloseBtn.addEventListener('click', () => editorModal.classList.add('hidden'));

// Presence tracking
function setUserPresence(user, state) {
  db.collection('status').doc(user.uid).set({
    state,
    lastChanged: firebase.firestore.FieldValue.serverTimestamp(),
    displayName: user.displayName || user.email,
    email: user.email,
    profileColor: user.profileColor || '#000000'
  }, { merge: true });
}

// Ensure user profile exists
function ensureUserProfile(user) {
  const ref = db.collection('profiles').doc(user.uid);
  ref.get().then(doc => {
    if (!doc.exists) {
      ref.set({
        displayName: user.displayName || user.email || 'User',
        bio: '',
        profileColor: editorColor.value || '#00ff00'
      });
    }
  });
}

// Render online users with profile color, avatar, and centered
async function renderUsers(users) {
  usersUl.innerHTML = '';
  if (users.length === 0) {
    usersUl.innerHTML = '<li>No users online</li>';
    return;
  }

  for (const user of users) {
    // Fetch profile data
    const doc = await db.collection('profiles').doc(user.uid).get();
    const p = doc.data() || {};
    const displayName = p.displayName || user.displayName || 'Unknown';
    const profileColor = p.profileColor || '#000000';
    const avatarUrl = p.avatarUrl || '';

    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.justifyContent = 'center';
    li.style.padding = '6px 0';

    const userRow = document.createElement('div');
    userRow.className = 'userRow';
    userRow.style.display = 'flex';
    userRow.style.alignItems = 'center';
    userRow.style.gap = '10px';
    userRow.style.cursor = 'pointer';

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

    if (avatarUrl) {
      avatarDiv.innerHTML = `<img src="${avatarUrl}" alt="Avatar" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      avatarDiv.textContent = displayName.charAt(0).toUpperCase();
    }

    const nameSpan = document.createElement('span');
    nameSpan.textContent = displayName;

    userRow.appendChild(avatarDiv);
    userRow.appendChild(nameSpan);

    // Actions (view/add)
    const profileActions = document.createElement('div');
    profileActions.className = 'profileActions hidden';
    profileActions.dataset.uid = user.uid;
    profileActions.style.marginLeft = 'auto';
    profileActions.innerHTML = `<button class="viewBtn">👁 View</button><button class="addBtn">➕ Add</button>`;

    userRow.appendChild(profileActions);
    li.appendChild(userRow);
    usersUl.appendChild(li);
  }

  attachUserRowEvents();
}

// Attach click events for online users
function attachUserRowEvents() {
  document.querySelectorAll('.userRow').forEach(row => {
    row.onclick = (e) => {
      if (e.target.tagName === 'BUTTON') return;
      const actions = row.querySelector('.profileActions');
      if (actions) actions.classList.toggle('hidden');
    };
  });

  document.querySelectorAll('.viewBtn').forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.parentElement.dataset.uid;
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

      // Center avatar and texts
      profileAvatar.style.margin = '0 auto';
      profileAvatar.style.display = 'flex';
      profileAvatar.style.justifyContent = 'center';
      profileAvatar.style.alignItems = 'center';
      profileNameDisplay.style.textAlign = 'center';
      profileBioDisplay.style.textAlign = 'center';
      document.getElementById('profileTag').style.textAlign = 'center';

      profileModal.classList.remove('hidden');
    };
  });

  document.querySelectorAll('.addBtn').forEach(btn => {
    btn.onclick = async () => {
      const recipientUid = btn.parentElement.dataset.uid;
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
    };
  });
}


  document.querySelectorAll('.addBtn').forEach(btn => {
    btn.onclick = async () => {
      const recipientUid = btn.parentElement.dataset.uid;
      if (recipientUid === currentUser.uid) return alert("Can't add yourself.");
      const alreadyFriends = await areUsersFriends(currentUser.uid, recipientUid);
      if (alreadyFriends) return alert("Already friends with this user.");
      const ref = db.collection('friendRequests').doc(recipientUid).collection('requests').doc(currentUser.uid);
      const snap = await ref.get();
      if (snap.exists) return alert("Friend request already sent.");
      await ref.set({
        from: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email,
        sentAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      alert("Request sent!");
    };
  });


// Listen online users
function listenUsersList() {
  db.collection('status').onSnapshot(snapshot => {
    allOnlineUsers = [];
    const now = Date.now();
    snapshot.forEach(doc => {
      const d = doc.data();
      const last = d.lastChanged?.toDate().getTime() || 0;
      const isOnline = d.state === 'online' && (now - last) < ONLINE_THRESHOLD_MS;
      if (!isOnline) return;
      allOnlineUsers.push({
        uid: doc.id,
        displayName: d.displayName,
        profileColor: d.profileColor || '#000000'
      });
    });
    renderUsers(allOnlineUsers);
  });
}

// User search filter
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return renderUsers(allOnlineUsers);
  const filtered = allOnlineUsers.filter(user => user.displayName.toLowerCase().includes(query));
  renderUsers(filtered);
});

// Open profile editor
profileBtn.addEventListener('click', () => {
  const ref = db.collection('profiles').doc(currentUser.uid);
  ref.get().then(doc => {
    const p = doc.data() || {};
    editorName.value = p.displayName || '';
    editorBio.value = p.bio || '';
    editorColor.value = p.profileColor || '#00ff00';
    editorModal.classList.remove('hidden');
  });
});

// Save profile (with color)
saveProfileBtn.addEventListener('click', async () => {
  const data = {
    displayName: editorName.value.trim(),
    bio: editorBio.value.trim(),
    profileColor: editorColor.value,
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('profiles').doc(currentUser.uid).set(data, { merge: true });

  if (currentUser.displayName !== data.displayName) {
    await currentUser.updateProfile({ displayName: data.displayName });
    usernameDisplay.textContent = data.displayName;
  }

  // Update color in online list
  const liAvatars = document.querySelectorAll('.userRow');
  liAvatars.forEach(row => {
    if (row.querySelector('.profileActions')?.dataset.uid === currentUser.uid) {
      const avatarDiv = row.querySelector('.avatar');
      if (avatarDiv) avatarDiv.style.background = data.profileColor;
    }
  });

  editorModal.classList.add('hidden');
});

// --- Friends system, requests, remove, mutual friends --- //
// Check if two users are friends
async function areUsersFriends(uid1, uid2) {
  const doc = await db.collection('friends').doc(uid1).collection('list').doc(uid2).get();
  return doc.exists;
}

// Listen to friend requests
function listenToFriendRequests() {
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
// Listen and render current user's friends list (centered)
function listenToFriends() {
  db.collection('friends')
    .doc(currentUser.uid)
    .collection('list')
    .onSnapshot(async (snapshot) => {
      friendsList.innerHTML = '';
      if (snapshot.empty) {
        friendsList.innerHTML = '<li>No friends yet</li>';
        return;
      }

      const friends = [];
      for (const doc of snapshot.docs) {
        const friendUid = doc.id;
        const profileDoc = await db.collection('profiles').doc(friendUid).get();
        const data = profileDoc.data() || {};
        friends.push({
          uid: friendUid,
          displayName: data.displayName || 'Unknown',
          bio: data.bio || '',
          avatarUrl: data.avatarUrl || '',
          profileColor: data.profileColor || '#000000'
        });
      }

      friends.forEach(friend => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.justifyContent = 'center'; // <-- center horizontally
        li.style.gap = '10px';
        li.style.padding = '6px 0';

        // Avatar + name container
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


// Show friend's profile (centered)
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

  // Center avatar and texts
  profileAvatar.style.margin = '0 auto';
  profileAvatar.style.display = 'flex';
  profileAvatar.style.justifyContent = 'center';
  profileAvatar.style.alignItems = 'center';

  profileNameDisplay.style.textAlign = 'center';
  profileBioDisplay.style.textAlign = 'center';
  document.getElementById('profileTag').style.textAlign = 'center';

  // Actions container
  const profileActions = document.getElementById('profileActions') || document.createElement('div');
  profileActions.id = 'profileActions';
  profileActions.style.marginTop = '15px';
  profileActions.style.display = 'flex';
  profileActions.style.justifyContent = 'center'; // center the button
  profileActions.innerHTML = '';

  // Add Unfriend button if not yourself
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

// Remove friend (direct)
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

// Auth state
auth.onAuthStateChanged(user => {
  if (!user) return location.href = 'signin.html';
  currentUser = user;
  usernameDisplay.textContent = user.displayName || user.email || 'User';
  ensureUserProfile(user);
  setUserPresence(user, 'online');
  listenUsersList();
  listenToFriendRequests();
  listenToFriends();
  const interval = setInterval(() => setUserPresence(user, 'online'), 30000);
  window.addEventListener('beforeunload', () => { setUserPresence(user, 'offline'); clearInterval(interval); });
});

// Logout
logoutBtn.addEventListener('click', () => { auth.signOut().then(() => location.href = 'signin.html'); });

// Invite button
inviteBtn.addEventListener('click', () => { 
  const linkToCopy = 'https://hyztax.github.io/Velox'; 
  const tempInput = document.createElement('input'); tempInput.value = linkToCopy; document.body.appendChild(tempInput);
  tempInput.select(); tempInput.setSelectionRange(0, 99999); 
  try { document.execCommand('copy'); alert('Successfully copied link!'); } 
  catch (err) { alert('Failed. Copy manually: ' + linkToCopy); } 
  document.body.removeChild(tempInput); 
});

// Friends search filter
const searchFriends = document.getElementById('searchFriends');
if (searchFriends && friendsList) searchFriends.addEventListener('input', () => {
  const searchTerm = searchFriends.value.toLowerCase();
  friendsList.querySelectorAll('li').forEach(friend => { friend.style.display = friend.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'; });
});

// Friend requests search filter
const searchRequests = document.getElementById('searchRequests');
if (searchRequests && friendRequestsList) searchRequests.addEventListener('input', () => {
  const searchTerm = searchRequests.value.toLowerCase();
  friendRequestsList.querySelectorAll('li').forEach(req => { req.style.display = req.textContent.toLowerCase().includes(searchTerm) ? '' : 'none'; });
});

// Avatar color picker updates currentUser profile in real-time
editorColor.addEventListener('input', async () => {
  if (!currentUser) return;
  await db.collection('profiles').doc(currentUser.uid).set({ profileColor: editorColor.value }, { merge: true });
  
  // Update color in online users list immediately
  const liAvatars = document.querySelectorAll('.userRow');
  liAvatars.forEach(row => {
    if (row.querySelector('.profileActions')?.dataset.uid === currentUser.uid) {
      const avatarDiv = row.querySelector('.avatar');
      if (avatarDiv) avatarDiv.style.background = editorColor.value;
    }
  });
});

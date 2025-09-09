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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const usernameDisplay = document.getElementById('usernameDisplay');
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const logoutBtn = document.getElementById('logoutBtn');
const profileBtn = document.getElementById('showProfileBtn');
const faqBtn = document.getElementById('faqBtn');
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
const onlineUsersList = document.getElementById('onlineUsersList');

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

function setUserPresence(user, state) {
  db.collection('status').doc(user.uid).set({
    state,
    lastChanged: firebase.firestore.FieldValue.serverTimestamp(),
    displayName: user.displayName || user.email,
    email: user.email
  }, { merge: true });
}

function ensureUserProfile(user) {
  const ref = db.collection('profiles').doc(user.uid);
  ref.get().then(doc => {
    if (!doc.exists) {
      ref.set({
        displayName: user.displayName || user.email || 'User',
        bio: ''
      });
    }
  });
}

function renderUserElement(user, isCurrentUser = false) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div class="userRow" style="display:flex; align-items:center; gap:10px; cursor:pointer;">
      <div class="avatar" style="width: 32px; height: 32px; background: #000000; color: #fff; font-weight: bold; border-radius: 50%; display: flex; justify-content: center; align-items: center;">
        ${user.displayName.charAt(0).toUpperCase()}
      </div>
      <span class="username">${user.displayName}${isCurrentUser ? ' (You)' : ''}</span>
      <div class="profileActions hidden" data-uid="${user.uid}" style="margin-left:auto;">
        <button class="viewBtn">👁 View</button>
        <button class="addBtn">➕ Add</button>
      </div>
    </div>
  `;
  return li;
}

function renderUsers(users) {
  usersUl.innerHTML = '';
  if (users.length === 0) {
    usersUl.innerHTML = '<li>No users online</li>';
    return;
  }
  users.forEach(user => {
    const li = renderUserElement(user, user.uid === currentUser.uid);
    usersUl.appendChild(li);
  });
  attachUserRowEvents();
}

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
        profileAvatar.style.background = '#000000';
      }

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

function listenUsersList() {
  db.collection('status').onSnapshot(snapshot => {
    allOnlineUsers = [];
    const now = Date.now();
    snapshot.forEach(doc => {
      const d = doc.data();
      const last = d.lastChanged?.toDate().getTime() || 0;
      const isOnline = d.state === 'online' && (now - last) < ONLINE_THRESHOLD_MS;
      if (!isOnline) return;
      allOnlineUsers.push({ uid: doc.id, displayName: d.displayName || d.email });
    });
    renderUsers(allOnlineUsers);
  });
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) return renderUsers(allOnlineUsers);
  const filtered = allOnlineUsers.filter(user => user.displayName.toLowerCase().includes(query));
  renderUsers(filtered);
});

profileBtn.addEventListener('click', () => {
  const ref = db.collection('profiles').doc(currentUser.uid);
  ref.get().then(doc => {
    const p = doc.data() || {};
    editorName.value = p.displayName || '';
    editorBio.value = p.bio || '';
    editorModal.classList.remove('hidden');
  });
});

saveProfileBtn.addEventListener('click', async () => {
  const data = {
    displayName: editorName.value.trim(),
    bio: editorBio.value.trim(),
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('profiles').doc(currentUser.uid).set(data, { merge: true });
  if (currentUser.displayName !== data.displayName) {
    await currentUser.updateProfile({ displayName: data.displayName });
    usernameDisplay.textContent = data.displayName;
  }
  editorModal.classList.add('hidden');
});

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
  window.addEventListener('beforeunload', () => {
    setUserPresence(user, 'offline');
    clearInterval(interval);
  });
});

logoutBtn.addEventListener('click', () => {
  auth.signOut().then(() => location.href = 'signin.html');
});

// Listen and render friend requests with Accept/Decline buttons
function listenToFriendRequests() {
  db.collection('friendRequests')
    .doc(currentUser.uid)
    .collection('requests')
    .onSnapshot(snapshot => {
      friendRequestsList.innerHTML = '';
      snapshot.forEach(doc => {
        const data = doc.data();
        // Create list item for each friend request
        const li = document.createElement('li');
        li.innerHTML = `
          ${data.displayName} 
          <button data-uid="${doc.id}" class="acceptBtn">Accept</button>
          <button data-uid="${doc.id}" class="declineBtn">Decline</button>
        `;
        friendRequestsList.appendChild(li);
      });

      // Accept button logic
      document.querySelectorAll('.acceptBtn').forEach(btn => {
        btn.onclick = async () => {
          const otherUid = btn.dataset.uid;

          if (otherUid === currentUser.uid) {
            alert("You can't accept your own friend request.");
            return;
          }

          try {
            // Add each user to the other's friends list
            await Promise.all([
              db.collection('friends').doc(currentUser.uid).collection('list').doc(otherUid).set({
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
              }),
              db.collection('friends').doc(otherUid).collection('list').doc(currentUser.uid).set({
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
              }),
              // Remove the friend request document after acceptance
              db.collection('friendRequests').doc(currentUser.uid).collection('requests').doc(otherUid).delete()
            ]);
            alert("Friend request accepted!");
            listenToFriends(); // Refresh friends list immediately after accepting
          } catch (error) {
            console.error("Error accepting friend request:", error);
            alert("Failed to accept friend request. Please try again.");
          }
        };
      });

      // Decline button logic
      document.querySelectorAll('.declineBtn').forEach(btn => {
        btn.onclick = async () => {
          const otherUid = btn.dataset.uid;
          try {
            await db.collection('friendRequests').doc(currentUser.uid).collection('requests').doc(otherUid).delete();
            alert("Friend request declined.");
          } catch (error) {
            console.error("Error declining friend request:", error);
            alert("Failed to decline friend request. Please try again.");
          }
        };
      });
    });
}

// Listen and render current user's friends list with Remove button
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
          avatarUrl: data.avatarUrl || ''
        });
      }

      friends.forEach(friend => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.justifyContent = 'space-between';
        li.style.gap = '10px';
        li.style.padding = '6px 0';

        // Left side: avatar + name (clickable)
        const friendInfo = document.createElement('div');
        friendInfo.style.display = 'flex';
        friendInfo.style.alignItems = 'center';
        friendInfo.style.gap = '10px';
        friendInfo.style.cursor = 'pointer';
        friendInfo.onclick = () => showFriendProfile(friend);

        const avatar = document.createElement('div');
        avatar.style.justifyContent = 'center'; // Horizontal centering
        avatar.style.alignItems = 'center';   // Vertical centering
        avatar.style.width = '32px';
        avatar.style.height = '32px';
        avatar.style.borderRadius = '50%';
        avatar.style.overflow = 'hidden';
        avatar.style.background = '#000000';
        avatar.style.color = '#fff';
        avatar.style.fontWeight = 'bold';
        avatar.style.display = 'flex';
        avatar.style.justifyContent = 'center';
        avatar.style.alignItems = 'center';
        avatar.style.marginLeft = '55px';

        if (friend.avatarUrl) {
          avatar.innerHTML = `<img src="${friend.avatarUrl}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`;
          avatar.style.background = 'none';
        } else {
          avatar.textContent = friend.displayName.charAt(0).toUpperCase();
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = friend.displayName;

        friendInfo.appendChild(avatar);
        friendInfo.appendChild(nameSpan);

        // Right side: Remove Friend button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Unfriend';
        removeBtn.style.backgroundColor = '#ff4d4d';
        removeBtn.style.color = '#fff';
        removeBtn.style.border = 'none';
        removeBtn.style.padding = '4px 5px';

        removeBtn.style.borderRadius = '4px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.onclick = () => removeFriend(friend.uid, friend.displayName);

        li.appendChild(friendInfo);
        friendsList.appendChild(li);
      });
    });
}

// Function to show friend's profile in modal
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
    profileAvatar.style.background = '#000000';
  }

  // Add Unfriend button if not yourself
  const profileActions = document.getElementById('profileActions') || document.createElement('div');
  profileActions.id = 'profileActions';
  profileActions.style.marginTop = '10px';

  profileActions.innerHTML = ''; // Clear previous buttons
  if (friend.uid !== currentUser.uid) {
    const unfriendBtn = document.createElement('button');
    unfriendBtn.textContent = 'Unfriend';
    unfriendBtn.style.marginTop = '10px';
    unfriendBtn.style.backgroundColor = '#920a0a';
    unfriendBtn.style.color = 'white';
    unfriendBtn.style.padding = '6px 12px';
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
        console.error('Unfriend error:', error);
        alert('Failed to unfriend. Please try again.');
      }
    };

    profileActions.appendChild(unfriendBtn);
  }

  profileModal.querySelector('.modal-content')?.appendChild(profileActions);
  profileModal.classList.remove('hidden');
}



// Remove friend function - removes friendship both ways
async function removeFriend(friendUid, friendDisplayName) {
  const confirmRemove = confirm(`Are you sure you want to remove ${friendDisplayName} from your friends?`);
  if (!confirmRemove) return;

  try {
    await Promise.all([
      db.collection('friends').doc(currentUser.uid).collection('list').doc(friendUid).delete(),
      db.collection('friends').doc(friendUid).collection('list').doc(currentUser.uid).delete()
    ]);
    alert(`${friendDisplayName} has been removed from your friends.`);
  } catch (error) {
    console.error('Error removing friend:', error);
    alert('Failed to remove friend. Please try again.');
  }
}

// Check if two users are friends
async function areUsersFriends(uid1, uid2) {
  const doc = await db.collection('friends').doc(uid1).collection('list').doc(uid2).get();
  return doc.exists;
}

// works
document.addEventListener('DOMContentLoaded', function() {
    const inviteBtn = document.getElementById('inviteBtn');
    const linkToCopy = 'https://hyztax.github.io/Velox'; 

    inviteBtn.addEventListener('click', function() {
        // Skapa ett temporärt inputfält för att kunna kopiera texten
        const tempInput = document.createElement('input');
        tempInput.value = linkToCopy;
        document.body.appendChild(tempInput);

        // Markera texten i inputfältet
        tempInput.select();
        tempInput.setSelectionRange(0, 99999); // För mobila enheter

        // Kopiera texten till urklipp
        try {
            document.execCommand('copy');
            alert('Successfully copied Site link! - share with your friends!'); // Visa meddelandet
        } catch (err) {
            console.error('Kunde inte kopiera länken: ', err);
            alert('Kunde inte kopiera länken. Vänligen kopiera manuellt: ' + linkToCopy);
        }

        // Ta bort det temporära inputfältet
        document.body.removeChild(tempInput);
    });
});

// Friend search filter
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById('searchFriends');
  const friendsList = document.getElementById('friendsList');

  if (searchInput && friendsList) {
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase();
      const friends = friendsList.querySelectorAll('li');

      friends.forEach(friend => {
        const name = friend.textContent.toLowerCase();
        friend.style.display = name.includes(searchTerm) ? '' : 'none';
      });
    });
  }
});

// Friend Requests search filter
document.addEventListener("DOMContentLoaded", () => {
  const searchRequestsInput = document.getElementById('searchRequests');
  const requestsList = document.getElementById('friendRequestsList');

  if (searchRequestsInput && requestsList) {
    searchRequestsInput.addEventListener('input', () => {
      const searchTerm = searchRequestsInput.value.toLowerCase();
      const requests = requestsList.querySelectorAll('li');

      requests.forEach(request => {
        const name = request.textContent.toLowerCase();
        request.style.display = name.includes(searchTerm) ? '' : 'none';
      });
    });
  }
});







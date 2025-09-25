document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
        apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
        authDomain: "velox-c39ad.firebaseapp.com",
        projectId: "velox-c39ad",
        storageBucket: "velox-c39ad.appspot.com",
        messagingSenderId: "404832661601",
        appId: "1:404832661601:web:9ad221c8bfb459410bba20",
        measurementId: "G-X8W755KRF6"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    let currentUser = null;
    let selectedUser = null;
    const friendsState = {};

    const container = document.getElementById('notificationContainer');
    if (!container) console.error('Notification container not found!');

    // LocalStorage to prevent duplicate notifications
    const lastNotified = JSON.parse(localStorage.getItem('lastNotified') || '{}');
    function saveLastNotified() {
        localStorage.setItem('lastNotified', JSON.stringify(lastNotified));
    }

    function generateChatId(uid1, uid2) {
        return [uid1, uid2].sort().join('_');
    }

    function showNotification(msg) {
        if (!container || !msg.text) return;

        // Avoid duplicate notifications
        if (lastNotified[msg.sender] === msg.text) return;
        lastNotified[msg.sender] = msg.text;
        saveLastNotified();

        const notif = document.createElement('div');
        notif.className = 'chatNotification';
        notif.textContent = `${msg.senderName || 'User'}: ${msg.text.length > 50 ? msg.text.slice(0, 50) + '...' : msg.text}`;

        notif.addEventListener('click', () => {
            openChat({ uid: msg.sender });
            notif.remove();
        });

        container.appendChild(notif);

        // Play sound only if it's not the current user
        if (msg.sender !== currentUser.uid) {
            const audio = new Audio('notification.mp3');
            audio.play().catch(() => {});
        }

        // Auto-remove after 5 seconds
        setTimeout(() => notif.remove(), 5000);
    }

    async function listenForFriendNotifications() {
        if (!currentUser) return;

        const friendsRef = db.collection('friends').doc(currentUser.uid).collection('list');
        friendsRef.onSnapshot(async snapshot => {
            for (const change of snapshot.docChanges()) {
                const friendUid = change.doc.id;
                const data = change.doc.data() || {};
                const lastMessage = data.lastMessage || '';

                // Cache friend profile
                if (!friendsState[friendUid]) {
                    const prof = await db.collection('profiles').doc(friendUid).get();
                    friendsState[friendUid] = { data: prof.data() || {} };
                }

                friendsState[friendUid].latestMsg = lastMessage;

                // Notify only if chat is not open and message is new
                if (lastMessage && (!selectedUser || selectedUser.uid !== friendUid)) {
                    showNotification({
                        sender: friendUid,
                        senderName: friendsState[friendUid].data.displayName || 'User',
                        text: lastMessage
                    });
                }
            }
        });
    }

    // Open chat
    window.openChat = function(user) {
        selectedUser = user;
        if (typeof startChat === 'function') startChat(user.uid);
    };

    // Auth listener
    auth.onAuthStateChanged(user => {
        if (!user) return location.href = 'signin.html';
        currentUser = user;
        listenForFriendNotifications();
    });

});
// latest






// document.addEventListener('DOMContentLoaded', () => {

//     const firebaseConfig = {
//         apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
//         authDomain: "velox-c39ad.firebaseapp.com",
//         projectId: "velox-c39ad",
//         storageBucket: "velox-c39ad.appspot.com",
//         messagingSenderId: "404832661601",
//         appId: "1:404832661601:web:9ad221c8bfb459410bba20",
//         measurementId: "G-X8W755KRF6"
//     };

//     if (!firebase.apps.length) {
//         firebase.initializeApp(firebaseConfig);
//     }

//     const auth = firebase.auth();
//     const db = firebase.firestore();

//     let currentUser = null;
//     let selectedUser = null;
//     const friendsState = {};

//     const container = document.getElementById('notificationContainer');
//     if (!container) console.error('Notification container not found!');

//     // Session-only duplicate check
//     const sessionNotified = {};

//     function showNotification(msg) {
//         if (!container || !msg.text) return;

//         const key = msg.sender + '_' + msg.text;
//         if (sessionNotified[key]) return; // avoid duplicate in session
//         sessionNotified[key] = true;

//         const notif = document.createElement('div');
//         notif.className = 'chatNotification';
//         notif.textContent = `${msg.senderName || 'User'}: ${msg.text.length > 50 ? msg.text.slice(0, 50) + '...' : msg.text}`;

//         notif.addEventListener('click', () => {
//             openChat({ uid: msg.sender });
//             notif.remove();
//         });

//         container.appendChild(notif);

//         if (msg.sender !== currentUser.uid) {
//             const audio = new Audio('notification.mp3');
//             audio.play().catch(() => {});
//         }

//         setTimeout(() => notif.remove(), 5000);
//     }

//     async function listenForFriendNotifications() {
//         if (!currentUser) return;

//         const friendsRef = db.collection('friends').doc(currentUser.uid).collection('list');
//         friendsRef.onSnapshot(async snapshot => {
//             for (const change of snapshot.docChanges()) {
//                 const friendUid = change.doc.id;
//                 const data = change.doc.data() || {};
//                 const lastMessage = data.lastMessage || '';
//                 const lastMessageSender = data.lastMessageSender;

//                 // Skip if sender is missing or it's you
//                 if (!lastMessageSender || lastMessageSender === currentUser.uid) continue;

//                 // Cache friend profile
//                 if (!friendsState[friendUid]) {
//                     const prof = await db.collection('profiles').doc(friendUid).get();
//                     friendsState[friendUid] = { data: prof.data() || {} };
//                 }

//                 friendsState[friendUid].latestMsg = lastMessage;

//                 // Notify if chat with this friend is not open
//                 if (lastMessage && (!selectedUser || selectedUser.uid !== friendUid)) {
//                     showNotification({
//                         sender: lastMessageSender,
//                         senderName: friendsState[friendUid].data.displayName || 'User',
//                         text: lastMessage
//                     });
//                 }
//             }
//         });
//     }

//     window.openChat = function(user) {
//         selectedUser = user;
//         if (typeof startChat === 'function') startChat(user.uid);
//     };

//     auth.onAuthStateChanged(user => {
//         if (!user) return location.href = 'signin.html';
//         currentUser = user;
//         listenForFriendNotifications();
//     });

// });



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

    function showNotification(msg) {
        if (!container || !msg.text) return;

        // Don't notify yourself
        if (msg.sender === currentUser.uid) return;

        // Avoid duplicates across refresh
        const notifKey = msg.sender + ':' + msg.text;
        if (lastNotified[notifKey]) return;
        lastNotified[notifKey] = true;
        saveLastNotified();

        const notif = document.createElement('div');
        notif.className = 'chatNotification';
        notif.textContent = `${msg.senderName || 'User'}: ${msg.text.length > 50 ? msg.text.slice(0, 50) + '...' : msg.text}`;

        notif.addEventListener('click', () => {
            openChat({ uid: msg.sender });
            notif.remove();
        });

        container.appendChild(notif);

        // Play sound
        const audio = new Audio('notification.mp3');
        audio.play().catch(() => {});

        // Auto-remove after 5 seconds
        setTimeout(() => notif.remove(), 5000);
    }

    async function listenForFriendNotifications() {
        if (!currentUser) return;
    
        // Get all friend IDs
        const friendsRef = db.collection('friends').doc(currentUser.uid).collection('list');
        friendsRef.onSnapshot(async snapshot => {
            for (const doc of snapshot.docs) {
                const friendUid = doc.id;
                const chatId = [currentUser.uid, friendUid].sort().join('_');
                const chatRef = db.collection('chats').doc(chatId).collection('messages');
    
                // 🔔 Listen to new messages in this chat
                chatRef.orderBy('timestamp', 'desc').limit(1).onSnapshot(msgSnap => {
                    msgSnap.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const msg = change.doc.data();
    
                            // 🚫 Ignore if you sent it
                            if (msg.sender === currentUser.uid) return;
    
                            // 🚫 Ignore if chat is open
                            if (selectedUser && selectedUser.uid === friendUid) return;
    
                            // Cache friend profile
                            if (!friendsState[friendUid]) {
                                db.collection('profiles').doc(friendUid).get().then(prof => {
                                    friendsState[friendUid] = { data: prof.data() || {} };
                                    const senderName = friendsState[friendUid].data.displayName || 'User';
                                    showNotification({
                                        sender: msg.sender,
                                        senderName,
                                        text: msg.text
                                    });
                                });
                            } else {
                                const senderName = friendsState[friendUid].data.displayName || 'User';
                                showNotification({
                                    sender: msg.sender,
                                    senderName,
                                    text: msg.text
                                });
                            }
                        }
                    });
                });
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

async function sendMessage(friendUid, messageText) {
    if (!currentUser || !messageText.trim()) return;

    const chatId = [currentUser.uid, friendUid].sort().join('_');
    const chatRef = db.collection('chats').doc(chatId).collection('messages');

    // Save the message in the chat collection
    await chatRef.add({
        sender: currentUser.uid,
        text: messageText,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Update "lastMessage" + "lastSender" for both users’ friends lists
    const updates = {
        lastMessage: messageText,
        lastSender: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await Promise.all([
        db.collection('friends').doc(currentUser.uid).collection('list').doc(friendUid).set(updates, { merge: true }),
        db.collection('friends').doc(friendUid).collection('list').doc(currentUser.uid).set(updates, { merge: true })
    ]);
}









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



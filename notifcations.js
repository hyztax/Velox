// --- Real-time message notifications ---
function listenForIncomingMessages() {
    if (!currentUser) return;

    // Listen to all chats where currentUser is a participant
    db.collection('chats')
      .where('participants', 'array-contains', currentUser.uid)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const chatDoc = change.doc;
                const chatId = chatDoc.id;

                // Get last message
                const messagesSnap = await db.collection('chats').doc(chatId)
                                            .collection('messages')
                                            .orderBy('timestamp', 'desc')
                                            .limit(1)
                                            .get();
                if (!messagesSnap.empty) {
                    const msgDoc = messagesSnap.docs[0];
                    const msg = msgDoc.data();

                    // Ignore messages sent by self
                    if (msg.sender === currentUser.uid) return;

                    // If not in this chat, show notification
                    if (!selectedUser || chatId !== [currentUser.uid, selectedUser.uid].sort().join('_')) {
                        showNotification(msg, chatId);
                    }
                }
            }
        });
      });
}

// --- Show notification ---
function showNotification(msg, chatId) {
    const notif = document.createElement('div');
    notif.className = 'chatNotification';
    notif.style.position = 'fixed';
    notif.style.bottom = '20px';
    notif.style.right = '20px';
    notif.style.background = '#333';
    notif.style.color = '#fff';
    notif.style.padding = '10px 15px';
    notif.style.borderRadius = '8px';
    notif.style.boxShadow = '0 4px 10px rgba(0,0,0,0.3)';
    notif.style.zIndex = '9999';
    notif.style.cursor = 'pointer';
    notif.textContent = `${msg.text.slice(0, 30)}...`;

    notif.onclick = () => {
        // Open the chat with this sender
        const otherUid = msg.sender;
        startChat(otherUid);
        notif.remove();
    };

    document.body.appendChild(notif);

    // Auto-remove after 5s
    setTimeout(() => notif.remove(), 5000);
}

// --- Call after auth is ready ---
auth.onAuthStateChanged(user => {
    if (!user) return location.href = 'signin.html';
    currentUser = user;

    listenToFriends();
    showSection('friends');
    listenForIncomingMessages(); // <-- add this
});

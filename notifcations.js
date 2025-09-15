// --- NOTIFICATIONS ---
function setupMessageNotifications() {
    if (!currentUser) return;
  
    // Ensure notification container exists
    let container = document.getElementById('notificationContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'notificationContainer';
      document.body.appendChild(container);
    }
  
    // Listen to new messages in the user's inbox
    db.collection('messages')
      .doc(currentUser.uid)
      .collection('inbox')
      .orderBy('sentAt', 'desc')
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const msgData = change.doc.data();
  
            // Only show notification if the message is not from yourself
            if (msgData.from === currentUser.uid) return;
  
            // Create notification element
            const notif = document.createElement('div');
            notif.className = 'notification';
            notif.textContent = `${msgData.fromName || 'User'}: ${msgData.text}`;
  
            // Click opens chat
            notif.onclick = () => {
              localStorage.setItem('chatWith', msgData.from);
              window.location.href = 'chat.html';
            };
  
            container.appendChild(notif);
  
            // Auto-remove after 5 seconds
            setTimeout(() => {
              notif.style.opacity = '0';
              setTimeout(() => notif.remove(), 300);
            }, 5000);
          }
        });
      }, err => console.error('Notification listener error:', err));
  }
  
  // Call this after currentUser is set
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      setupMessageNotifications();
    }
  });
  
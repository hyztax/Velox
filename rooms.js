// =============================
// Firebase Init
// =============================
const firebaseConfig = {
    apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
    authDomain: "velox-c39ad.firebaseapp.com",
    projectId: "velox-c39ad",
    storageBucket: "velox-c39ad.appspot.com",
    messagingSenderId: "404832661601",
    appId: "1:404832661601:web:8eab5e0343ff227bbd557a"
};
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

// =============================
// DOM Elements
// =============================
const roomsContainer = document.getElementById("roomsContainer");
const chatContainer = document.getElementById("chatContainer");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const backBtn = document.getElementById("backBtn");
const roomTitle = document.getElementById("roomTitle");

let currentRoomId = null;
let unsubscribeMessages = null;

// =============================
// Auth & Initial Load
// =============================
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        try {
            await auth.signInAnonymously();
            console.log("Signed in anonymously.");
        } catch (err) {
            console.error("Auth error:", err);
            roomsContainer.innerHTML = `<p class="notice">Error signing in. Please refresh.</p>`;
            return;
        }
    }
    loadRooms();
});

// =============================
// Load All Rooms
// =============================
async function loadRooms() {
    roomsContainer.innerHTML = `<p class="notice">Loading rooms...</p>`;
    try {
        const serversSnap = await db.collection("servers").get();

        if (serversSnap.empty) {
            roomsContainer.innerHTML = `<p class="notice">No rooms found.</p>`;
            return;
        }

        roomsContainer.innerHTML = ""; // clear previous content

        serversSnap.forEach(async (serverDoc) => {
            const data = serverDoc.data();

            // Get members count
            const membersSnap = await db
                .collection("servers")
                .doc(serverDoc.id)
                .collection("members")
                .get();

            // Create room item
            const div = document.createElement("div");
            div.className = "roomItem";
            div.innerHTML = `
                <span class="roomName">${data.name || "Unnamed Room"}</span>
                <span class="roomCount">${membersSnap.size}/${data.maxMembers || "∞"}</span>
            `;
            div.onclick = () => openRoom(serverDoc.id, data.name);
            roomsContainer.appendChild(div);
        });
    } catch (error) {
        console.error("Error loading rooms:", error);
        roomsContainer.innerHTML = `<p class="notice">Failed to load rooms.</p>`;
    }
}

// =============================
// Open Selected Room
// =============================
async function openRoom(roomId, roomName) {
    const user = auth.currentUser;
    if (!user) return;

    currentRoomId = roomId;
    roomTitle.textContent = roomName || "Room";

    // Join room if not already a member
    const memberRef = db.collection("servers").doc(roomId).collection("members").doc(user.uid);
    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
        await memberRef.set({
            displayName: user.displayName || "Anonymous",
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // Switch to chat view
    roomsContainer.style.display = "none";
    chatContainer.style.display = "flex";

    // Load messages
    loadMessages(roomId);

    // Auto-focus input
    chatInput.focus();
}

// =============================
// Listen for Messages in Real-Time
// =============================
function loadMessages(roomId) {
    if (unsubscribeMessages) unsubscribeMessages();

    unsubscribeMessages = db
        .collection("servers")
        .doc(roomId)
        .collection("messages")
        .orderBy("timestamp", "asc")
        .onSnapshot((snapshot) => {
            chatMessages.innerHTML = "";

            if (snapshot.empty) {
                chatMessages.innerHTML = `<p class="notice">No messages yet. Say hi!</p>`;
                return;
            }

            snapshot.forEach((msgDoc) => {
                const msg = msgDoc.data();
                const div = document.createElement("div");
                div.className = "messageItem";
                div.innerHTML = `
                    <strong>${msg.senderName || "Unknown"}:</strong> ${msg.text}
                `;
                chatMessages.appendChild(div);
            });

            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
}

// =============================
// Send Message
// =============================
sendBtn.onclick = async () => {
    const text = chatInput.value.trim();
    if (!text || !currentRoomId) return;

    const user = auth.currentUser;
    if (!user) return;

    await db
        .collection("servers")
        .doc(currentRoomId)
        .collection("messages")
        .add({
            senderId: user.uid,
            senderName: user.displayName || "Anonymous",
            text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });

    chatInput.value = "";
    chatInput.focus();
};

// =============================
// Send message on Enter key
// =============================
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault(); // prevent new line
        sendBtn.click();
    }
});

// =============================
// Go Back to Room List
// =============================
backBtn.onclick = () => {
    if (unsubscribeMessages) unsubscribeMessages();
    chatMessages.innerHTML = "";
    chatInput.value = "";

    chatContainer.style.display = "none";
    roomsContainer.style.display = "grid";
};

// =============================
// Optional: Focus input if any key is pressed anywhere
// =============================
document.addEventListener("keydown", (e) => {
    if (chatContainer.style.display === "flex") {
        chatInput.focus();
    }
});

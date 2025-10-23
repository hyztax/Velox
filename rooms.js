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
const chatSettings = {
    deleteButton: {
        text: "×",
        color: "#fff",
        background: "#ff4d4f",
        hoverBackground: "#ff7875",
        fontSize: "14px",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        marginLeft: "8px",
        cursor: "pointer",
        border: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "all 0.2s ease"
    }
};

let currentRoomId = null;
let unsubscribeMessages = null;
let userUid = null;

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
    userUid = auth.currentUser.uid;
    console.log("Current UID:", userUid);
    loadRooms();
    // presence code temporarily disabled for debugging
    // setupPresence();
});

// =============================
// Load Rooms with Debug
// =============================
async function loadRooms() {
    roomsContainer.innerHTML = `<p class="notice">Loading rooms...</p>`;
    try {
        const serversSnap = await db.collection("servers").get();
        console.log("Firestore servers snapshot:", serversSnap.docs);

        if (serversSnap.empty) {
            roomsContainer.innerHTML = `<p class="notice">No rooms found.</p>`;
            return;
        }

        roomsContainer.innerHTML = "";

        serversSnap.forEach((serverDoc) => {
            const data = serverDoc.data();
            console.log("Room data:", data);

            const div = document.createElement("div");
            div.className = "roomItem";
            div.innerHTML = `
                <span class="roomName">${data.name || "Unnamed Room"}</span>
                <span class="roomCount" id="count-${serverDoc.id}">0/${data.maxMembers || 0}</span>
            `;
            roomsContainer.appendChild(div);

            // Live member count
            db.collection("servers")
                .doc(serverDoc.id)
                .collection("members")
                .onSnapshot((membersSnap) => {
                    const countSpan = document.getElementById(`count-${serverDoc.id}`);
                    const currentCount = membersSnap.size;
                    const maxMembers = data.maxMembers || 0;
                    countSpan.textContent = `${currentCount}/${maxMembers}`;
                    if (currentCount >= maxMembers) {
                        div.classList.add("roomFull");
                    } else {
                        div.classList.remove("roomFull");
                    }
                });

            div.onclick = () => openRoom(serverDoc.id, data.name, data.maxMembers || 0);
        });
    } catch (error) {
        console.error("Error loading rooms:", error);
        roomsContainer.innerHTML = `<p class="notice">Failed to load rooms.</p>`;
    }
}

// =============================
// Add user to room
// =============================
async function addUserToRoom(roomId) {
    const user = auth.currentUser;
    if (!user) return;

    const memberRef = db.collection("servers").doc(roomId).collection("members").doc(user.uid);
    await memberRef.set({
        displayName: user.displayName || "Anonymous",
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// =============================
// Open Room
// =============================
async function openRoom(roomId, roomName, maxMembers) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const roomRef = db.collection("servers").doc(roomId);
        const membersSnap = await roomRef.collection("members").get();
        const currentCount = membersSnap.size;

        if (currentCount >= maxMembers) {
            alert("Sorry, this room is full!");
            return;
        }

        const memberDoc = await roomRef.collection("members").doc(user.uid).get();
        if (!memberDoc.exists) await addUserToRoom(roomId);

        currentRoomId = roomId;
        roomTitle.textContent = roomName || "Room";
        roomsContainer.style.display = "none";
        chatContainer.style.display = "flex";

        loadMessages(roomId);
        chatInput.focus();
    } catch (err) {
        console.error("Error opening room:", err);
        alert("Failed to open room. Please try again.");
    }
}

// =============================
// Load Messages
// =============================
function loadMessages(roomId) {
    if (unsubscribeMessages) unsubscribeMessages();

    const user = auth.currentUser;

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

                div.innerHTML = `<strong>${msg.senderName || "Unknown"}:</strong> ${msg.text}`;

                if (user && msg.senderId === user.uid) {
                    const delBtn = document.createElement("button");
                    delBtn.textContent = chatSettings.deleteButton.text;
                    Object.assign(delBtn.style, chatSettings.deleteButton);

                    delBtn.onmouseenter = () => delBtn.style.background = chatSettings.deleteButton.hoverBackground;
                    delBtn.onmouseleave = () => delBtn.style.background = chatSettings.deleteButton.background;

                    delBtn.onclick = async () => {
                        try {
                            await db.collection("servers").doc(roomId).collection("messages").doc(msgDoc.id).delete();
                        } catch (err) {
                            console.error("Failed to delete message:", err);
                        }
                    };

                    div.appendChild(delBtn);
                }

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

    await db.collection("servers").doc(currentRoomId).collection("messages").add({
        senderId: user.uid,
        senderName: user.displayName || "Anonymous",
        text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    chatInput.value = "";
    chatInput.focus();
};

// =============================
// Send on Enter
// =============================
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// =============================
// Go Back
// =============================
backBtn.onclick = async () => {
    const user = auth.currentUser;
    if (unsubscribeMessages) unsubscribeMessages();
    chatMessages.innerHTML = "";
    chatInput.value = "";

    if (currentRoomId && user) {
        try {
            await db.collection("servers").doc(currentRoomId).collection("members").doc(user.uid).delete();
        } catch (err) {
            console.error("Error leaving room:", err);
        }
    }

    currentRoomId = null;
    chatContainer.style.display = "none";
    roomsContainer.style.display = "grid";
};

// =============================
// Focus input if any key
// =============================
document.addEventListener("keydown", () => {
    if (chatContainer.style.display === "flex") chatInput.focus();
});

// =============================
// Remove user on refresh/close
// =============================
window.addEventListener("beforeunload", async (e) => {
    const user = auth.currentUser;
    if (!user || !currentRoomId) return;

    try {
        await db.collection("servers")
            .doc(currentRoomId)
            .collection("members")
            .doc(user.uid)
            .delete();
        console.log("User removed from room on page unload");
    } catch (err) {
        console.error("Failed to remove user on page unload:", err);
    }
});

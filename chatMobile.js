const friendsSection = document.getElementById("friendsSection");
const chatSection = document.getElementById("chatSection");
const chatInputArea = document.getElementById("chatInputArea");
const exitBtn = document.getElementById("exitChatBtn");
const loadingScreen = document.getElementById("loadingScreen");

// -------------------- Helpers --------------------
function resetSections() {
  friendsSection.style.display = "flex";
  friendsSection.classList.remove("fade-out", "fade-in");

  chatSection.style.display = "none";
  chatSection.classList.remove("active", "fade-in");

  chatInputArea.style.display = "none";
  chatInputArea.classList.remove("active");

  exitBtn.style.display = "none";
}

// -------------------- Show chat --------------------
function showChat() {
  friendsSection.classList.add("fade-out");

  setTimeout(() => {
    friendsSection.style.display = "none";
    void chatSection.offsetWidth; // reflow for mobile
    chatSection.style.display = "flex";
    chatSection.classList.add("active", "fade-in");

    chatInputArea.style.display = "flex";
    chatInputArea.classList.add("active");

    exitBtn.style.display = "block";
  }, 200);
}



// -------------------- Event listeners --------------------
document.addEventListener("click", (e) => {
  const friendItem = e.target.closest("#friendsList li");
  if (friendItem) showChat();
});

exitBtn?.addEventListener("click", () => {
  resetSections();
});

// -------------------- Initial Load --------------------
window.addEventListener("DOMContentLoaded", () => {
  // Show loading screen for 5 seconds
  resetSections(); // ensure friend list is hidden for now
  loadingScreen.style.display = "flex";

  setTimeout(() => {
    loadingScreen.style.display = "none";
    resetSections(); // auto-exit any chat
  }, 3000); //3 sek
});

// works



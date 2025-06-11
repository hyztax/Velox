// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
  const createBtn = document.querySelector('.create-btn');
  const signInLink = document.querySelector('.signin-link a');

  if (createBtn) {
    createBtn.addEventListener('click', () => {
      window.location.href = 'signup.html';
    });
  }

  if (signInLink) {
    signInLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'signin.html';
    });
  }

  const signupForm = document.getElementById('signup-form');
  const signinForm = document.getElementById('signin-form');

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      signUp(email, password);
    });
  }

  if (signinForm) {
    signinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value;
      const password = document.getElementById('signin-password').value;
      signIn(email, password);
    });
  }
});

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
firebase.analytics();
const auth = firebase.auth();

// Sign up
function signUp(email, password) {
  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log("✅ Signed up:", userCredential.user);
      alert("Account created! Redirecting...");
      window.location.href = "chat.html"; // redirect to main app/chat
    })
    .catch((error) => {
      console.error("❌ Sign-up error:", error.message);
      alert("Error: " + error.message);
    });
}

// Sign in
function signIn(email, password) {
  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {
      console.log("✅ Signed in:", userCredential.user);
      alert("Welcome back! Redirecting...");
      window.location.href = "chat.html"; // redirect to main app/chat
    })
    .catch((error) => {
      console.error("❌ Sign-in error:", error.message);
      alert("Error: " + error.message);
    });
}


document.addEventListener('DOMContentLoaded', () => {
  const createBtn = document.querySelector('.create-btn');
  const signInLink = document.querySelector('.signin-link a');

  const accountInfo = document.createElement('div');
  accountInfo.classList.add('account-info');
  accountInfo.style.display = 'none'; // hide by default
  document.body.appendChild(accountInfo);

  createBtn.addEventListener('click', () => {
    // Redirect to signup page
    window.location.href = 'signup.html';
  });

  signInLink.addEventListener('click', () => {
    // default behavior - no extra code needed
  });

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      // User is signed in
      // Show account info in top right corner
      accountInfo.style.display = 'block';
      accountInfo.textContent = `Logged in as: ${user.email}`;

      // Redirect to main page if you're not already there
      if (!window.location.href.includes('main.html')) {
        window.location.href = 'main.html';
      }
    } else {
      // User is not signed in
      accountInfo.style.display = 'none';
    }
  });
});

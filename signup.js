
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
const db = firebase.firestore(); // Firestore initialized properly

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  const signupForm = document.getElementById('signup-form');
  const usernameInput = signupForm.querySelector('input[name="username"]');
  const emailInput = signupForm.querySelector('input[name="email"]');
  const passwordInput = signupForm.querySelector('input[name="password"]');

  // Username validation
  usernameInput.addEventListener('input', () => {
    const value = usernameInput.value.trim();
    const valid = /^[a-zA-Z]{3,10}$/.test(value);

    if (!valid) {
      usernameInput.setCustomValidity("You need 3–10 letters (A–Z only)");
      usernameInput.reportValidity();
      usernameInput.style.borderColor = 'red';
    } else {
      usernameInput.setCustomValidity('');
      usernameInput.style.borderColor = '';
    }
  });

  // Form submission
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !email || !password) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      // Create Auth user
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Set display name
      await user.updateProfile({ displayName: username });

      // Save in Firestore with join date
      await db.collection('users').doc(user.uid).set({
        username,
        email,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Send verification email
      await user.sendEmailVerification();

      // Sign out
      await auth.signOut();

      alert(`✅ Verification email sent to ${email}. Please check your inbox (or spam).`);
      window.location.href = 'signin.html';

    } catch (error) {
      console.error(error);
      alert(`Error: ${error.message}`);
    }
  });
});
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

  // Initialize Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const auth = firebase.auth();

  // ===== Signin Form =====
  const signinForm = document.getElementById('signin-form');
  if (signinForm) {
    signinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signinForm.email.value.trim();
      const password = signinForm.password.value.trim();

      if (!email || !password) {
        alert('Please fill in all fields.');
        return;
      }

      try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user.emailVerified) {
          window.location.href = 'index.html';
        } else {
          alert("⚠️ Please verify your email before logging in.");
          await auth.signOut();
        }
      } catch (error) {
        alert(`Error: ${error.message}`);
        console.error(error);
      }
    });
  }

  // ===== Reset Password Form =====
  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('reset-email');
      const email = emailInput.value.trim();

      if (!email) {
        alert("Please enter your email.");
        return;
      }

      try {
        await auth.sendPasswordResetEmail(email);
        alert("✅ Password reset email sent! Check your inbox (or spam).");
        resetForm.reset();
      } catch (error) {
        alert(`Error: ${error.message}`);
        console.error(error);
      }
    });
  }
});

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

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();

  // ===== Global auth listener =====
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      await user.reload(); // refresh emailVerified status
      if (user.emailVerified) {
        // Redirect immediately for verified users
        window.location.replace('main.html');
      }
    }
  });

  // ===== Sign In Form =====
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
        await user.reload();

        if (!user.emailVerified) {
          await user.sendEmailVerification();
          await auth.signOut();
          alert("⚠️ Please verify your email before logging in. Verification email sent again.");
          return;
        }

        // No need for another onAuthStateChanged here; listener will redirect automatically

      } catch (error) {
        alert(`Error: ${error.message}`);
        console.error(error);
      }
    });
  }
});

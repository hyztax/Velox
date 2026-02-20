auth.onAuthStateChanged(async (user) => {
  if (user) {
    await user.reload();
    if (user.emailVerified) {
      window.location.href = 'main.html';
    }
  }
});


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

  const signinForm = document.getElementById('signin-form');
  const resetForm = document.getElementById('reset-form');

 
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
        alert("⚠️ Verify your email before logging in. Verification email sent again.");
        return;
      }

     
      alert("✅ Welcome back! Redirecting...");
      window.location.href = 'main.html';

    } catch (error) {
      alert(`Error: ${error.message}`);
      console.error(error);
    }
  });
}


  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = resetForm['reset-email'].value.trim();
      if (!email) {
        alert("Please enter your email.");
        return;
      }

      try {
        await auth.sendPasswordResetEmail(email);
        alert("Password reset was sent! Check your inbox (or spam).");
        resetForm.reset();
      } catch (error) {
        alert(`Error: ${error.message}`);
        console.error(error);
      }
    });
  }
});

// works
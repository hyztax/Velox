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

  const app = firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth(app);

  const signinForm = document.getElementById('signin-form');
  if (!signinForm) return console.error('Signin form not found!');

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();

    if (!email || !password) {
      alert('Please fill in all fields.');
      return;
    }

    try {
      const userCredential = await auth.signInWithEmailAndPassword(email, password);
     // alert(`Welcome back, ${userCredential.user.displayName || 'User'}! You are signed in.`);
      window.location.href = 'index.html';  
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
});


// works 
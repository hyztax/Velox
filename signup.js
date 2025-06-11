// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBXb9OhOEOo4gXNIv2WcCNmXfnm1x7R2EM",
  authDomain: "velox-c39ad.firebaseapp.com",
  projectId: "velox-c39ad",
  storageBucket: "velox-c39ad.appspot.com",
  messagingSenderId: "404832661601",
  appId: "1:404832661601:web:9ad221c8bfb459410bba20",
  measurementId: "G-X8W755KRF6"
};

// Initialize Firebase (using compat)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Initialize Firestore here

const usernameInput = document.querySelector('#signup-form input[name="username"]');

usernameInput.addEventListener('input', () => {
  const value = usernameInput.value.trim();
  const valid = /^[a-zA-Z]{3,10}$/.test(value);

  if (!valid) {
    usernameInput.setCustomValidity("You need 3–10 letters (A–Z only)");
    usernameInput.reportValidity(); // Show message
    usernameInput.style.borderColor = 'red';
  } else {
    usernameInput.setCustomValidity('');
    usernameInput.style.borderColor = ''; // Reset
  }
});

document.getElementById('signup-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = e.target.username.value.trim();
  const email = e.target.email.value.trim();
  const password = e.target.password.value.trim();

  if (!username || !email || !password) {
    alert('Please fill in all fields.');
    return;
  }

  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);

    // Update the user profile on Auth
    await userCredential.user.updateProfile({
      displayName: username
    });

    // Create Firestore user document
    await db.collection('users').doc(userCredential.user.uid).set({
      displayName: username,
      bio: "",
      avatarUrl: null,
      email: email
    });

    window.location.href = 'signin.html';

  } catch (error) {
    alert(`Error: ${error.message}`);
  }
});

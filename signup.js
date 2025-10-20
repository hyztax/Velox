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
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Update display name
    await user.updateProfile({ displayName: username });

    // Save to Firestore
    await db.collection('users').doc(user.uid).set({
      username,
      email,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Verify
    await user.sendEmailVerification();

    alert(`✅ Verification email sent to ${email}.`);
    window.location.href = 'signin.html';
  } catch (error) {
    console.error(error);
    alert(`Error: ${error.message}`);
  }
});

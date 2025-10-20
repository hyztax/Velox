const admin = require("firebase-admin");

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccountKey.json"))
});

const db = admin.firestore();

async function migrateJoinDates() {
  const listUsersResult = await admin.auth().listUsers();
  
  for (const user of listUsersResult.users) {
    const userRef = db.collection("users").doc(user.uid);
    const doc = await userRef.get();

    if (!doc.exists || !doc.data().joinedAt) {
      await userRef.set({
        username: user.displayName || "",
        email: user.email || "",
        joinedAt: admin.firestore.Timestamp.fromDate(new Date(user.metadata.creationTime))
      }, { merge: true });

      console.log(`Migrated join date for ${user.uid}`);
    }
  }

  console.log("Migration done!");
}

migrateJoinDates();

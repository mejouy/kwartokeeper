// functions/localPushListener.js
//
// Free alternative to the Cloud Function (no Blaze plan needed).
// Listens to new documents in `notifications` and sends an FCM push to the
// recipient (notification.userId). Must be running for pushes to be sent.
//
// Usage (from the functions folder):
//   node localPushListener.js
//
// Needs a service account key saved as functions/serviceAccountKey.json
// (Firebase Console > Project settings > Service accounts > Generate new private key).
// NEVER commit that key.

const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const serviceAccount = require(path.join(__dirname, "serviceAccountKey.json"));
initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

async function sendPush(notificationId, notification) {
  const userId = notification.userId;
  if (!userId) return;

  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const tokens = (userSnap.exists && userSnap.data().fcmTokens) || [];
  if (!Array.isArray(tokens) || tokens.length === 0) {
    console.log(`[skip] ${notificationId}: user ${userId} has no tokens`);
    return;
  }

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: notification.title || "KwartoKeeper",
      body: notification.message || "",
    },
    data: {
      notificationId,
      type: String(notification.type || ""),
    },
    android: { priority: "high" },
  });

  console.log(
    `[sent] ${notificationId} -> ${userId}: ${response.successCount} ok, ${response.failureCount} failed`,
  );

  // Remove tokens that no longer work (app uninstalled, logged out, etc.)
  const deadTokens = [];
  response.responses.forEach((result, index) => {
    if (!result.success && DEAD_TOKEN_CODES.has(result.error?.code)) {
      deadTokens.push(tokens[index]);
    }
  });
  if (deadTokens.length > 0) {
    await userRef.update({
      fcmTokens: FieldValue.arrayRemove(...deadTokens),
    });
  }
}

let firstSnapshot = true;

db.collection("notifications").onSnapshot(
  (snapshot) => {
    // The first snapshot contains every existing document; skip those so old
    // notifications are not sent again.
    if (firstSnapshot) {
      firstSnapshot = false;
      console.log(
        `Listening for new notifications (ignored ${snapshot.size} existing)...`,
      );
      return;
    }
    snapshot.docChanges().forEach((change) => {
      if (change.type !== "added") return;
      sendPush(change.doc.id, change.doc.data()).catch((err) =>
        console.error(`[error] ${change.doc.id}:`, err),
      );
    });
  },
  (err) => console.error("Listener error:", err),
);

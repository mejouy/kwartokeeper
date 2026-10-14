// functions/src/pushNotifications.js
//
// Sends a push notification whenever a document is created in `notifications`.
// Covers every source: the scheduled lease reminders AND notifications created
// from the app. The recipient is notification.userId.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

exports.sendPushOnNotification = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    region: "asia-southeast1", // must match the Firestore database location
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const notification = snapshot.data();
    const userId = notification.userId;
    if (!userId) return;

    const db = getFirestore();
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const tokens = (userSnap.exists && userSnap.data().fcmTokens) || [];
    if (!Array.isArray(tokens) || tokens.length === 0) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: notification.title || "KwartoKeeper",
        body: notification.message || "",
      },
      data: {
        notificationId: event.params.notificationId,
        type: String(notification.type || ""),
      },
      android: { priority: "high" },
    });

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
  },
);

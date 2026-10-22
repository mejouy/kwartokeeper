// Deletes a property's cover photo and rule documents from storage once the
// property stops using them (removed, replaced, or the property was deleted).
//
// Runs on the server because deleting from Cloudinary needs the account's API
// secret, which must never be shipped to the browser. Set it once with:
//   firebase functions:secrets:set CLOUDINARY_API_KEY
//   firebase functions:secrets:set CLOUDINARY_API_SECRET
const crypto = require("node:crypto");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const {
  COVER_FIELDS,
  removedMediaUrls,
  parseCloudinaryUrl,
  parseFirebaseStorageUrl,
  cloudinarySignaturePayload,
} = require("./mediaUrls.js");

// Only this app's own Cloudinary account is ever touched.
const CLOUD_NAME = "pdgumr5m";

const CLOUDINARY_API_KEY = defineSecret("CLOUDINARY_API_KEY");
const CLOUDINARY_API_SECRET = defineSecret("CLOUDINARY_API_SECRET");

async function destroyOnCloudinary({ resourceType, publicId }) {
  const params = { invalidate: true, public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const signature = crypto
    .createHash("sha1")
    .update(cloudinarySignaturePayload(params, CLOUDINARY_API_SECRET.value()))
    .digest("hex");

  const body = new URLSearchParams({ ...params, api_key: CLOUDINARY_API_KEY.value(), signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/destroy`, { method: "POST", body });
  const data = await response.json().catch(() => ({}));
  // "not found" is fine: it is already gone
  if (!response.ok || !["ok", "not found"].includes(data.result)) {
    throw new Error(`Cloudinary destroy failed for ${publicId}: ${response.status} ${JSON.stringify(data)}`);
  }
  return data.result;
}

// Another property could (in theory) share the same link; never delete a file
// that something else still shows.
async function stillUsedElsewhere(db, url, propertyId) {
  for (const field of COVER_FIELDS) {
    const snapshot = await db.collection("properties").where(field, "==", url).limit(2).get();
    if (snapshot.docs.some((d) => d.id !== propertyId)) return true;
  }
  return false;
}

exports.cleanUpPropertyMedia = onDocumentWritten(
  { document: "properties/{propertyId}", secrets: [CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET] },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!before) return; // newly created: nothing was removed

    const removed = removedMediaUrls(before, after);
    if (removed.length === 0) return;

    const db = getFirestore();
    const { propertyId } = event.params;

    for (const url of removed) {
      try {
        if (await stillUsedElsewhere(db, url, propertyId)) {
          logger.info("Media still used by another property, kept", { url });
          continue;
        }

        const cloudinary = parseCloudinaryUrl(url);
        if (cloudinary) {
          if (cloudinary.cloudName !== CLOUD_NAME) continue;
          const result = await destroyOnCloudinary(cloudinary);
          logger.info("Deleted property media from Cloudinary", { propertyId, publicId: cloudinary.publicId, result });
          continue;
        }

        const storageFile = parseFirebaseStorageUrl(url);
        if (storageFile) {
          await getStorage().bucket(storageFile.bucket).file(storageFile.path).delete({ ignoreNotFound: true });
          logger.info("Deleted property media from Firebase Storage", { propertyId, path: storageFile.path });
        }
        // Any other link (e.g. pasted from another site) isn't ours to delete.
      } catch (error) {
        // One failed file shouldn't stop the others; it can be cleaned up later.
        logger.error("Could not delete property media", { propertyId, url, error: error.message });
      }
    }
  },
);

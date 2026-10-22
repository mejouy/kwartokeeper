// Pure helpers for cleaning up property media (no Firebase imports, so they
// can be unit tested with `node --test`).

// Every field a property's cover photo has ever been saved under.
const COVER_FIELDS = ["coverPhotoUrl", "coverPhoto", "imageUrl", "photoUrl"];

/** Every media link a property document points at: cover photo(s) and rule documents. */
function mediaUrlsOf(property) {
  const urls = new Set();
  if (!property) return urls;
  for (const field of COVER_FIELDS) {
    const value = property[field];
    if (typeof value === "string" && value.trim()) urls.add(value.trim());
  }
  if (Array.isArray(property.ruleFiles)) {
    for (const file of property.ruleFiles) {
      if (file && typeof file.url === "string" && file.url.trim()) urls.add(file.url.trim());
    }
  }
  return urls;
}

/** Links that were on the property before the change and are gone after it. */
function removedMediaUrls(before, after) {
  const kept = mediaUrlsOf(after);
  return [...mediaUrlsOf(before)].filter((url) => !kept.has(url));
}

/**
 * Reads a Cloudinary delivery link.
 * https://res.cloudinary.com/<cloud>/<image|video|raw>/upload/[v123/]<public_id>[.ext]
 * Returns { cloudName, resourceType, publicId } or null when it isn't one.
 * Images and videos are addressed without the file extension; raw files keep it.
 */
function parseCloudinaryUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== "res.cloudinary.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  // [cloud, resourceType, "upload", ...rest]
  if (parts.length < 4 || parts[2] !== "upload") return null;
  const [cloudName, resourceType] = parts;
  if (!["image", "video", "raw"].includes(resourceType)) return null;

  let rest = parts.slice(3);
  const versionAt = rest.findIndex((segment) => /^v\d+$/.test(segment));
  if (versionAt !== -1) rest = rest.slice(versionAt + 1);
  if (rest.length === 0) return null;

  let publicId = rest.map((segment) => decodeURIComponent(segment)).join("/");
  if (resourceType !== "raw") publicId = publicId.replace(/\.[a-z0-9]+$/i, "");
  return publicId ? { cloudName, resourceType, publicId } : null;
}

/**
 * Reads a Firebase Storage download link (older uploads).
 * https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?alt=media...
 */
function parseFirebaseStorageUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.hostname !== "firebasestorage.googleapis.com") return null;
  const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: decodeURIComponent(match[2]) };
}

/** The string Cloudinary signs: sorted params joined with &, secret appended. */
function cloudinarySignaturePayload(params, apiSecret) {
  return (
    Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&") + apiSecret
  );
}

module.exports = {
  COVER_FIELDS,
  mediaUrlsOf,
  removedMediaUrls,
  parseCloudinaryUrl,
  parseFirebaseStorageUrl,
  cloudinarySignaturePayload,
};

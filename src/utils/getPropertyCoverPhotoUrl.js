const PROPERTY_COVER_PHOTO_FIELDS = [
  "coverPhotoUrl",
  "coverPhoto",
  "imageUrl",
  "photoUrl",
];

export function getPropertyCoverPhotoUrl(property) {
  if (!property) return "";

  for (const field of PROPERTY_COVER_PHOTO_FIELDS) {
    const url = property[field];
    if (typeof url === "string" && url.trim()) return url.trim();
  }

  return "";
}

export default getPropertyCoverPhotoUrl;

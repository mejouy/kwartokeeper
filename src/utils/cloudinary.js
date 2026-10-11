const CLOUD_NAME = "pdgumr5m";
const UPLOAD_PRESET = "kwartokeeper-preset"; // Must match your Cloudinary preset name exactly

async function postToCloudinary(resourceType, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || "Failed to upload to Cloudinary.");
  }

  const data = await response.json();
  return data.secure_url;
}

// Photos (unchanged behaviour): images only, up to 5 MB.
export async function uploadToCloudinary(file) {
  if (!file) return null;

  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File "${file.name}" exceeds the ${MAX_SIZE_MB}MB size limit.`);
  }

  return postToCloudinary("image", file);
}

// Documents (PDF, Word and other non-image files): Cloudinary picks the right type itself.
// The /image endpoint above rejects Word files, so documents use this one.
export async function uploadFileToCloudinary(file, maxMb = 10) {
  if (!file) return null;

  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`File "${file.name}" exceeds the ${maxMb}MB size limit.`);
  }

  return postToCloudinary("auto", file);
}
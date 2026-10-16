const CLOUD_NAME = "pdgumr5m"; 
const UPLOAD_PRESET = "kwartokeeper_preset"; // Must match your Cloudinary preset name exactly

export async function uploadToCloudinary(file) {
  if (!file) return null;

  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File "${file.name}" exceeds the ${MAX_SIZE_MB}MB size limit.`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to upload image to Cloudinary.");
  }

  const data = await response.json();
  return data.secure_url;
}
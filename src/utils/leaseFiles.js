// Lease contract files on a tenant (tenant.leaseFiles), see components/LeaseFiles.jsx.
// Saved shape: [{ url, name, type, uploadedAt (ISO) }], newest last.
import { uploadFileToCloudinary, uploadToCloudinary } from "./cloudinary";
import { t } from "../i18n";

export const MAX_LEASE_FILES = 10;
const MAX_IMAGE_MB = 5;
const MAX_PDF_MB = 10;

export const isImageFile = (f) => /^image\//i.test(f?.type || "") || /\.(png|jpe?g|gif|webp|avif|heic)(\?|$)/i.test(f?.url || f?.name || "");
export const isPdfFile = (f) => /pdf/i.test(f?.type || "") || /\.pdf(\?|$)/i.test(f?.url || f?.name || "");
export const shortDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/** Why a picked file can't be used, or "". */
export function leaseFileProblem(file) {
  if (!file) return t("No file chosen.");
  if (isImageFile(file)) return file.size > MAX_IMAGE_MB * 1024 * 1024 ? t("{name} is over {mb} MB. Choose a smaller picture.", { name: file.name, mb: MAX_IMAGE_MB }) : "";
  if (isPdfFile(file)) return file.size > MAX_PDF_MB * 1024 * 1024 ? t("{name} is over {mb} MB. Choose a smaller file.", { name: file.name, mb: MAX_PDF_MB }) : "";
  return t("{name} isn't a picture or a PDF.", { name: file.name });
}

/** Uploads picked files; returns saved entries in the same order. */
export async function uploadLeaseFiles(files = []) {
  const uploadedAt = new Date().toISOString();
  const out = [];
  for (const file of files) {
    const url = isImageFile(file) ? await uploadToCloudinary(file) : await uploadFileToCloudinary(file, MAX_PDF_MB);
    out.push({ url, name: file.name || "Lease", type: file.type || (isPdfFile(file) ? "application/pdf" : "image/jpeg"), uploadedAt });
  }
  return out;
}

/** Keeps only well-formed saved entries (anything else in old data is ignored). */
export const leaseFilesOf = (record) =>
  (Array.isArray(record?.leaseFiles) ? record.leaseFiles : []).filter((f) => f && typeof f.url === "string" && /^https:\/\//.test(f.url));

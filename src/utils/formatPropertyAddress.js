export function formatPropertyAddress(propertyOrAddress) {
  if (!propertyOrAddress) return "No address specified";
  if (typeof propertyOrAddress === "string") return propertyOrAddress.trim() || "No address specified";

  const address = propertyOrAddress.address && typeof propertyOrAddress.address === "object"
    ? propertyOrAddress.address
    : propertyOrAddress;
  const parts = [
    typeof propertyOrAddress.address === "string"
      ? propertyOrAddress.address
      : address.street || propertyOrAddress.street || propertyOrAddress.streetAddress,
    address.barangay || propertyOrAddress.barangay,
    address.cityMunicipality || propertyOrAddress.cityMunicipality || propertyOrAddress.city,
    address.province || propertyOrAddress.province,
    address.region || propertyOrAddress.region,
  ].filter((part) => typeof part === "string" && part.trim());
  const uniqueParts = [...new Set(parts.map((part) => part.trim()))];

  return uniqueParts.length ? uniqueParts.join(", ") : "No address specified";
}

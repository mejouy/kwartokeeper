const test = require("node:test");
const assert = require("node:assert/strict");
const {
  mediaUrlsOf,
  removedMediaUrls,
  parseCloudinaryUrl,
  parseFirebaseStorageUrl,
  cloudinarySignaturePayload,
} = require("./mediaUrls.js");

const COVER = "https://res.cloudinary.com/pdgumr5m/image/upload/v1760000000/abc123.jpg";
const DOC = "https://res.cloudinary.com/pdgumr5m/raw/upload/v1760000001/rules_xyz.docx";

test("collects cover fields (old and new names) and rule documents", () => {
  const urls = mediaUrlsOf({ coverPhotoUrl: COVER, imageUrl: "https://x/old.jpg", ruleFiles: [{ url: DOC }, { name: "no url" }] });
  assert.deepEqual([...urls].sort(), [COVER, DOC, "https://x/old.jpg"].sort());
});

test("removing the cover photo reports it as removed", () => {
  assert.deepEqual(removedMediaUrls({ coverPhotoUrl: COVER }, { coverPhotoUrl: null }), [COVER]);
});

test("replacing the cover reports only the old one", () => {
  const next = "https://res.cloudinary.com/pdgumr5m/image/upload/v1760000099/new.jpg";
  assert.deepEqual(removedMediaUrls({ coverPhotoUrl: COVER }, { coverPhotoUrl: next }), [COVER]);
});

test("a legacy field cleared alongside the main one is removed too", () => {
  assert.deepEqual(removedMediaUrls({ coverPhotoUrl: COVER, photoUrl: COVER }, {}), [COVER]);
});

test("unchanged media and deleted documents", () => {
  assert.deepEqual(removedMediaUrls({ coverPhotoUrl: COVER, ruleFiles: [{ url: DOC }] }, { coverPhotoUrl: COVER, ruleFiles: [] }), [DOC]);
  assert.deepEqual(removedMediaUrls({ coverPhotoUrl: COVER }, { coverPhotoUrl: COVER }), []);
});

test("deleting the property removes everything", () => {
  assert.deepEqual(removedMediaUrls({ coverPhotoUrl: COVER, ruleFiles: [{ url: DOC }] }, undefined).sort(), [COVER, DOC].sort());
});

test("parses Cloudinary image links without the extension", () => {
  assert.deepEqual(parseCloudinaryUrl(COVER), { cloudName: "pdgumr5m", resourceType: "image", publicId: "abc123" });
  assert.deepEqual(parseCloudinaryUrl("https://res.cloudinary.com/pdgumr5m/image/upload/v1/folder/sub/pic.png"), {
    cloudName: "pdgumr5m",
    resourceType: "image",
    publicId: "folder/sub/pic",
  });
});

test("keeps the extension for raw files", () => {
  assert.deepEqual(parseCloudinaryUrl(DOC), { cloudName: "pdgumr5m", resourceType: "raw", publicId: "rules_xyz.docx" });
});

test("ignores links that aren't Cloudinary uploads", () => {
  assert.equal(parseCloudinaryUrl("https://example.com/a.jpg"), null);
  assert.equal(parseCloudinaryUrl("not a url"), null);
  assert.equal(parseCloudinaryUrl("https://res.cloudinary.com/pdgumr5m/image/fetch/v1/a.jpg"), null);
});

test("parses Firebase Storage download links", () => {
  assert.deepEqual(
    parseFirebaseStorageUrl("https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/properties%2Fp1%2Fcover.jpg?alt=media&token=t"),
    { bucket: "demo.appspot.com", path: "properties/p1/cover.jpg" },
  );
  assert.equal(parseFirebaseStorageUrl(COVER), null);
});

test("signature payload sorts params and appends the secret", () => {
  assert.equal(
    cloudinarySignaturePayload({ timestamp: 10, public_id: "abc", invalidate: true }, "SECRET"),
    "invalidate=true&public_id=abc&timestamp=10SECRET",
  );
});

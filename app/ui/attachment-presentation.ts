import type { AttachmentRef } from "../domain/model";

const imageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

export function isImageAttachment(attachment: AttachmentRef) {
  if (attachment.mediaType?.toLowerCase().startsWith("image/")) return true;
  const extension = attachment.name.split(".").at(-1)?.toLowerCase();
  return Boolean(extension && imageExtensions.has(extension));
}

/** Public demo never loads remote screenshots or arbitrary application endpoints. */
export function safeAttachmentUrl(url?: string) {
  if (url === "/demo-feedback.svg" || new RegExp("^data:image/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$").test(url ?? "")) return url!;
  return "/demo-feedback.svg";
}

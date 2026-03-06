import { createContext, useContext } from "react";
import { AttachmentID, AttachmentMIMEType } from "@withorbit/core";

export interface AttachmentResolution {
  url: string;
  mimeType: AttachmentMIMEType;
}

export type AttachmentResolver = (
  id: AttachmentID,
) => Promise<AttachmentResolution | null>;

const AttachmentResolverContext = createContext<AttachmentResolver | null>(null);

export const AttachmentResolverProvider = AttachmentResolverContext.Provider;

export function useAttachmentResolver(): AttachmentResolver {
  const resolver = useContext(AttachmentResolverContext);
  if (!resolver) {
    throw new Error(
      "useAttachmentResolver must be used within an AttachmentResolverProvider",
    );
  }
  return resolver;
}

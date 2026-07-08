import { GraphQLError } from "graphql";

/**
 * Upload validation at the API boundary (Security §4.5: "Validate file
 * uploads: allowed types (PDF only for MVP), size limits, and reject anything
 * else").
 *
 * The MIME type reported by the client is not trusted — it's trivially
 * spoofable — so the real check is the PDF magic number in the actual bytes.
 * Errors are thrown as GraphQLError with safe, generic messages (Security
 * §4.5: never echo internals to the client).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

// Every PDF begins with the bytes "%PDF-".
const PDF_MAGIC = Buffer.from("%PDF-", "latin1");

export function validatePdfUpload(filename: string, buffer: Buffer): void {
  if (buffer.length === 0) {
    throw new GraphQLError("The uploaded file is empty.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new GraphQLError("That file is too large. Please upload a PDF under 10 MB.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const startsWithPdfMagic = buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
  if (!startsWithPdfMagic) {
    throw new GraphQLError("That doesn't look like a PDF. Please upload a PDF policy document.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  if (!filename.toLowerCase().endsWith(".pdf")) {
    throw new GraphQLError("Please upload a file with a .pdf extension.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

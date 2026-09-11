/**
 * Hook to handle file uploads with support for S3 and local fallback.
 *
 * Uses the configured `NEXT_PUBLIC_UPLOAD_MODE` environment variable:
 * - `"s3"`: Attempts to upload to S3 via a presigned URL provided by the API.
 * - `"local"` (default): Uploads to the local API endpoint.
 *
 * @returns A React Query `useMutation` object with standard properties:
 * - `mutate` / `mutateAsync` - function to perform the upload
 * - `isLoading` - true while upload is in progress
 * - `isError` - true if upload failed
 * - `error` - error object (if any)
 * - `data` - result of successful upload `{ url: string; fileName: string }
 */
import { useMutation } from "@tanstack/react-query";
import { useApi } from "./useApiCore";
import logger from "../lib/logger";

export function useUpload() {
  const api = useApi();

  return useMutation({
    mutationFn: async ({ file, folder = "general" }: { file: File; folder?: string }) => {
      const UPLOAD_MODE = process.env.NEXT_PUBLIC_UPLOAD_MODE || "local";

      if (UPLOAD_MODE === "s3") {
        try {
          const presign = await api.upload.presign({
            fileName: file.name,
            contentType: file.type,
            folder,
          });
          const s3Res = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!s3Res.ok) throw new Error("S3 upload failed");
          return { url: presign.publicUrl, fileName: file.name };
        } catch (err) {
          logger.warn("S3 upload failed, falling back to local:", err);
        }
      }

      const result = await api.upload.local(file, folder);
      return { url: result.url, fileName: result.fileName };
    },
  });
}

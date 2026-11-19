// Storage mock features (ST): what each is and what it lets a developer do.
import type { FeatureSummary } from "./feature-summaries";

export const storageFeatureSummaries: Record<string, FeatureSummary> = {
  "ST-01": {
    summary:
      "An S3-compatible API: buckets, objects, multipart uploads, presigned URLs, browser POST uploads and CORS, answered as S3 does, with presets for R2, Spaces, MinIO, B2 and Wasabi.",
    outcome:
      "Point the AWS SDKs, the AWS CLI or a Laravel s3 disk at SendMock and test uploads without a real bucket.",
  },
  "ST-02": {
    summary:
      "A Storage screen that browses buckets and files with previews and presigned URLs, the same in REST, CLI and MCP, and S3 event notifications to webhooks.",
    outcome: "See every file an app uploaded and react to uploads in tests.",
  },
  "ST-03": {
    summary:
      "Uploaded files kept by SendMock within a size limit, or written as real files to a folder you choose.",
    outcome:
      "Open uploaded files in the file manager when you want them, without filling the disk by default.",
  },
  "ST-04": {
    summary:
      "Google Cloud Storage's JSON API and Azure Blob Storage, answered as the real services over the same buckets and files.",
    outcome: "Test apps that store files on Google Cloud or Azure locally too.",
  },
  "ST-05": {
    summary:
      "Image upload vendors: Cloudinary, ImageKit, Uploadcare and Cloudflare Images, each with its own upload API, answer, signature check and notification.",
    outcome:
      "Test image uploads to the vendor an app uses, with the URLs it expects back.",
  },
  "ST-06": {
    summary:
      "Your own storage service: define the upload, download, delete, list and metadata endpoints, their auth and their answers in any format.",
    outcome:
      "Mock an in-house or regional storage API that SendMock does not ship.",
  },
};

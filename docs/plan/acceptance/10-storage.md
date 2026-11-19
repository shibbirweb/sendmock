# Acceptance: Storage (ST)

Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06). Rules for IDs, ticking and tests: [README.md](README.md).

## ST-01 S3-compatible storage API

2.0.0 (A25), planned 2026-11-20 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06) (A25).

- [ ] ST-01.1 Buckets can be created, listed, checked and deleted, and objects put, fetched (with `Range`), checked, copied, deleted (one or many) and listed (v2, with `prefix`, `delimiter` and continuation tokens) at S3's paths, with S3's XML answers, headers (`ETag` as the MD5, `Content-Type`, `x-amz-meta-*`) and XML errors (`NoSuchBucket`, `NoSuchKey`, `BucketAlreadyOwnedByYou`, `BucketNotEmpty`).
- [ ] ST-01.2 Multipart uploads can be created, uploaded part by part, listed, completed into one object with S3's multipart `ETag`, and aborted.
- [ ] ST-01.3 Path-style addressing always works, and virtual-hosted-style works when the `Host` names a bucket.
- [ ] ST-01.4 Any credentials pass by default; with Check credentials on, a wrong Signature Version 4 in the header or a presigned URL answers `SignatureDoesNotMatch`; an expired presigned URL is always refused.
- [ ] ST-01.5 Browser POST uploads with a policy store the object and honour `success_action_status` and `success_action_redirect`, and CORS preflight answers from the bucket's CORS rules.
- [ ] ST-01.6 Amazon S3, Cloudflare R2, DigitalOcean Spaces, MinIO, Backblaze B2 and Wasabi are built-in storage providers, presets of the same S3 adapter with their endpoint styles.
- [ ] ST-01.7 In CI, the AWS SDKs for JavaScript, Python, PHP and Go and the AWS CLI put, get, list, upload in parts and use presigned GET and PUT URLs, and a Laravel app stores and reads a file on its `s3` disk.

## ST-02 Storage screen and every surface

2.0.0 (A25), planned 2026-11-20 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06) (A25).

- [ ] ST-02.1 The Storage screen lists buckets per provider and browses objects as folders, newest first or by name, and updates live as files arrive or are deleted.
- [ ] ST-02.2 An object's detail previews images, text, JSON and PDF, shows its size, type, `ETag` and metadata, downloads it, deletes it, and makes a presigned URL with a chosen expiry.
- [ ] ST-02.3 Files can be uploaded and buckets created and deleted from the screen.
- [ ] ST-02.4 REST, CLI and MCP list, read, upload and delete objects and manage buckets, from the `sendmock-ops` registry, and the seed file holds buckets and their settings but never file contents.
- [ ] ST-02.5 `storage.object.created` and `storage.object.deleted` reach webhook rules, with a built-in S3 event notification template (`Records`, `eventName` without the `s3:` prefix, the URL-encoded key, `size`, `eTag` and `sequencer`) checked against AWS's documented example.
- [ ] ST-02.6 The docs and the agent skill describe the storage APIs, the screen and the commands.

## ST-03 Where uploaded files are kept

2.0.0 (A25), planned 2026-11-20 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06) (A25).

- [ ] ST-03.1 By default files are kept in SendMock's data folder (in memory with `--db memory`), within `--max-storage` (default 1 GB) and the traffic retention, oldest pruned first.
- [ ] ST-03.2 Settings > Storage > Keep files in a folder (`--storage-dir`, `SENDMOCK_STORAGE_DIR`, `storage_dir`) writes each file as a real file at `<folder>/<provider>/<bucket>/<key>` and reads it back from there; a folder that does not exist or is not writable is refused with the reason.
- [ ] ST-03.3 A key that would leave the folder (`..`, an absolute path) is refused with S3's `InvalidArgument` and nothing is written, and names the file system cannot hold are encoded and read back unchanged.
- [ ] ST-03.4 Turning the folder on or off asks whether to copy the existing files, and does so when asked; files in the folder are pruned only when Prune the folder too is on.
- [ ] ST-03.5 Settings > Storage, REST, CLI and MCP show and change the folder and the size limit, and the docs explain both.

## ST-04 Google Cloud Storage and Azure Blob Storage

2.0.0 (A25), planned 2026-11-20 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06) (A25).

- [ ] ST-04.1 Google Cloud Storage's JSON API answers media, multipart and resumable uploads, get (metadata and `alt=media`), list (with `prefix` and `delimiter`) and delete, in its JSON shapes and errors.
- [ ] ST-04.2 Azure Blob Storage answers Put Blob, Get Blob, List Blobs and Delete Blob for containers, in its XML shapes and errors, with Shared Key and SAS tokens checked when Check credentials is on.
- [ ] ST-04.3 Both store into the same buckets and objects, shown on the Storage screen under their provider.
- [ ] ST-04.4 In CI, the Google Cloud Storage and Azure Blob SDKs (Node and Python) upload, read, list and delete a file.

## ST-05 Image upload vendors

2.0.0 (A25), planned 2026-11-20 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06) (A25).

- [ ] ST-05.1 Cloudinary's upload API answers `public_id`, `version`, `format`, `width`, `height`, `bytes` and `secure_url` with its errors, checks its SHA-1 signature (or Basic auth) when Check credentials is on, and calls the `notification_url` when given.
- [ ] ST-05.2 ImageKit's upload API answers `fileId`, `name`, `url` and `thumbnailUrl` with its errors, using the private key.
- [ ] ST-05.3 Uploadcare's `/base/` upload answers the file's UUID, and the file is served at its CDN URL.
- [ ] ST-05.4 Cloudflare Images answers uploads and one-time direct upload URLs with the image's `variants`.
- [ ] ST-05.5 Each vendor's answered URL serves the original file, transformations in the URL are accepted and ignored with a header that says so, and uploads show on the Storage screen under the vendor with the width and height read from the file.
- [ ] ST-05.6 In CI, the Cloudinary, ImageKit and Uploadcare SDKs upload an image and read its URL.

## ST-06 Your own storage service

2.0.0 (A25), planned 2026-11-20 by owner request. Plan: [32-after-1-0.md](../32-after-1-0.md#a25-storage-mock-st-01-to-st-06) (A25).

- [ ] ST-06.1 A custom storage provider can be created from blank or from a built-in, edited, exported and reset, from the UI, REST, CLI, MCP and the seed file.
- [ ] ST-06.2 It has upload (a multipart field or the raw body, with the key from a template), download, delete, list and metadata operations, each with a method, a path pattern and the request fields it reads.
- [ ] ST-06.3 Each operation has an auth check (a header, a query token or none) and answer and error templates in JSON, XML or text using the webhook template language.
- [ ] ST-06.4 A live preview runs a sample request against an operation and shows the answer.
- [ ] ST-06.5 An app calling a custom provider over HTTP uploads, lists, downloads and deletes a file in CI, and the file shows on the Storage screen.

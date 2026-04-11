import "./blob-env-sync"
import type { ManifestStore, FileStore } from "./types"
import { MockManifestStore } from "./mock-store"

const isMock =
  !process.env.UPSTASH_REDIS_REST_URL ||
  !process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.NEXT_PUBLIC_MOCK_MODE === "true"

let _manifestStore: ManifestStore | null = null
let _fileStore: FileStore | null = null

export function getManifestStore(): ManifestStore {
  if (_manifestStore) return _manifestStore

  if (isMock) {
    _manifestStore = new MockManifestStore()
  } else {
    const { VercelKVStore } = require("./kv") as typeof import("./kv")
    _manifestStore = new VercelKVStore()
  }

  return _manifestStore
}

export function getFileStore(): FileStore {
  if (_fileStore) return _fileStore

  if (process.env.NEXT_PUBLIC_MOCK_MODE === "true") {
    // Full mock mode — return static placeholder URL
    const { MockFileStore } = require("./mock-store") as typeof import("./mock-store")
    _fileStore = new MockFileStore()
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Vercel Blob — upload access from getBlobPutAccess() (BLOB_UPLOAD_ACCESS); Replicate inputs use replicate.files.create for private blobs
    const { VercelBlobStore } = require("./blob") as typeof import("./blob")
    _fileStore = new VercelBlobStore()
  } else {
    // No blob token — serve files locally through /api/dev-assets
    const { LocalFileStore } = require("./local-store") as typeof import("./local-store")
    _fileStore = new LocalFileStore()
  }

  return _fileStore
}

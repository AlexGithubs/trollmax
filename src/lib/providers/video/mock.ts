import type {
  VideoComposer,
  VideoComposeOptions,
  VideoComposeResult,
} from "../types"
import { generateId } from "@/lib/utils"

// In-memory job map — simulates async processing
const jobs = new Map<string, VideoComposeResult>()

export class MockVideoComposer implements VideoComposer {
  async compose(_opts: VideoComposeOptions): Promise<VideoComposeResult> {
    const jobId = generateId()
    const result: VideoComposeResult = { jobId, status: "queued" }
    jobs.set(jobId, result)

    // Simulate async processing: queued → processing → complete
    setTimeout(() => {
      jobs.set(jobId, { jobId, status: "processing" })
      setTimeout(() => {
        jobs.set(jobId, {
          jobId,
          status: "complete",
          videoUrl: "/mock-video.mp4",
        })
      }, 4000)
    }, 1000)

    return result
  }

  async getStatus(jobId: string): Promise<VideoComposeResult> {
    return jobs.get(jobId) ?? { jobId, status: "failed", errorMessage: "Job not found" }
  }
}

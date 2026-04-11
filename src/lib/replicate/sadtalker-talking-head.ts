/**
 * Replicate SadTalker — image + audio → talking-head MP4 URL (no D-ID celebrity gate).
 * Pin with REPLICATE_SADTALKER_MODEL=cjwbw/sadtalker:<version> when upgrading.
 */
import Replicate from "replicate"
import { urlForReplicateModelInput } from "@/lib/replicate/url-for-model-input"
import { resolveReplicateOutputMediaUrl } from "@/lib/replicate/resolve-output-media-url"
import {
  isSadTalkerOpenCvROIError,
  sadTalkerEnvInputIsOpenCvSafePreset,
  sadTalkerOpenCvSafeStaticInput,
  sadTalkerResizeFallbackStaticInput,
  sadTalkerStaticInputFromEnv,
} from "@/lib/replicate/sadtalker-env-input"

/** Default matches Replicate “API” tab for cjwbw/sadtalker. */
const DEFAULT_SADTALKER_MODEL =
  "cjwbw/sadtalker:a519cc0cfebaaeade068b23899165a11ec76aaa1d2b313d40d214f204ec957a3"

export async function replicateSadTalkerTalkingHeadUrl(opts: {
  replicate: InstanceType<typeof Replicate>
  headshotBlobUrl: string
  audioBlobUrl: string
}): Promise<string> {
  const model = process.env.REPLICATE_SADTALKER_MODEL?.trim() || DEFAULT_SADTALKER_MODEL
  const source_image = await urlForReplicateModelInput(opts.replicate, opts.headshotBlobUrl.trim(), {
    filenameStem: "headshot",
  })
  const driven_audio = await urlForReplicateModelInput(opts.replicate, opts.audioBlobUrl.trim(), {
    filenameStem: "narration",
  })

  const run = async (staticInput: Record<string, string | number | boolean>) => {
    const output = await opts.replicate.run(model as `${string}/${string}:${string}`, {
      input: {
        ...staticInput,
        source_image,
        driven_audio,
      },
    })
    return resolveReplicateOutputMediaUrl(output, "SadTalker")
  }

  const envStatic = sadTalkerStaticInputFromEnv()

  try {
    return await run(envStatic)
  } catch (err) {
    if (!isSadTalkerOpenCvROIError(err)) throw err

    console.warn("[SadTalker] OpenCV/ROI failure — retrying with stable crop settings", {
      preprocess: envStatic.preprocess,
      size_of_image: envStatic.size_of_image,
      facerender: envStatic.facerender,
    })

    if (!sadTalkerEnvInputIsOpenCvSafePreset()) {
      try {
        return await run(sadTalkerOpenCvSafeStaticInput())
      } catch (err2) {
        if (!isSadTalkerOpenCvROIError(err2)) throw err2
        console.warn("[SadTalker] OpenCV/ROI again — retrying preprocess=resize")
      }
    }

    return await run(sadTalkerResizeFallbackStaticInput())
  }
}

/**
 * Client-side video frame extraction.
 *
 * Loads a video file, seeks to intervals, captures frames as base64 data URIs.
 * Optimized for screen recordings (lower frame rate needed).
 */

const MAX_DURATION_SECONDS = 30;
const FRAME_INTERVAL_SECONDS = 3; // One frame every 3 seconds
const MAX_FRAMES = 10;
const MAX_FILE_SIZE_MB = 50;

export interface VideoExtractionResult {
  frames: string[]; // base64 data URIs
  duration: number; // seconds
  frameCount: number;
}

export interface VideoValidationError {
  error: string;
}

export function validateVideoFile(file: File): VideoValidationError | null {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    return { error: `Video file is too large (${sizeMB.toFixed(1)}MB). Maximum is ${MAX_FILE_SIZE_MB}MB.` };
  }

  const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
  if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi)$/i)) {
    return { error: 'Unsupported video format. Use MP4, WebM, or MOV.' };
  }

  return null;
}

export async function extractFrames(file: File): Promise<VideoExtractionResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = async () => {
      const duration = video.duration;

      if (duration > MAX_DURATION_SECONDS) {
        URL.revokeObjectURL(url);
        reject(new Error(`Video is too long (${Math.round(duration)}s). Maximum is ${MAX_DURATION_SECONDS} seconds.`));
        return;
      }

      // Calculate which timestamps to capture
      const frameCount = Math.min(MAX_FRAMES, Math.max(1, Math.floor(duration / FRAME_INTERVAL_SECONDS) + 1));
      const interval = duration / frameCount;
      const timestamps: number[] = [];
      for (let i = 0; i < frameCount; i++) {
        timestamps.push(Math.min(i * interval, duration - 0.1));
      }

      // Set canvas size to video dimensions (cap at 1280px wide for token efficiency)
      const scale = Math.min(1, 1280 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);

      const frames: string[] = [];

      try {
        for (const time of timestamps) {
          const frame = await captureFrame(video, canvas, ctx, time);
          frames.push(frame);
        }

        URL.revokeObjectURL(url);
        resolve({
          frames,
          duration,
          frameCount: frames.length,
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video file. It may be corrupted or in an unsupported format.'));
    };
  });
}

function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  time: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    video.currentTime = time;

    video.onseeked = () => {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUri = canvas.toDataURL('image/jpeg', 0.8); // JPEG for smaller size
        resolve(dataUri);
      } catch (err) {
        reject(err);
      }
    };

    // Timeout for seek
    setTimeout(() => {
      reject(new Error(`Timeout seeking to ${time}s`));
    }, 5000);
  });
}

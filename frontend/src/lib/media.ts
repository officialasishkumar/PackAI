const MAX_VIDEO_SECONDS = 15;
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.82;

export interface PreparedMedia {
  file: File;
  note: string;
}

export async function prepareMedia(file: File): Promise<PreparedMedia> {
  if (file.type === "image/jpeg" || file.type === "image/png") {
    const compressed = await compressImage(file);
    const note =
      compressed.size < file.size
        ? `Image compressed from ${formatBytes(file.size)} to ${formatBytes(
            compressed.size,
          )}.`
        : `Image kept at ${formatBytes(file.size)}.`;

    return { file: compressed, note };
  }

  if (file.type === "video/mp4") {
    const duration = await getVideoDuration(file);
    if (duration > MAX_VIDEO_SECONDS) {
      throw new Error("Video uploads must be 15 seconds or shorter.");
    }

    return {
      file,
      note: `Video length ${duration.toFixed(1)}s. MP4 uploads are kept as-is.`,
    };
  }

  throw new Error("Only JPEG, PNG, and MP4 uploads are supported.");
}

async function compressImage(file: File): Promise<File> {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));

  if (scale === 1 && file.size < 2_000_000) {
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
  });

  if (!blob) {
    return file;
  }

  return new File([blob], replaceExtension(file.name, "jpg"), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectURL = URL.createObjectURL(file);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read the selected image."));
      image.src = objectURL;
    });
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

async function getVideoDuration(file: File): Promise<number> {
  const objectURL = URL.createObjectURL(file);

  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve(video.duration);
      video.onerror = () => reject(new Error("Could not read the selected video."));
      video.src = objectURL;
    });
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

function replaceExtension(fileName: string, nextExtension: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) {
    return `${fileName}.${nextExtension}`;
  }

  return `${fileName.slice(0, lastDot)}.${nextExtension}`;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}


export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください。");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("画像の処理に失敗しました。");
  }

  context.drawImage(image, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("画像の圧縮に失敗しました。"));
        }
      },
      "image/jpeg",
      quality
    );
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。"));
    };
    image.src = url;
  });
}

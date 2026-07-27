export interface AudioWorldPoint {
  x: number;
  y: number;
}

export interface AudioCameraView {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  zoom: number;
}

export interface SpatialAudioMix {
  audible: boolean;
  volumeMultiplier: number;
  pan: number;
}

/**
 * Cheap camera-relative mix for combat one-shots. UI/state sounds should not
 * use this helper. The outer cutoff is deliberately generous so dragging the
 * camera does not make nearby fighting blink in and out audibly.
 */
export function calculateSpatialAudio(
  point: AudioWorldPoint,
  camera: AudioCameraView,
): SpatialAudioMix {
  const safeZoom = Math.max(0.01, camera.zoom);
  const halfW = Math.max(1, camera.width / safeZoom / 2);
  const halfH = Math.max(1, camera.height / safeZoom / 2);
  const nx = (point.x - camera.centerX) / halfW;
  const ny = (point.y - camera.centerY) / halfH;
  const edgeDistance = Math.sqrt(nx * nx + ny * ny);

  if (edgeDistance >= 2.25) {
    return { audible: false, volumeMultiplier: 0, pan: 0 };
  }

  const volumeMultiplier = edgeDistance <= 1
    ? 1 - edgeDistance * 0.28
    : Math.max(0.12, 0.72 - (edgeDistance - 1) * 0.48);

  return {
    audible: true,
    volumeMultiplier,
    pan: Math.max(-0.45, Math.min(0.45, nx * 0.36)),
  };
}

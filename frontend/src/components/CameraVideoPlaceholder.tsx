import React from 'react';
import { CameraVideoPlayer, CameraVideoPlayerProps } from './CameraVideoPlayer';

export interface CameraVideoPlaceholderProps extends Partial<CameraVideoPlayerProps> {
  cameraId: string;
  simulatedBoxes?: unknown[];
}

/**
 * @deprecated Use CameraVideoPlayer instead. Retained for backward compatibility.
 */
export const CameraVideoPlaceholder: React.FC<CameraVideoPlaceholderProps> = ({
  cameraId,
  cameraName,
  fps = 25,
  resolution = '1080p',
  lensType = 'OPTICAL HD',
  aspectRatio = '16 / 9',
  customOverlayText = 'REPLAY / LOCAL VIDEO SOURCE',
}) => {
  return (
    <CameraVideoPlayer
      cameraId={cameraId}
      cameraName={cameraName}
      fps={fps}
      resolution={resolution}
      lensType={lensType}
      aspectRatio={aspectRatio}
      customOverlayText={customOverlayText}
    />
  );
};

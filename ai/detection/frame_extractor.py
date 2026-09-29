import cv2
import time
import os
import logging
from typing import Optional, Tuple

logger = logging.getLogger("IBVAP.FrameExtractor")

class FrameExtractor:
    """
    Extracts frames from a local video file at a configurable target sampling FPS.
    Handles continuous playback looping and video synchronization.
    """
    def __init__(self, video_path: str, target_fps: float = 5.0):
        self.video_path = os.path.abspath(video_path)
        self.target_fps = max(0.5, float(target_fps))
        self.cap: Optional[cv2.VideoCapture] = None
        self.source_fps: float = 30.0
        self.total_frames: int = 0
        self.duration_sec: float = 0.0
        self.width: int = 1280
        self.height: int = 720
        self.current_frame_idx: int = 0
        self.last_extraction_time: float = 0.0
        self.frame_interval: float = 1.0 / self.target_fps
        self.is_open: bool = False
        self.was_loop_reset: bool = False
        self._open()

    def _open(self) -> bool:
        if not os.path.exists(self.video_path):
            logger.error(f"Video file does not exist: {self.video_path}")
            self.is_open = False
            return False

        self.cap = cv2.VideoCapture(self.video_path)
        if not self.cap.isOpened():
            logger.error(f"Failed to open video file: {self.video_path}")
            self.is_open = False
            return False

        self.source_fps = float(self.cap.get(cv2.CAP_PROP_FPS) or 30.0)
        self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280)
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720)
        self.duration_sec = (self.total_frames / self.source_fps) if self.source_fps > 0 else 0.0
        self.current_frame_idx = 0
        self.was_loop_reset = False
        self.is_open = True
        logger.info(f"Opened video: {os.path.basename(self.video_path)} ({self.width}x{self.height} @ {self.source_fps:.1f} FPS, {self.duration_sec:.1f}s)")
        return True

    def get_next_frame(self) -> Tuple[bool, Optional[any], float, int]:
        """
        Retrieves the next frame for inference.
        Returns: (success, frame_mat, frame_timestamp_seconds, frame_index)
        """
        self.was_loop_reset = False

        if not self.is_open or self.cap is None:
            if not self._open():
                return False, None, 0.0, 0

        # Read next frame
        ret, frame = self.cap.read()

        if not ret or frame is None:
            # Loop video to beginning
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            self.current_frame_idx = 0
            self.was_loop_reset = True
            ret, frame = self.cap.read()
            if not ret or frame is None:
                logger.warning(f"Failed to rewind video: {self.video_path}")
                return False, None, 0.0, 0

        actual_pos = int(self.cap.get(cv2.CAP_PROP_POS_FRAMES))
        self.current_frame_idx = actual_pos
        frame_timestamp = (self.current_frame_idx / self.source_fps) if self.source_fps > 0 else 0.0

        # Compute frame skip to honor target_fps
        frame_skip = max(1, int(round(self.source_fps / self.target_fps)))
        next_pos = self.current_frame_idx + frame_skip - 1
        if self.total_frames > 0 and next_pos >= self.total_frames:
            next_pos = 0
        self.cap.set(cv2.CAP_PROP_POS_FRAMES, next_pos)

        return True, frame, frame_timestamp, self.current_frame_idx

    def release(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None
        self.is_open = False

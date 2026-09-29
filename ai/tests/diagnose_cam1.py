import os
import sys
import time

sys.path.insert(0, os.path.abspath('ai'))
sys.path.insert(0, os.path.abspath('ai/detection'))

from frame_extractor import FrameExtractor
from detector import YOLODetector

def main():
    video_path = os.path.abspath('data/videos/CAM-1/gate.mp4')
    print(f"Target Video: {video_path}")
    
    extractor = FrameExtractor(video_path, target_fps=5.0)
    print(f"Video props: {extractor.width}x{extractor.height} @ {extractor.source_fps} fps, total_frames={extractor.total_frames}, duration={extractor.duration_sec:.2f}s")
    
    detector = YOLODetector('ai/models/yolov8n.pt', conf_threshold=0.35)
    
    print("\n--- Processing 15 consecutive frames sampled at 5 FPS ---")
    for i in range(15):
        ok, frame, ts = extractor.get_next_frame()
        if not ok or frame is None:
            print(f"Frame {i}: Read error")
            continue
            
        frame_idx = extractor.current_frame_idx
        dets, lat, w, h = detector.detect(frame, 'CAM-01', ts)
        
        print(f"FRAME {i:02d} | frameIndex={frame_idx:03d} | videoTimestamp={ts:.2f}s | detsCount={len(dets)} | lat={lat:.1f}ms")
        for d in dets:
            bb = d['boundingBox']
            print(f"  --> {d['objectClass'].upper()} conf={d['confidence']:.2f} bbox=[x={bb['x']:.4f}, y={bb['y']:.4f}, w={bb['width']:.4f}, h={bb['height']:.4f}]")

if __name__ == '__main__':
    main()

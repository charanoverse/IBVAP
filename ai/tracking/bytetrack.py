import time
import collections
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from scipy.optimize import linear_sum_assignment

from kalman_filter import KalmanFilter

class TrackState:
    New = 0
    Tracked = 1
    Lost = 2
    Removed = 3

class STrack:
    """
    Single Track representation in ByteTrack.
    Maintains Kalman state, bounding box history, trajectory, age, and class consistency.
    """
    shared_kalman = KalmanFilter()

    def __init__(
        self,
        tlwh: np.ndarray,
        score: float,
        class_id: int,
        class_name: str,
        camera_id: str,
        frame_timestamp: float = 0.0,
        frame_id: int = 0,
        trajectory_max_len: int = 25,
    ):
        # tlwh: [top_left_x, top_left_y, width, height] (normalized or pixel)
        self._tlwh = np.asarray(tlwh, dtype=float)
        self.kalman_filter: Optional[KalmanFilter] = None
        self.mean: Optional[np.ndarray] = None
        self.covariance: Optional[np.ndarray] = None
        self.is_activated = False

        self.score = float(score)
        self.class_id = int(class_id)
        self.class_name = str(class_name).lower()
        self.camera_id = str(camera_id)

        self.track_id = 0
        self.state = TrackState.New

        self.frame_id = int(frame_id)
        self.start_frame = int(frame_id)
        self.hits = 1
        self.missed_frames = 0
        self.first_seen_timestamp = float(frame_timestamp)
        self.last_seen_timestamp = float(frame_timestamp)
        self.first_seen_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.last_seen_iso = self.first_seen_iso

        # Class consistency history
        self.class_votes: Dict[str, int] = {self.class_name: 1}

        # Trajectory history: center points (x, y, timestamp)
        self.trajectory_max_len = trajectory_max_len
        self.trajectory: collections.deque = collections.deque(maxlen=self.trajectory_max_len)
        self._append_trajectory(self.tlwh, self.last_seen_timestamp)

    @property
    def tlwh(self) -> np.ndarray:
        """Get current position in [top_left_x, top_left_y, width, height]"""
        if self.mean is None:
            return self._tlwh.copy()
        ret = self.mean[:4].copy()
        ret[2] *= ret[3]
        ret[:2] -= ret[2:] / 2
        return ret

    @property
    def tlbr(self) -> np.ndarray:
        """Get current position in [top_left_x, top_left_y, bottom_right_x, bottom_right_y]"""
        ret = self.tlwh
        ret[2:] += ret[:2]
        return ret

    @staticmethod
    def tlwh_to_xyah(tlwh: np.ndarray) -> np.ndarray:
        """Convert [x, y, w, h] to [center_x, center_y, aspect_ratio (w/h), height]"""
        ret = np.asarray(tlwh, dtype=float).copy()
        ret[:2] += ret[2:] / 2
        ret[2] /= max(1e-6, ret[3])
        return ret

    def _append_trajectory(self, tlwh: np.ndarray, timestamp: float):
        cx = float(tlwh[0] + tlwh[2] / 2.0)
        cy = float(tlwh[1] + tlwh[3] / 2.0)
        self.trajectory.append({
            "x": round(max(0.0, min(1.0, cx)), 4),
            "y": round(max(0.0, min(1.0, cy)), 4),
            "timestamp": round(timestamp, 3),
        })

    def activate(self, kalman_filter: KalmanFilter, frame_id: int, track_id: int):
        """Start a new track"""
        self.kalman_filter = kalman_filter
        self.track_id = track_id
        self.mean, self.covariance = self.kalman_filter.initiate(
            self.tlwh_to_xyah(self._tlwh)
        )
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id
        self.start_frame = frame_id

    def re_activate(self, new_track: "STrack", frame_id: int, frame_timestamp: float):
        """Re-activate a lost track with a new detection"""
        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.state = TrackState.Tracked
        self.is_activated = True
        self.frame_id = frame_id
        self.last_seen_timestamp = frame_timestamp
        self.last_seen_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.score = new_track.score
        self.hits += 1
        self.missed_frames = 0

        # Update class vote
        self.class_votes[new_track.class_name] = self.class_votes.get(new_track.class_name, 0) + 1
        self.class_name = max(self.class_votes.items(), key=lambda x: x[1])[0]
        self.class_id = new_track.class_id

        self._append_trajectory(self.tlwh, frame_timestamp)

    def update(self, new_track: "STrack", frame_id: int, frame_timestamp: float):
        """Update an existing track with matched detection"""
        self.frame_id = frame_id
        self.last_seen_timestamp = frame_timestamp
        self.last_seen_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.hits += 1
        self.missed_frames = 0

        self.mean, self.covariance = self.kalman_filter.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.state = TrackState.Tracked
        self.is_activated = True
        self.score = new_track.score

        # Update class vote
        self.class_votes[new_track.class_name] = self.class_votes.get(new_track.class_name, 0) + 1
        self.class_name = max(self.class_votes.items(), key=lambda x: x[1])[0]
        self.class_id = new_track.class_id

        self._append_trajectory(self.tlwh, frame_timestamp)

    def predict(self):
        if self.mean is None:
            return
        if self.state != TrackState.Tracked:
            self.mean[7] = 0
        self.mean, self.covariance = self.kalman_filter.predict(self.mean, self.covariance)

    def mark_lost(self):
        self.state = TrackState.Lost
        self.missed_frames += 1

    def mark_removed(self):
        self.state = TrackState.Removed

    @property
    def age_frames(self) -> int:
        return max(1, self.frame_id - self.start_frame + 1)

    @property
    def age_seconds(self) -> float:
        return max(0.0, self.last_seen_timestamp - self.first_seen_timestamp)

    def to_dict(self) -> Dict[str, Any]:
        tlwh = self.tlwh
        norm_x = max(0.0, min(1.0, float(tlwh[0])))
        norm_y = max(0.0, min(1.0, float(tlwh[1])))
        norm_w = max(0.0, min(1.0, float(tlwh[2])))
        norm_h = max(0.0, min(1.0, float(tlwh[3])))

        status_str = "ACTIVE" if self.state == TrackState.Tracked else ("LOST" if self.state == TrackState.Lost else "EXPIRED")

        return {
            "id": f"trk-{self.camera_id.lower()}-{self.track_id}",
            "trackId": self.track_id,
            "displayId": f"T{self.track_id:03d}",
            "cameraId": self.camera_id,
            "classId": self.class_id,
            "className": self.class_name,
            "confidence": round(self.score, 4),
            "boundingBox": {
                "x": round(norm_x, 4),
                "y": round(norm_y, 4),
                "width": round(norm_w, 4),
                "height": round(norm_h, 4),
            },
            "firstSeen": self.first_seen_iso,
            "lastSeen": self.last_seen_iso,
            "firstSeenTimestamp": round(self.first_seen_timestamp, 3),
            "lastSeenTimestamp": round(self.last_seen_timestamp, 3),
            "ageFrames": self.age_frames,
            "ageSeconds": round(self.age_seconds, 2),
            "missedFrames": self.missed_frames,
            "status": status_str,
            "trajectory": list(self.trajectory),
        }


def bbox_ious(boxes_a: np.ndarray, boxes_b: np.ndarray) -> np.ndarray:
    """
    Computes pairwise IoU between two sets of [x1, y1, x2, y2] boxes.
    """
    if len(boxes_a) == 0 or len(boxes_b) == 0:
        return np.zeros((len(boxes_a), len(boxes_b)), dtype=float)

    # boxes_a: (N, 4), boxes_b: (M, 4)
    tl = np.maximum(boxes_a[:, None, :2], boxes_b[None, :, :2])
    br = np.minimum(boxes_a[:, None, 2:], boxes_b[None, :, 2:])

    wh = np.maximum(0.0, br - tl)
    intersection = wh[:, :, 0] * wh[:, :, 1]

    area_a = (boxes_a[:, 2] - boxes_a[:, 0]) * (boxes_a[:, 3] - boxes_a[:, 1])
    area_b = (boxes_b[:, 2] - boxes_b[:, 0]) * (boxes_b[:, 3] - boxes_b[:, 1])

    union = area_a[:, None] + area_b[None, :] - intersection
    return np.clip(intersection / np.maximum(1e-6, union), 0.0, 1.0)


def iou_distance(tracks: List[STrack], detections: List[STrack]) -> np.ndarray:
    """
    Computes 1 - IoU distance matrix between tracks and detections.
    """
    if len(tracks) == 0 or len(detections) == 0:
        return np.zeros((len(tracks), len(detections)), dtype=float)

    boxes_a = np.ascontiguousarray([t.tlbr for t in tracks], dtype=float)
    boxes_b = np.ascontiguousarray([d.tlbr for d in detections], dtype=float)
    ious = bbox_ious(boxes_a, boxes_b)
    return 1.0 - ious


def linear_assignment(cost_matrix: np.ndarray, thresh: float) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
    """
    Hungarian bipartite matching algorithm.
    """
    if cost_matrix.size == 0:
        return [], list(range(cost_matrix.shape[0])), list(range(cost_matrix.shape[1]))

    row_ind, col_ind = linear_sum_assignment(cost_matrix)
    matches = []
    unmatched_a = list(set(range(cost_matrix.shape[0])) - set(row_ind))
    unmatched_b = list(set(range(cost_matrix.shape[1])) - set(col_ind))

    for r, c in zip(row_ind, col_ind):
        if cost_matrix[r, c] > thresh:
            unmatched_a.append(r)
            unmatched_b.append(c)
        else:
            matches.append((r, c))

    return matches, sorted(unmatched_a), sorted(unmatched_b)


class ByteTracker:
    """
    ByteTrack Multi-Object Tracker (Zhang et al., 2022).
    Operates strictly LOCAL to a single camera.
    """
    def __init__(
        self,
        camera_id: str,
        track_thresh: float = 0.40,
        match_thresh: float = 0.70,
        second_match_thresh: float = 0.50,
        unconfirmed_match_thresh: float = 0.70,
        max_time_lost: int = 15,
        min_hits: int = 1,
        trajectory_max_len: int = 25,
    ):
        self.camera_id = str(camera_id)
        self.track_thresh = float(track_thresh)
        self.match_thresh = float(match_thresh)
        self.second_match_thresh = float(second_match_thresh)
        self.unconfirmed_match_thresh = float(unconfirmed_match_thresh)
        self.max_time_lost = int(max_time_lost)
        self.min_hits = int(min_hits)
        self.trajectory_max_len = int(trajectory_max_len)

        self.kalman_filter = KalmanFilter()

        self.tracked_stracks: List[STrack] = []
        self.lost_stracks: List[STrack] = []
        self.removed_stracks: List[STrack] = []
        self.unconfirmed_stracks: List[STrack] = []

        self.frame_id = 0
        self._next_id = 1

    def reset(self):
        """
        Clears all tracker state.
        Called on video loop rewind, camera source reset, or AI restart.
        """
        self.tracked_stracks.clear()
        self.lost_stracks.clear()
        self.removed_stracks.clear()
        self.unconfirmed_stracks.clear()
        self.frame_id = 0
        self._next_id = 1

    def _get_next_id(self) -> int:
        nid = self._next_id
        self._next_id += 1
        return nid

    def update(
        self,
        detections: List[Dict[str, Any]],
        frame_index: int = 0,
        frame_timestamp: float = 0.0,
        frame_w: int = 1280,
        frame_h: int = 720,
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Main tracking update step. Consumes Phase 3 detections and updates local tracks.

        Returns:
            Tuple of (active_tracks_dict_list, tracker_latency_ms)
        """
        start_time = time.perf_counter()
        self.frame_id = int(frame_index) if frame_index > 0 else (self.frame_id + 1)

        # 1. Parse incoming detections into STrack instances
        det_stracks: List[STrack] = []
        for det in detections:
            bbox = det["boundingBox"]
            tlwh = np.array([bbox["x"], bbox["y"], bbox["width"], bbox["height"]], dtype=float)
            score = float(det.get("confidence", 0.0))
            class_id = int(det.get("classId", 0))
            class_name = str(det.get("objectClass", "unknown"))

            s = STrack(
                tlwh=tlwh,
                score=score,
                class_id=class_id,
                class_name=class_name,
                camera_id=self.camera_id,
                frame_timestamp=frame_timestamp,
                frame_id=self.frame_id,
                trajectory_max_len=self.trajectory_max_len,
            )
            det_stracks.append(s)

        # 2. Partition detections into high and low confidence groups
        high_det = [d for d in det_stracks if d.score >= self.track_thresh]
        low_det = [d for d in det_stracks if d.score < self.track_thresh]

        # 3. Predict Kalman state for all existing tracks
        for t in self.tracked_stracks:
            t.predict()
        for t in self.lost_stracks:
            t.predict()
        for t in self.unconfirmed_stracks:
            t.predict()

        # 4. First Association: High-confidence detections with (tracked + lost tracks)
        pool_stracks = self.tracked_stracks + self.lost_stracks
        dists = iou_distance(pool_stracks, high_det)
        matches_1, unmatched_tracks_1_idx, unmatched_dets_1_idx = linear_assignment(
            dists, thresh=self.match_thresh
        )

        matched_tracks = []
        for trk_idx, det_idx in matches_1:
            track = pool_stracks[trk_idx]
            det = high_det[det_idx]
            if track.state == TrackState.Tracked:
                track.update(det, self.frame_id, frame_timestamp)
                matched_tracks.append(track)
            else:
                track.re_activate(det, self.frame_id, frame_timestamp)
                matched_tracks.append(track)

        # 5. Second Association: Low-confidence detections with remaining unmatched tracked tracks
        unmatched_tracked = [
            pool_stracks[i]
            for i in unmatched_tracks_1_idx
            if pool_stracks[i].state == TrackState.Tracked
        ]
        dists_2 = iou_distance(unmatched_tracked, low_det)
        matches_2, unmatched_tracks_2_idx, _ = linear_assignment(
            dists_2, thresh=self.second_match_thresh
        )

        for trk_idx, det_idx in matches_2:
            track = unmatched_tracked[trk_idx]
            det = low_det[det_idx]
            track.update(det, self.frame_id, frame_timestamp)
            matched_tracks.append(track)

        # Tracks that were tracked but unmatched in both stages become LOST
        for trk_idx in unmatched_tracks_2_idx:
            track = unmatched_tracked[trk_idx]
            track.mark_lost()

        # 6. Third Association: Remaining unmatched high-confidence detections with unconfirmed tracks
        unmatched_high_dets = [high_det[i] for i in unmatched_dets_1_idx]
        dists_unconf = iou_distance(self.unconfirmed_stracks, unmatched_high_dets)
        matches_unconf, unmatched_unconf_idx, final_unmatched_dets_idx = linear_assignment(
            dists_unconf, thresh=self.unconfirmed_match_thresh
        )

        for trk_idx, det_idx in matches_unconf:
            track = self.unconfirmed_stracks[trk_idx]
            det = unmatched_high_dets[det_idx]
            track.update(det, self.frame_id, frame_timestamp)
            if track.hits >= self.min_hits:
                track.activate(self.kalman_filter, self.frame_id, self._get_next_id())
                matched_tracks.append(track)

        # Expire unmatched unconfirmed tracks
        for trk_idx in unmatched_unconf_idx:
            self.unconfirmed_stracks[trk_idx].mark_removed()

        # 7. Initialize new tracks from remaining unmatched high-confidence detections
        new_unconfirmed = []
        for det_idx in final_unmatched_dets_idx:
            det = unmatched_high_dets[det_idx]
            if self.min_hits <= 1:
                det.activate(self.kalman_filter, self.frame_id, self._get_next_id())
                matched_tracks.append(det)
            else:
                det.kalman_filter = self.kalman_filter
                new_unconfirmed.append(det)

        # 8. Manage Lost & Removed Tracks
        active_tracked = []
        new_lost = []
        new_removed = []

        # Process all currently tracked tracks
        for t in set(matched_tracks + self.tracked_stracks):
            if t.state == TrackState.Tracked:
                active_tracked.append(t)
            elif t.state == TrackState.Lost:
                new_lost.append(t)
            elif t.state == TrackState.Removed:
                new_removed.append(t)

        # Process lost tracks: check if exceeded max_time_lost
        for t in self.lost_stracks:
            if t.state == TrackState.Lost:
                if self.frame_id - t.frame_id > self.max_time_lost or t.missed_frames > self.max_time_lost:
                    t.mark_removed()
                    new_removed.append(t)
                else:
                    new_lost.append(t)

        self.tracked_stracks = list(set(active_tracked))
        self.lost_stracks = [t for t in set(new_lost) if t not in self.tracked_stracks]
        self.unconfirmed_stracks = [t for t in new_unconfirmed if t.state != TrackState.Removed]
        self.removed_stracks = list(set(self.removed_stracks + new_removed))

        # 9. Format output active tracks and update detection references
        output_tracks = []
        for t in sorted(self.tracked_stracks, key=lambda x: x.track_id):
            track_dict = t.to_dict()
            output_tracks.append(track_dict)

        # Match detection records back to track IDs (for trackRef field in detections)
        for det in detections:
            bbox = det["boundingBox"]
            cx = bbox["x"] + bbox["width"] / 2.0
            cy = bbox["y"] + bbox["height"] / 2.0
            best_trk = None
            min_d = 0.15 # Max normalized distance to associate
            for trk in output_tracks:
                tb = trk["boundingBox"]
                tcx = tb["x"] + tb["width"] / 2.0
                tcy = tb["y"] + tb["height"] / 2.0
                d = ((cx - tcx)**2 + (cy - tcy)**2)**0.5
                if d < min_d:
                    min_d = d
                    best_trk = trk["displayId"]
            det["trackRef"] = best_trk

        latency_ms = (time.perf_counter() - start_time) * 1000.0
        return output_tracks, round(latency_ms, 2)

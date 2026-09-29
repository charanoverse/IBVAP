"""
Tests for Phase 6 Forensic Video Evidence Extractor
"""

import os
import json
import pytest
from ai.processing.evidence_extractor import (
    extract_evidence_package,
    verify_evidence_package,
    compute_sha256,
)


@pytest.fixture
def test_video_path():
    candidates = [
        "data/videos/cam-03/restricted.mp4",
        "data/videos/CAM-3/restricted.mp4",
        "data/videos/cam-01/gate.mp4",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    pytest.skip("Test video not found in data/videos/")


def test_extract_evidence_package_success(test_video_path, tmp_path):
    output_dir = str(tmp_path / "INC-TEST-001")
    incident_id = "INC-TEST-001"
    camera_id = "CAM-03"
    event_timestamp = 4.5

    result = extract_evidence_package(
        source_path=test_video_path,
        output_dir=output_dir,
        incident_id=incident_id,
        camera_id=camera_id,
        event_timestamp=event_timestamp,
        primary_event_id="EVT-TEST-001",
        linked_event_ids=["EVT-TEST-001", "EVT-TEST-002"],
        pre_seconds=5.0,
        post_seconds=5.0,
        min_event_duration=3.0,
        rule_info={"id": "RULE-CAM03-01", "name": "Sterile Zone Entry", "type": "ZONE_ENTRY"},
        model_info={"detector": "YOLOv8n", "tracker": "ByteTrack"}
    )

    assert result["status"] == "READY"
    assert result["incidentId"] == incident_id
    assert result["cameraId"] == camera_id
    assert result["primaryEventId"] == "EVT-TEST-001"
    assert len(result["linkedEventIds"]) == 2

    # Verify generated files exist
    assert os.path.exists(os.path.join(output_dir, "pre-event.mp4"))
    assert os.path.exists(os.path.join(output_dir, "event.mp4"))
    assert os.path.exists(os.path.join(output_dir, "post-event.mp4"))
    assert os.path.exists(os.path.join(output_dir, "snapshot.jpg"))
    assert os.path.exists(os.path.join(output_dir, "manifest.json"))

    # Verify SHA-256 hashes generated
    assert len(result["hashes"]["preEvent"]) == 64
    assert len(result["hashes"]["event"]) == 64
    assert len(result["hashes"]["postEvent"]) == 64
    assert len(result["hashes"]["snapshot"]) == 64
    assert len(result["hashes"]["manifest"]) == 64

    # Verify manifest JSON contents
    with open(os.path.join(output_dir, "manifest.json"), "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert manifest["incidentId"] == incident_id
    assert manifest["rule"]["ruleId"] == "RULE-CAM03-01"
    assert manifest["model"]["detector"] == "YOLOv8n"
    assert len(manifest["files"]) == 4


def test_verify_evidence_package_integrity(test_video_path, tmp_path):
    output_dir = str(tmp_path / "INC-TEST-002")
    extract_evidence_package(
        source_path=test_video_path,
        output_dir=output_dir,
        incident_id="INC-TEST-002",
        camera_id="CAM-03",
        event_timestamp=3.0,
    )

    # 1. Verification should return MATCH for untouched files
    verify_res = verify_evidence_package(output_dir)
    assert verify_res["status"] == "MATCH"
    for file_info in verify_res["files"].values():
        assert file_info["status"] == "MATCH"

    # 2. Tampering test: modify snapshot.jpg and verify detection
    snap_path = os.path.join(output_dir, "snapshot.jpg")
    with open(snap_path, "ab") as f:
        f.write(b"TAMPERED_BYTES")

    tampered_res = verify_evidence_package(output_dir)
    assert tampered_res["status"] == "MISMATCH"
    assert tampered_res["files"]["snapshot.jpg"]["status"] == "MISMATCH"


def test_timestamp_clamping_at_video_boundaries(test_video_path, tmp_path):
    output_dir = str(tmp_path / "INC-TEST-BOUNDS")
    # Event at timestamp 0.2s (near beginning)
    res_start = extract_evidence_package(
        source_path=test_video_path,
        output_dir=output_dir,
        incident_id="INC-TEST-BOUNDS-1",
        camera_id="CAM-03",
        event_timestamp=0.2,
        pre_seconds=10.0,
    )

    assert res_start["status"] == "READY"
    assert res_start["timestamps"]["preStartSeconds"] == 0.0
    assert res_start["timestamps"]["eventStartSeconds"] == 0.0

    # Event beyond total duration (near end / loop modulo)
    res_end = extract_evidence_package(
        source_path=test_video_path,
        output_dir=output_dir,
        incident_id="INC-TEST-BOUNDS-2",
        camera_id="CAM-03",
        event_timestamp=9999.0,
        post_seconds=10.0,
    )

    assert res_end["status"] == "READY"


def test_missing_source_video_handling(tmp_path):
    output_dir = str(tmp_path / "INC-TEST-FAIL")
    result = extract_evidence_package(
        source_path="nonexistent_video_path_123.mp4",
        output_dir=output_dir,
        incident_id="INC-TEST-FAIL",
        camera_id="CAM-99",
        event_timestamp=5.0,
    )

    assert result["status"] == "FAILED"
    assert result["error"] == "SOURCE_VIDEO_UNAVAILABLE"

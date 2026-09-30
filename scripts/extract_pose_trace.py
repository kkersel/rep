#!/usr/bin/env python3
"""Extract MediaPipe Pose landmarks from an approved local video interval."""

import argparse
import json
from pathlib import Path

import cv2
import mediapipe as mp


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("video", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start", type=float, default=0.0)
    parser.add_argument("--end", type=float)
    parser.add_argument("--sample-fps", type=float, default=12.0)
    return parser.parse_args()


def main():
    args = parse_args()
    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise SystemExit(f"Cannot open video: {args.video}")

    source_fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    aspect_ratio = width / max(1, height)
    stride = max(1, round(source_fps / max(1.0, args.sample_fps)))
    trace = []
    frame_index = 0

    with mp.solutions.pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        smooth_landmarks=True,
        enable_segmentation=False,
        min_detection_confidence=0.45,
        min_tracking_confidence=0.45,
    ) as pose:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            time_seconds = frame_index / source_fps
            frame_index += 1
            if time_seconds < args.start or frame_index % stride:
                continue
            if args.end is not None and time_seconds > args.end:
                break
            result = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            if not result.pose_landmarks:
                continue
            trace.append({
                "timeSeconds": round(time_seconds, 4),
                "aspectRatio": aspect_ratio,
                "landmarks": [
                    {
                        "x": landmark.x,
                        "y": landmark.y,
                        "z": landmark.z,
                        "visibility": landmark.visibility,
                    }
                    for landmark in result.pose_landmarks.landmark
                ],
            })

    capture.release()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(trace, separators=(",", ":")))
    print(f"Wrote {len(trace)} pose frames to {args.output}")


if __name__ == "__main__":
    main()

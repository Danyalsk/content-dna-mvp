import sys
import json
import cv2
import math

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python3 smart_crop.py <video_path> <start_time_sec> <end_time_sec>"}))
        sys.exit(1)
        
    video_path = sys.argv[1]
    start_time = float(sys.argv[2])
    end_time = float(sys.argv[3])
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(json.dumps({"error": "Failed to open video"}))
        sys.exit(1)
        
    # Get basic video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0: fps = 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # We want a 9:16 crop
    crop_width = int(height * (9/16))
    
    # Seek to start time
    start_frame = int(start_time * fps)
    end_frame = int(end_time * fps)
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    # Initialize face detector
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    # Store all detections per frame: {"time": float, "faces": [x1, x2, ...]}
    raw_detections = []
    
    # We sample a frame every 0.1s for smoother tracking
    frame_step = int(fps * 0.1)
    if frame_step == 0: frame_step = 1
    
    curr_frame = start_frame
    while curr_frame <= end_frame:
        ret, frame = cap.read()
        if not ret:
            break
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # calculate time relative to clip start
        relative_time = (curr_frame - start_frame) / fps
        
        centers = []
        if len(faces) > 0:
            # Filter by size - ignore tiny background detections or noise
            # Minimum face height should be at least 15% of total height
            valid_faces = [f for f in faces if f[3] > height * 0.15]
            
            if valid_faces:
                # Sort by X
                sorted_faces = sorted(valid_faces, key=lambda f: f[0])
                
                # Deduplicate and calculate centers
                current_centers = []
                for face in sorted_faces:
                    fx = face[0] + face[2] // 2
                    if not current_centers or (fx - current_centers[-1]) > (width * 0.25):
                        current_centers.append(fx)
                centers = current_centers
             
        if centers:
            raw_detections.append({"time": relative_time, "centers": centers})
            
        # Skip frames efficiently
        if frame_step > 1:
            for _ in range(frame_step - 1):
                if not cap.grab():
                    break
            curr_frame += frame_step
        else:
            curr_frame += 1
            
    cap.release()
    # --- DYNAMIC SCENE DETECTION LOGIC ---
    duration = end_time - start_time
    num_chunks = max(1, math.ceil(duration))
    
    # Bucket raw detections into 1-second chunks
    chunks = [{"faces": []} for _ in range(num_chunks)]
    
    for det in raw_detections:
        chunk_idx = int(det["time"])
        if chunk_idx >= num_chunks: chunk_idx = num_chunks - 1
        chunks[chunk_idx]["faces"].append(det["centers"])
        
    # Classify each chunk's layout based on average face count
    chunk_layouts = []
    for c in chunks:
        # REQUIREMENT FOR SPLIT:
        # 1. At least 2 faces
        # 2. They must be on opposite sides of the center (0.50 width)
        split_votes = 0
        for f in c["faces"]:
            has_left = any(x < width * 0.45 for x in f)
            has_right = any(x > width * 0.55 for x in f)
            if len(f) >= 2 and has_left and has_right:
                split_votes += 1
        
        # Require 50% of detections in the chunk to support a split
        if len(c["faces"]) > 0 and split_votes >= len(c["faces"]) * 0.5:
            layout = "split"
        else:
            layout = "single" if c["faces"] else (chunk_layouts[-1]["layout"] if chunk_layouts else "single")
            
        chunk_layouts.append({"layout": layout, "faces": c["faces"]})
        
    # De-noise layout transitions for stability
    for i in range(1, len(chunk_layouts)-1):
        prev = chunk_layouts[i-1]["layout"]
        curr = chunk_layouts[i]["layout"]
        nxt = chunk_layouts[i+1]["layout"]
        if prev == nxt and curr != prev:
            chunk_layouts[i]["layout"] = prev
            
    # Group contiguous layouts into Scenes
    scenes = []
    current_scene = None
    
    for i, c in enumerate(chunk_layouts):
        t_start = i * 1.0
        t_end = min((i + 1) * 1.0, duration)
        
        if current_scene is None:
            current_scene = {"layout": c["layout"], "start": t_start, "end": t_end, "all_faces": c["faces"]}
        elif current_scene["layout"] == c["layout"]:
            current_scene["end"] = t_end
            current_scene["all_faces"].extend(c["faces"])
        else:
            scenes.append(current_scene)
            current_scene = {"layout": c["layout"], "start": t_start, "end": t_end, "all_faces": c["faces"]}
            
    if current_scene:
        scenes.append(current_scene)
        
    # Final Scene Pass: Ensure split coordinates are actually distinct
    final_scenes = []
    for s in scenes:
        layout = s["layout"]
        all_centers = s["all_faces"]
        
        scene_data = {
           "layout": layout,
           "start": round(s["start"], 2),
           "end": round(s["end"], 2)
        }
        
        if layout == "single":
            flattened = [x for sublist in all_centers for x in sublist]
            if flattened:
                flattened.sort()
                median_x = flattened[len(flattened)//2]
            else:
                # No face detected in this scene — use CENTER of frame for a clean establishing shot
                median_x = width / 2
            
            crop_width_single = int(height * (9/16))
            
            # PADDING: Ensure the face is not at the extreme edge of the crop.
            # The face center should sit within the middle 60% of the crop window.
            # This prevents half-face close-ups when the face is near the frame boundary.
            min_face_margin = int(crop_width_single * 0.20)  # 20% margin on each side
            crop_x = int(median_x - (crop_width_single / 2))
            crop_x = max(0, min(crop_x, width - crop_width_single))
            
            # Check if the face center is too close to the crop edge
            face_pos_in_crop = median_x - crop_x
            if face_pos_in_crop < min_face_margin:
                crop_x = max(0, int(median_x - min_face_margin))
            elif face_pos_in_crop > crop_width_single - min_face_margin:
                crop_x = min(width - crop_width_single, int(median_x - crop_width_single + min_face_margin))
            
            # Final bounds check
            crop_x = max(0, min(crop_x, width - crop_width_single))
            scene_data["x"] = crop_x
            
        else:
            # For split, we need to pick median L and median R
            lefts = []
            rights = []
            for centers in all_centers:
                l_v = [x for x in centers if x < width * 0.50]
                r_v = [x for x in centers if x >= width * 0.50]
                if l_v: lefts.append(min(l_v))
                if r_v: rights.append(max(r_v))
            
            # Median of the extremes
            left_median = sorted(lefts)[len(lefts)//2] if lefts else width * 0.25
            right_median = sorted(rights)[len(rights)//2] if rights else width * 0.75
            
            crop_x_1 = int(left_median - (height / 2))
            crop_x_1 = max(0, min(crop_x_1, width - height))
            crop_x_2 = int(right_median - (height / 2))
            crop_x_2 = max(0, min(crop_x_2, width - height))
            
            # EMERGENCY CHECK: If crops are still more than 85% similar, degenerate to "single"
            # (Calculated by X offset vs width)
            if abs(crop_x_1 - crop_x_2) < width * 0.15:
                scene_data["layout"] = "single"
                scene_data["x"] = (crop_x_1 + crop_x_2) // 2
            else:
                scene_data["left_x"] = crop_x_1
                scene_data["right_x"] = crop_x_2
            
        final_scenes.append(scene_data)
        
    print(json.dumps({
        "crop_width": crop_width,
        "crop_height": height,
        "face_found": len(raw_detections) > 0,
        "scenes": final_scenes
    }))

if __name__ == "__main__":
    main()

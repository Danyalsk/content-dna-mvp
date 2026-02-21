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
        
    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0: fps = 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    start_frame = int(start_time * fps)
    end_frame = int(end_time * fps)
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    raw_detections = []
    frame_step = int(fps * 0.1)
    if frame_step == 0: frame_step = 1
    
    curr_frame = start_frame
    while curr_frame <= end_frame:
        ret, frame = cap.read()
        if not ret:
            break
            
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        relative_time = (curr_frame - start_frame) / fps
        centers = [x + w // 2 for (x, y, w, h) in faces]
             
        if centers:
            raw_detections.append({"time": relative_time, "centers": centers})
            
        curr_frame += frame_step
        cap.set(cv2.CAP_PROP_POS_FRAMES, curr_frame)
        
    cap.release()
    
    duration = end_time - start_time
    num_chunks = max(1, math.ceil(duration))
    
    chunks = [{"faces": []} for _ in range(num_chunks)]
    
    for det in raw_detections:
        chunk_idx = int(det["time"])
        if chunk_idx >= num_chunks: chunk_idx = num_chunks - 1
        chunks[chunk_idx]["faces"].append(det["centers"])
        
    chunk_layouts = []
    for c in chunks:
        faces_counts = [len(f) for f in c["faces"]]
        if faces_counts:
            avg_faces = sum(faces_counts) / len(faces_counts)
            layout = "split" if avg_faces >= 1.5 else "single"
        else:
            layout = chunk_layouts[-1]["layout"] if chunk_layouts else "single"
            
        chunk_layouts.append({"layout": layout, "faces": c["faces"]})
        
    for i in range(1, len(chunk_layouts)-1):
        prev = chunk_layouts[i-1]["layout"]
        curr = chunk_layouts[i]["layout"]
        nxt = chunk_layouts[i+1]["layout"]
        if prev == nxt and curr != prev:
            chunk_layouts[i]["layout"] = prev
            
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
                median_x = width / 2
            
            crop_width_single = int(height * (9/16))
            crop_x = int(median_x - (crop_width_single / 2))
            crop_x = max(0, min(crop_x, width - crop_width_single))
            scene_data["x"] = crop_x
            
        else:
            lefts = []
            rights = []
            for centers in all_centers:
                l_f = [x for x in centers if x < width * 0.55]
                r_f = [x for x in centers if x > width * 0.45]
                if l_f: lefts.append(sum(l_f)/len(l_f))
                if r_f: rights.append(sum(r_f)/len(r_f))
                
            med_l = lefts[len(lefts)//2] if lefts else width * 0.25
            med_r = rights[len(rights)//2] if rights else width * 0.75
                
            crop_x_1 = int(med_l - (height / 2))
            crop_x_1 = max(0, min(crop_x_1, width - height))
            crop_x_2 = int(med_r - (height / 2))
            crop_x_2 = max(0, min(crop_x_2, width - height))
            
            scene_data["left_x"] = crop_x_1
            scene_data["right_x"] = crop_x_2
            
        final_scenes.append(scene_data)
        
    print(json.dumps({
        "crop_width": int(height * (9/16)),
        "crop_height": height,
        "scenes": final_scenes
    }))

if __name__ == "__main__":
    main()

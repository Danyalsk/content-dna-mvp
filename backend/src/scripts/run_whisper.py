import sys
import json
import whisper
import warnings
import torch
import os

warnings.filterwarnings("ignore")

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio file provided"}))
        sys.exit(1)
        
    audio_path = sys.argv[1]
    
    # 1. Load Whisper Model
    model = whisper.load_model("base")
    
    # 2. Transcribe with word-level timestamps
    result = model.transcribe(audio_path, word_timestamps=True)
    
    # 3. Speaker Diarization
    # Note: Requires a HuggingFace token and accepting the pyannote.audio user conditions online. 
    # For MVP portability, assuming the token is set in the environment or we skip mapping if missing.
    hf_token = os.environ.get("HF_TOKEN")
    diarization = None
    
    if hf_token:
        try:
            from pyannote.audio import Pipeline
            pipeline = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=hf_token)
            
            # Send to GPU if available (MPS on Mac)
            if torch.backends.mps.is_available():
                pipeline.to(torch.device("mps"))
                
            diarization = pipeline(audio_path)
        except Exception as e:
            sys.stderr.write(f"[Python:Warning] Diarization failed or token invalid: {e}\n")
    else:
         sys.stderr.write("[Python:Warning] HF_TOKEN not set. Skipping speaker diarization.\n")
         
    def get_speaker_for_time(start_time, end_time, diarz):
        if not diarz:
            return "SPEAKER_00"
            
        mid_point = (start_time + end_time) / 2
        # Find which speaker's timeframe the midpoint falls into
        for turn, _, speaker in diarz.itertracks(yield_label=True):
            if turn.start <= mid_point <= turn.end:
                return speaker
        return "UNKNOWN"
    
    # Group segments for Output
    segments = []
    for segment in result["segments"]:
        words = []
        seg_speaker_votes = {}
        
        if "words" in segment:
            for w in segment["words"]:
                speaker = get_speaker_for_time(w["start"], w["end"], diarization)
                
                # Tally votes for majority speaker of this segment
                seg_speaker_votes[speaker] = seg_speaker_votes.get(speaker, 0) + 1
                
                words.append({
                    "word": w["word"].strip(),
                    "start": round(w["start"], 2),
                    "end": round(w["end"], 2),
                    "speaker": speaker
                })
                
        # Get dominant speaker for the whole segment
        dominant_speaker = "SPEAKER_00"
        if seg_speaker_votes:
            dominant_speaker = max(seg_speaker_votes, key=seg_speaker_votes.get)
                
        segments.append({
            "start": round(segment["start"], 2),
            "end": round(segment["end"], 2),
            "text": segment["text"].strip(),
            "speaker": dominant_speaker,
            "words": words
        })
        
    # Output JSON string to stdout so Node can parse it
    print(json.dumps({"segments": segments, "text": result["text"]}))

if __name__ == "__main__":
    main()

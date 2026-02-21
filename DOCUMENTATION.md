# ContentDNA-MVP Documentation

## Architecture Overview
ContentDNA-MVP is a full-stack web application designed to orchestrate a multi-platform content ecosystem. It takes a long-form video, extracts its core intelligence ("Content DNA") using local AI models, and automatically generates both text content (Twitter posts) and video clips (9:16 Shorts) using smart face-tracking and cropping.

The architecture comprises:
- **Frontend**: A React application powered by Vite, providing the UI for users to input video URLs and view the generated content.
- **Backend**: A high-performance Node.js service built on Bun and ElysiaJS, orchestrating various AI and command-line tools for processing video and text.

---

## What is coming from where?
The application relies heavily on real-time streaming (Server-Sent Events) to provide feedback on long-running tasks. Here is the flow of data:

1. **User Input** (Frontend): The user submits a YouTube URL via the React interface.
2. **Backend SSE Connection** (Backend): The frontend connects to `/api/video/stream-url`. The backend begins processing and streaming progress updates back to the UI.
3. **Video Download** (yt-dlp): The backend uses `yt-dlp` to securely download the media asset.
4. **Transcription** (Whisper): Local Whisper models transcribe the audio from the video.
5. **Content DNA Extraction** (Ollama - llama3.2): The transcript is sent to a local Ollama instance running `llama3.2`. The LLM extracts the main topic, generates Twitter posts, and identifies timestamped segments to clip (minimum 15 seconds long).
6. **Smart Cropping & Video Generation** (OpenCV + FFmpeg): For each identified clip, a Python script (`smart_crop.py`) uses OpenCV to track the primary face and determine crop coordinates. FFmpeg then trims and crops the video into a 9:16 format.
7. **Delivery** (Frontend): The final generated clips (served as static files) and Twitter posts are displayed on the frontend "Results" view.

---

## Tech Stack & Tools

### Frontend
- **Framework**: React 19, Vite
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Upload Component**: React Dropzone
- **Language**: TypeScript

### Backend
- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Language**: TypeScript
- **AI Processing**: 
  - Ollama (running `llama3.2` locally for Content DNA extraction)
  - Whisper (for transcription)
- **Video Processing**:
  - `yt-dlp` (for YouTube video downloading)
  - OpenCV (`smart_crop.py` for face tracking)
  - FFmpeg (for video trimming and cropping)

---

## Feature List

- **YouTube URL Processing**: Pass any YouTube link to extract its content.
- **Real-Time Pipeline Status**: Live visual and terminal-style logs showing the progress of yt-dlp, Whisper, Ollama, and FFmpeg tasks.
- **AI-Powered Transcription**: Full video transcription using local Whisper.
- **Content intelligence (DNA)**: LLM generation of a concise topic summary and engaging Twitter posts based on the overall transcript.
- **Automated Video Clipping**: AI-identified video highlights.
- **Smart Face-Tracking**: OpenCV-powered face detection to ensure the speaker remains centered in 9:16 vertical video crops.
- **Direct Clip Download**: Ability to view and download the generated MP4 video shorts directly from the interface.

---

## Current Status: What is working vs. not working

### ✅ What is working
- **YouTube Video Processing**: The core pipeline correctly downloads, transcribes, analyzes, and clips YouTube videos.
- **Real-time Logs (SSE)**: The EventSource stream successfully pipes system logs from the backend to the frontend UI for live progress tracking.
- **LLM Content DNA**: The Ollama integration (`llama3.2`) enforces schemas and successfully extracts Twitter posts and video timestamps.
- **Smart face tracking & rendering**: The Python OpenCV script accurately returns crop coordinates, which FFmpeg uses to render final video clips.
- **UI Rendering**: The results page renders the generated Twitter posts and custom video players for the output clips.

### ❌ What is not working / To Be Implemented
- **Direct File Uploads**: The frontend UI states "File uploads not yet supported in this MVP. Please use YouTube links." Direct video uploads via the React Dropzone are currently blocked/unhandled by the backend.
- **Authentication/Accounts**: There is no user authentication or historical saving of "DNA" extractions; refreshing the page clears the result.
- **Error Handling on SSE Disconnects**: While there are basic error boundaries, sudden disruptions in the system pipeline (e.g., Ollama crashing, or FFmpeg failing) might leave the frontend hanging or displaying ambiguous error logs.

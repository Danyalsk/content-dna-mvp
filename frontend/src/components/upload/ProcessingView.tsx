import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, Terminal, AlertCircle } from 'lucide-react';

interface ProcessingViewProps {
  source: File | string;
  onComplete: (data: any) => void;
}

const steps = [
  { id: 'fetch', label: 'Securing Media Assets', desc: 'Running yt-dlp to anchor high-fidelity source video.' },
  { id: 'transcribe', label: 'Speech Intelligence', desc: 'Executing local Whisper transcription with word-level accuracy.' },
  { id: 'analyze', label: 'Semantic Extraction', desc: 'Mining Content DNA topics and hooks via local Llama 3.2.' },
  { id: 'clip', label: 'Face-Tracking Engine', desc: 'Running OpenCV smart-crop and FFmpeg layout synthesis.' }
];

export const ProcessingView: React.FC<ProcessingViewProps> = ({ source, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<string[]>(['> System initialized. Awaiting pipeline...']);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    async function processVideo() {
      if (typeof source !== 'string') {
        setError("File uploads not yet supported in this MVP. Please use YouTube links.");
        return;
      }

      setLogs(['> Starting pipeline... connecting to real-time system...']);
      setError(null);
      setCurrentStep(0);
      
      try {
        const evUrl = `http://localhost:3000/api/video/stream-url?url=${encodeURIComponent(source as string)}`;
        eventSource = new EventSource(evUrl);

        eventSource.onmessage = (event) => {
          setLogs(prev => [...prev, event.data]);
          
          // Basic step progression based on real logs
          if (event.data.includes('[Whisper]')) setCurrentStep(prev => Math.max(prev, 1));
          if (event.data.includes('[Ollama]')) setCurrentStep(prev => Math.max(prev, 2));
          if (event.data.includes('[OpenCV]') || event.data.includes('[FFmpeg]')) setCurrentStep(prev => Math.max(prev, 3));
        };

        eventSource.addEventListener('complete', (event) => {
          const json = JSON.parse(event.data);
          setLogs(prev => [...prev, '> Pipeline finished completely.']);
          setCurrentStep(4);
          eventSource?.close();
          setTimeout(() => onComplete(json.data), 1000);
        });

        eventSource.addEventListener('error', (event: any) => {
          console.error("EventSource Error:", event);
          // If server sent an explicit error event
          if (event.data) {
            setLogs(prev => [...prev, `> [ERROR] ${event.data}`]);
            setError(event.data);
          } else {
            setLogs(prev => [...prev, `> [ERROR] Connection lost or stream error.`]);
            setError("Stream disconnected unexpectedly.");
          }
          eventSource?.close();
        });

      } catch (err: any) {
        console.error("SSE Setup Error:", err);
        setLogs(prev => [...prev, `> [ERROR] ${err.message}`]);
        setError(err.message);
      }
    }

    processVideo();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [source, onComplete]);

  const isYouTube = typeof source === 'string';
  const sourceName = isYouTube ? 'YouTube URL' : (source as File).name;

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
      
      {/* Visual Status Indicator */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="w-32 h-32 relative flex items-center justify-center bg-[#141416] border border-gray-800 rounded-full shadow-[0_0_50px_rgba(59,130,246,0.15)] z-10">
          <div className="absolute inset-0 border-2 border-t-blue-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
          <RefreshCw size={40} className="text-blue-500 animate-pulse" />
        </div>
      </div>

      <h2 className="text-3xl font-semibold text-white mb-2">Analyzing Content DNA</h2>
      <p className="text-gray-400 mb-10 max-w-md text-center">
        Processing <span className="text-white font-medium">{sourceName}</span>. 
        Local AI models are currently extracting structural intelligence.
      </p>

      {/* Progress Steps */}
      <div className="w-full bg-[#141416] border border-gray-800 rounded-2xl p-8 shadow-2xl mb-8">
        <div className="space-y-6">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;
            const isPending = index > currentStep;

            return (
              <div key={step.id} className="flex gap-6">
                <div className={`mt-1 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500
                  ${isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : ''}
                  ${isActive ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : ''}
                  ${isPending ? 'bg-gray-800/30 text-gray-600 border border-gray-800/50' : ''}
                `}>
                  {isCompleted ? <CheckCircle2 size={20} /> : 
                   isActive ? <RefreshCw size={18} className="animate-spin" /> : 
                   <div className="w-2.5 h-2.5 rounded-full bg-gray-700"></div>}
                </div>
                <div className="flex flex-col gap-1">
                  <div className={`text-xl font-bold transition-colors duration-500
                    ${isCompleted ? 'text-gray-300' : ''}
                    ${isActive ? 'text-white' : ''}
                    ${isPending ? 'text-gray-600' : ''}
                  `}>
                    {step.label}
                  </div>
                  <div className={`text-sm transition-colors duration-500
                    ${isCompleted ? 'text-gray-500' : ''}
                    ${isActive ? 'text-gray-400' : ''}
                    ${isPending ? 'text-gray-700' : ''}
                  `}>
                    {step.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal View */}
      <div className={`w-full bg-[#0a0a0b] border ${error ? 'border-red-500/50' : 'border-gray-800'} rounded-xl overflow-hidden font-mono text-xs`}>
        <div className="bg-[#141416] border-b border-gray-800 px-4 py-2 flex items-center justify-between text-gray-500">
          <div className="flex items-center gap-2">
            <Terminal size={14} />
            <span>System Output Logs</span>
          </div>
          {error && <AlertCircle size={14} className="text-red-500" />}
        </div>
        <div className="p-4 h-48 overflow-y-auto text-gray-400 flex flex-col gap-1">
          {logs.map((log, i) => (
            <div key={i} className={
              log.includes('complete') || log.includes('successfully') ? 'text-blue-400' : 
              log.includes('[ERROR]') ? 'text-red-400' : ''
            }>
              {log}
            </div>
          ))}
          {currentStep < steps.length && !error && (
            <div className="animate-pulse">_</div>
          )}
        </div>
      </div>

    </div>
  );
};

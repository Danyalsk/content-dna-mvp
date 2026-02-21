import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Youtube, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  onVideoSelected: (file: File | string) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onVideoSelected }) => {
  const [urlInput, setUrlInput] = useState('');
  const [error, setError] = useState('');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError('');
    if (acceptedFiles.length > 0) {
      onVideoSelected(acceptedFiles[0]);
    }
  }, [onVideoSelected]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.mov', '.avi', '.mkv']
    },
    maxFiles: 1
  });

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic YouTube URL validation
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
    if (!ytRegex.test(urlInput)) {
      setError('Please enter a valid YouTube URL');
      return;
    }
    
    onVideoSelected(urlInput);
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-8">
      <div 
        {...getRootProps()} 
        className={`relative overflow-hidden group border-2 border-dashed rounded-3xl p-16 text-center cursor-pointer transition-all duration-300 ease-out
          ${isDragActive ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' : 'border-gray-800 bg-[#141416] hover:border-gray-600 hover:bg-[#1a1a1c]'}
          ${isDragReject ? 'border-red-500 bg-red-500/10' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {/* Glow effect */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/5 rounded-full blur-[80px] pointer-events-none group-hover:bg-blue-600/10 transition-colors"></div>

        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center transition-colors
            ${isDragActive ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800/50 text-gray-400 shadow-inner'}
          `}>
            <Upload size={40} className={isDragActive ? 'animate-bounce' : ''} />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-white">
              {isDragActive ? 'Drop your video here' : 'Select or drop a video file'}
            </h3>
            <p className="text-gray-400 text-lg">
              Supports MP4, MOV, AVI (up to 2GB)
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 w-full max-w-2xl mx-auto">
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
        <span className="text-gray-500 text-sm font-medium tracking-wide uppercase">OR</span>
        <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gray-800 to-transparent"></div>
      </div>

      <div className="w-full max-w-2xl mx-auto bg-[#141416] border border-gray-800 rounded-2xl p-2 relative overflow-hidden focus-within:border-blue-500/50 transition-colors shadow-2xl">
        <form onSubmit={handleUrlSubmit} className="relative flex items-center">
          <div className="absolute left-4 text-gray-400">
            <Youtube size={24} />
          </div>
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste YouTube Link (e.g., https://youtube.com/watch?v=...)"
            className="w-full bg-transparent border-none text-white pl-14 pr-32 py-4 focus:ring-0 focus:outline-none text-lg placeholder:text-gray-600"
          />
          <button 
            type="submit"
            className="absolute right-2 bg-white text-black px-6 py-2.5 rounded-xl font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!urlInput.trim()}
          >
            Extract
          </button>
        </form>
      </div>
      
      {error && (
        <div className="flex items-center justify-center gap-2 text-red-400 mt-2">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

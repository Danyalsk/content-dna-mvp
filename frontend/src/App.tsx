import { useState } from 'react';
import { Shell } from './components/layout/Shell';
import { UploadZone } from './components/upload/UploadZone';
import { ProcessingView } from './components/upload/ProcessingView';
import { CheckCircle2 } from 'lucide-react';

type AppState = 'upload' | 'processing' | 'results';

function App() {
  const [appState, setAppState] = useState<AppState>('upload');
  const [selectedSource, setSelectedSource] = useState<File | string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);

  const handleVideoSelected = (source: File | string) => {
    setSelectedSource(source);
    setAppState('processing');
  };

  const handleProcessingComplete = (data: any) => {
    setExtractedData(data);
    setAppState('results');
  };

  return (
    <Shell>
      <div className="flex flex-col gap-8 h-full min-h-[500px] justify-center pt-10">
        {appState === 'upload' && (
          <div className="w-full">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-semibold text-white mb-4 tracking-tight">Initialize Growth Engine</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-xl">
                Upload long-form video to extract its core intelligence and orchestrate a multi-platform content ecosystem.
              </p>
            </div>
            <UploadZone onVideoSelected={handleVideoSelected} />
          </div>
        )}

        {appState === 'processing' && selectedSource && ( // Passing handleProcessingComplete which accepts data
          <ProcessingView 
            source={selectedSource} 
            onComplete={handleProcessingComplete} 
          />
        )}

        {appState === 'results' && extractedData && (
          <div className="w-full max-w-6xl mx-auto px-4 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
            
            {/* Results Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 bg-[#141416]/50 backdrop-blur-xl p-8 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]"></div>
               <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                  <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                    <CheckCircle2 size={40} />
                  </div>
                  <div className="text-center md:text-left">
                    <h2 className="text-4xl font-bold text-white mb-2">Content DNA Mastered</h2>
                    <p className="text-gray-400 text-lg">
                      Topic Analysis: <span className="text-blue-400 font-semibold">{extractedData.topic}</span>
                    </p>
                  </div>
               </div>
               <button 
                  onClick={() => {
                    setAppState('upload');
                    setSelectedSource(null);
                    setExtractedData(null);
                  }}
                  className="relative z-10 bg-white text-black px-8 py-4 rounded-2xl font-bold hover:bg-gray-100 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                >
                  Analyze New Video
                </button>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-10">
               
               {/* Video Clips Section */}
               <div className="xl:col-span-3 space-y-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-white text-xl font-bold flex items-center gap-3">
                       <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                       Generated Hook Clips
                       <span className="text-sm font-normal text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full border border-gray-700">
                          {extractedData.generatedClips?.length || 0} Total
                       </span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
                    {extractedData.generatedClips && extractedData.generatedClips.map((clip: any, idx: number) => (
                      <div key={idx} className="group bg-[#141416] border border-gray-800 rounded-[2.5rem] p-5 shadow-2xl flex flex-col hover:border-blue-500/40 transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
                        <div className="relative w-full aspect-[9/16] bg-black rounded-[2rem] overflow-hidden mb-6 shadow-2xl group-hover:scale-[1.01] transition-transform duration-500">
                          <video 
                            src={`http://localhost:3000${clip.url}`} 
                            controls 
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          
                          {/* Intelligent Layout Badge */}
                          {clip.layout === 'split' && (
                            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-blue-600/90 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.3)] backdrop-blur-md">
                               <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                               Split View Enabled
                            </div>
                          )}
                        </div>

                        <div className="space-y-4 px-2">
                           <h4 className="text-xl font-bold text-white leading-tight line-clamp-2 min-h-[3.5rem]" title={clip.title}>
                             {clip.title}
                           </h4>
                           
                           <div className="flex items-center justify-between pt-2 border-t border-gray-800/50">
                              <div className="flex flex-col">
                                 <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-1">Time Range</span>
                                 <span className="text-sm text-gray-300 font-medium">{clip.startTime}s - {clip.endTime}s</span>
                              </div>
                              <a 
                                href={`http://localhost:3000${clip.url}`} 
                                download 
                                className="bg-[#1a1a1e] text-gray-300 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 hover:text-white transition-all border border-gray-800 hover:border-blue-500 shadow-inner"
                              >
                                Export
                              </a>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               {/* Tweets Section */}
               <div className="xl:col-span-1 border-l border-gray-800/50 pl-0 xl:pl-10">
                  <h3 className="text-white text-xl font-bold flex items-center gap-3 mb-8">
                     <span className="w-2 h-8 bg-sky-500 rounded-full"></span>
                     Twitter Threads
                  </h3>
                  <div className="space-y-8">
                    {extractedData.twitterPosts && extractedData.twitterPosts.map((post: string, idx: number) => (
                      <div key={idx} className="bg-[#141416] p-8 border border-gray-800 rounded-3xl shadow-xl hover:border-sky-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-12 h-12 bg-sky-500/5 text-sky-500 flex items-center justify-center rounded-bl-3xl">
                           <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                        </div>
                        <p className="text-gray-300 text-base leading-relaxed whitespace-pre-wrap">
                          {post}
                        </p>
                      </div>
                    ))}
                  </div>
               </div>

            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}

export default App

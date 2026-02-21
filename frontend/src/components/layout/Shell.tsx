import React from 'react';

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-gray-200 font-sans flex flex-col">
      <header className="border-b border-gray-800 bg-[#0a0a0b] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            CD
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Content DNA OS</h1>
        </div>
        <div className="text-sm text-gray-400 capitalize flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
          System Online
        </div>
      </header>
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

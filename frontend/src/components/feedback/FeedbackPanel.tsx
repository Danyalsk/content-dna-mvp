import { useState, useEffect } from 'react';
import { MessageSquarePlus, Zap, Send, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

// ============================================================
// Types
// ============================================================

type FeedbackCategory =
  | 'clips_too_short'
  | 'clips_too_long'
  | 'bad_titles'
  | 'bad_context_overlays'
  | 'clips_cut_mid_sentence'
  | 'tweets_boring'
  | 'tweets_too_long'
  | 'wrong_segments'
  | 'general';

interface FeedbackEntry {
  id: string;
  category: FeedbackCategory;
  feedbackText: string;
  createdAt: string;
}

const CATEGORY_CHIPS: { value: FeedbackCategory; label: string; emoji: string }[] = [
  { value: 'clips_too_short',        label: 'Clips Too Short',       emoji: '⏱️' },
  { value: 'clips_too_long',         label: 'Clips Too Long',        emoji: '⏳' },
  { value: 'bad_titles',             label: 'Bad Titles',            emoji: '📝' },
  { value: 'bad_context_overlays',   label: 'Bad Overlays',          emoji: '🏷️' },
  { value: 'clips_cut_mid_sentence', label: 'Cuts Mid-Sentence',     emoji: '✂️' },
  { value: 'tweets_boring',          label: 'Tweets Boring',         emoji: '🐦' },
  { value: 'tweets_too_long',        label: 'Tweets Too Long',       emoji: '📏' },
  { value: 'wrong_segments',         label: 'Wrong Segments',        emoji: '🎯' },
  { value: 'general',                label: 'Other',                 emoji: '💬' },
];

// ============================================================
// Component
// ============================================================

export function FeedbackPanel() {
  const [selectedCategory, setSelectedCategory] = useState<FeedbackCategory | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [history, setHistory] = useState<FeedbackEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load feedback history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/video/feedback-history');
      const data = await res.json();
      if (data.success) {
        setHistory(data.feedback);
      }
    } catch (err) {
      console.error('Failed to fetch feedback history:', err);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('http://localhost:3000/api/video/submit-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          feedbackText: feedbackText || CATEGORY_CHIPS.find(c => c.value === selectedCategory)?.label || '',
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setFeedbackText('');
        setSelectedCategory(null);
        fetchHistory();
        setTimeout(() => setSubmitted(false), 4000);
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white text-xl font-bold flex items-center gap-3">
          <span className="w-2 h-8 bg-amber-500 rounded-full"></span>
          <MessageSquarePlus size={22} className="text-amber-400" />
          Train Your AI
        </h3>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-700">
          <Zap size={12} className="text-amber-400" />
          Feedback improves next run
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-[#141416]/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-[80px]"></div>
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]"></div>

        {/* Success State */}
        {submitted && (
          <div className="relative z-10 flex items-center gap-4 p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-emerald-400 font-bold text-sm">Feedback Received!</p>
              <p className="text-gray-400 text-sm">Your preferences have been saved. The AI will apply these learnings on the next video extraction.</p>
            </div>
          </div>
        )}

        <div className="relative z-10">
          {/* Category Chips */}
          <p className="text-gray-400 text-sm font-medium mb-3">What went wrong?</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setSelectedCategory(selectedCategory === chip.value ? null : chip.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                  selectedCategory === chip.value
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.1)] scale-[1.02]'
                    : 'bg-[#1a1a1e] text-gray-400 border border-gray-700 hover:border-amber-500/30 hover:text-amber-300'
                }`}
              >
                <span>{chip.emoji}</span>
                {chip.label}
              </button>
            ))}
          </div>

          {/* Free-text Area (expands when category selected) */}
          {selectedCategory && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder={
                  selectedCategory === 'general'
                    ? 'Tell us what went wrong and what you would prefer...'
                    : `Optional: add more detail about the ${CATEGORY_CHIPS.find(c => c.value === selectedCategory)?.label.toLowerCase()} issue...`
                }
                rows={3}
                className="w-full bg-[#0d0d0f] text-gray-200 border border-gray-700 rounded-2xl p-4 text-sm resize-none placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 focus:shadow-[0_0_20px_rgba(245,158,11,0.05)] transition-all"
              />

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`w-full py-4 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  isSubmitting
                    ? 'bg-gray-700 text-gray-400 cursor-wait'
                    : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:shadow-[0_0_40px_rgba(245,158,11,0.3)] hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                <Send size={16} />
                {isSubmitting ? 'Submitting...' : 'Submit Feedback & Train AI'}
              </button>
            </div>
          )}
        </div>

        {/* Feedback History */}
        {history.length > 0 && (
          <div className="relative z-10 mt-6 pt-6 border-t border-gray-800/50">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors font-medium"
            >
              <Clock size={14} />
              Past Feedback ({history.length})
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showHistory && (
              <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
                {history.map((entry) => {
                  const chip = CATEGORY_CHIPS.find(c => c.value === entry.category);
                  return (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 p-3 bg-[#0d0d0f]/60 rounded-xl border border-gray-800/50"
                    >
                      <span className="text-lg flex-shrink-0 mt-0.5">{chip?.emoji || '💬'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-amber-400/80">{chip?.label || entry.category}</span>
                          <span className="text-[10px] text-gray-600">{formatTime(entry.createdAt)}</span>
                        </div>
                        {entry.feedbackText && entry.feedbackText !== chip?.label && (
                          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{entry.feedbackText}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

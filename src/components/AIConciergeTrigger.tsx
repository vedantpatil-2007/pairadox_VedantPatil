import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIConciergeTriggerProps {
  onClick: () => void;
  isOpen: boolean;
}

export const AIConciergeTrigger: React.FC<AIConciergeTriggerProps> = ({ onClick, isOpen }) => {
  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open SkillNear AI Concierge"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 group cursor-pointer border border-white/20"
    >
      <div className="relative">
        <Sparkles className="w-5 h-5 text-sky-200 group-hover:rotate-12 transition-transform duration-300" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full ring-2 ring-white animate-pulse" />
      </div>
      <span className="font-semibold text-sm tracking-tight pr-1">Ask SkillNear AI</span>
    </button>
  );
};

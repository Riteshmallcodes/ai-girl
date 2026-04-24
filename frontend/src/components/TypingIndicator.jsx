import React from 'react';

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 text-xs text-white/60">
      <span className="w-2 h-2 rounded-full bg-ice animate-bounce" />
      <span className="w-2 h-2 rounded-full bg-ice animate-bounce [animation-delay:120ms]" />
      <span className="w-2 h-2 rounded-full bg-ice animate-bounce [animation-delay:240ms]" />
      <span>Maya is typing...</span>
    </div>
  );
}

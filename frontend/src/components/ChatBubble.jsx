import React from 'react';

export default function ChatBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
          isUser
            ? 'bg-neon/80 text-black'
            : 'bg-dusk/80 border border-white/10 text-white'
        }`}
      >
        {content}
      </div>
    </div>
  );
}

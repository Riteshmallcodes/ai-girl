import React from 'react';
import avatarRealistic from '../assets/avatar_realistic.svg';
import avatarAnime from '../assets/avatar_anime.svg';
import avatar3d from '../assets/avatar_3d.svg';

const variants = {
  realistic: avatarRealistic,
  anime: avatarAnime,
  threeD: avatar3d
};

export default function AvatarPanel({ isSpeaking, variant = 'realistic', onCycle }) {
  const src = variants[variant] || avatarRealistic;

  return (
    <div className="flex items-center justify-center">
      <button
        className={`relative w-[75vw] max-w-[520px] aspect-square rounded-[3rem] overflow-hidden border border-neon/40 ${
          isSpeaking ? 'animate-pulseGlow' : ''
        }`}
        onClick={onCycle}
        aria-label="Change avatar style"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-neon/10 via-transparent to-ice/20" />
        <img
          src={src}
          alt="AI virtual girl"
          className={`w-full h-full object-cover ${isSpeaking ? 'animate-floaty' : ''}`}
        />
      </button>
    </div>
  );
}

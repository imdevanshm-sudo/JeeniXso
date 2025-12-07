// @ts-nocheck - temporary while framer-motion DOM typing conflicts with bundler config
import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { MemoryLog } from '../types';

const MEMORIES: MemoryLog[] = [
  {
    id: '1',
    title: 'First Steps',
    date: '06.18.1999',
    image: `https://lh3.googleusercontent.com/aida-public/AB6AXuCqLCRouykxNVG0qpO_srpVYYt_kKwZshzrOwnz0jmbnONmOQ_Ins7_amKd0FEzwksLdhXKQv6kqnYE0xe2ZNuAj5qi65iWvMtCAosLHgFZfEIDAWBFu5Kl3qDD2-0aBreT8EmB2lGMsONy2Vhcp2LM2Kc8U5hHFRnE7y5_DJXWhs2_L6bYByGDB5W7dmp-nio6aSIdOjJSL5T3p8J6Gof-YoZ1ugZzgUqCkvXNESXo8-gvPppArodgoFvrusnzzh78kHDjXF-nH3EY`,
    description: 'The beginning of the journey.'
  },
  {
    id: '2',
    title: "The Solstice",
    date: '06.21.2005',
    image: `https://lh3.googleusercontent.com/aida-public/AB6AXuCMJvVwM8OPO63QiB301cukH_e7FV_1ROYkcvHekyiYtjM3Wy2L4sh_SOym4RsZO5sIb4liwUsNxzPiCHKEAQATcvoYXf0-IpdnUDUw_gl2cldp-BY5eTFqdePltO0T1FlIe5kRBwTS-JquNhxo9WSEr7MW9QgRyD2wFTToFPK-4YLLin_xN_Brf3WD4kt5iMqH-31g2WVkQnxe3iZiatq3eqF1N998wvqBu4uVHp6tZ2cAfeqqP4j9SJ0zgrX0BHn_Ob0YD8tQgSWi`,
    description: 'Golden hour memories that never fade.'
  },
  {
    id: '3',
    title: 'Downtown Lights',
    date: '11.05.2018',
    image: `https://lh3.googleusercontent.com/aida-public/AB6AXuBJQEJdFfdUF8CBuRkCXpl3708rjiEmGu5bbkwGoK0MVHPtceex5Ck6EClyA6mzNBsryIuUKm94P4LcqgMQruLW1brXHEkdesf-RGTdKhAezAsAhLXSmGCKTIjGytYSXkMCGv4SXbnSVucaI5z4JQRqqkle8bY5_JZq9rCoiieybZ3kI_6DVQDLLCwIMLqbvy2R7rhjlTPtVMcgbVXRvoKJNn9gSQjG4hHGvMWoJIIm9K-N63VsoEqGsivP5o5oqYM7YG38noszXxpV`,
    description: 'City that never sleeps, dreams that never die.'
  }
];

const useSeamlessLoop = (videoRef: React.RefObject<HTMLVideoElement>, startOffset = 0.18, guardWindow = 0.2) => {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const primeLoop = () => {
      try {
        if (video.currentTime < startOffset) {
          video.currentTime = startOffset;
        }
      } catch (error) {
        console.warn('[VaultGallery] Unable to prime background loop', error);
      }
    };
    const handleTimeUpdate = () => {
      if (!video.duration) return;
      if (video.duration - video.currentTime <= guardWindow) {
        video.currentTime = startOffset;
      }
    };
    video.addEventListener('loadedmetadata', primeLoop);
    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('loadedmetadata', primeLoop);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, startOffset, guardWindow]);
};

interface VaultGalleryProps {
  onBack: (reason?: 'back' | 'selected') => void;
  onMemorySelect?: (memory: MemoryLog) => void;
  audioUnlocked?: boolean;
  videoSrc?: string;
  lowPowerMode?: boolean;
}

export const VaultGallery: React.FC<VaultGalleryProps> = ({
  onBack,
  onMemorySelect,
  audioUnlocked = false,
  videoSrc = '/media/vault_loop.mp4',
  lowPowerMode = false
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isAudioLive = audioUnlocked;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useSeamlessLoop(videoRef, 0.25, 0.22);

  // Handle Vault Audio
  useEffect(() => {
    if (audioUnlocked) {
        audioRef.current?.play().catch(() => {});
    } else {
        audioRef.current?.pause();
    }
  }, [audioUnlocked]);

  // Parallax Logic
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    // Calculate position from center
    mouseX.set(clientX - innerWidth / 2);
    mouseY.set(clientY - innerHeight / 2);
  };

  // Create subtle parallax offsets based on mouse position
  // Dividing by a larger number makes the movement smaller (more subtle)
  const cardX = useTransform(mouseX, (value) => value / 40);
  const cardY = useTransform(mouseY, (value) => value / 40);
  const cardStyle = lowPowerMode ? undefined : { x: cardX, y: cardY };

  const handleCardClick = (memory: MemoryLog) => {
    setSelectedId(memory.id);
    onMemorySelect?.(memory);
    setTimeout(() => {
      onBack('selected');
    }, 500);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative z-10 flex h-full flex-col justify-between bg-transparent"
      onMouseMove={handleMouseMove}
    >
      <audio ref={audioRef} src="/media/vault_audio.wav" loop playsInline />

      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={{ transform: 'scale(1.15)', objectPosition: 'center 45%' }}
          src={videoSrc}
          autoPlay
          loop
          muted={true} // Video muted, using separate audio track
          playsInline
          aria-hidden="true"
          preload="auto"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80" />
      </div>

      {/* Header */}
      <header className="flex items-center p-4 pb-2 z-20">
        <button 
          onClick={() => onBack('back')}
          className="flex size-12 shrink-0 items-center justify-start text-white/50 hover:text-white transition-colors"
        >
          [BACK]
        </button>
        <h1 className="flex-1 text-center text-lg font-bold tracking-widest text-[#f4c025]/80 font-serif">
          CHRONOS LOGS
        </h1>
        <div className="flex w-12 items-center justify-end">
          <p className="shrink-0 text-base font-bold leading-normal tracking-[0.015em] text-[#cbbc90]">
            {MEMORIES.length}
          </p>
        </div>
      </header>

      {/* Carousel Area */}
      <main className="flex flex-1 flex-col justify-center overflow-hidden pt-8">
        <div className="flex overflow-x-auto overflow-y-hidden items-center p-4 gap-8 w-full h-full snap-x snap-mandatory scrollbar-hide px-8 md:px-[calc(50vw-150px)]">
          {MEMORIES.map((memory) => (
            <motion.div
              key={memory.id}
              className="flex-shrink-0 flex flex-col gap-4 rounded-lg min-w-[280px] max-w-[320px] snap-center cursor-pointer group"
              whileHover={lowPowerMode ? undefined : { scale: 1.05 }}
              onClick={() => handleCardClick(memory)}
              style={cardStyle} // Apply parallax here
            >
              <div 
                className={`
                  relative w-full aspect-square flex items-center justify-center 
                  border border-transparent hover:border-[#f4c025] 
                  bg-white/5 backdrop-blur-sm rounded-xl overflow-hidden
                  transition-all duration-300
                `}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#f4c025]/20 to-transparent opacity-50 group-hover:opacity-100 transition-opacity" />
                <img 
                  src={memory.image} 
                  alt={memory.title}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
              
              <div className="space-y-1">
                <p className="text-white text-xl font-medium leading-normal text-center font-display tracking-wide group-hover:text-[#f4c025] transition-colors">
                  {memory.title}
                </p>
                <p className="text-[#f4c025]/60 text-base font-normal leading-normal text-center font-mono">
                  {memory.date}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-4 pb-8 pt-4 z-20">
        <div className="flex w-full flex-row items-center justify-center gap-3">
          {MEMORIES.map((m) => (
            <div key={m.id} className="h-1.5 w-1.5 rounded-full bg-[#f4c025]/40" />
          ))}
        </div>
      </footer>
    </motion.div>
  );
};

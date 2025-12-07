// @ts-nocheck - framer-motion DOM typing conflicts under current TS config
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  onComplete: () => void;
  mediaReady?: boolean;
  lowPowerMode?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete, mediaReady = false, lowPowerMode = false }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [gateActive, setGateActive] = useState(false);
  const [gateComplete, setGateComplete] = useState(false);
  const shockwaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playVideoWithAudio = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = false;
      await videoRef.current.play();
    } catch (error) {
      console.warn('[LoadingScreen] Autoplay with audio failed, falling back to muted playback.', error);
      try {
        videoRef.current.muted = true;
        await videoRef.current.play();
      } catch (secondaryError) {
        console.error('[LoadingScreen] Unable to start intro video.', secondaryError);
        setVideoFailed(true);
      }
    }
  }, []);

  const handleInteraction = async () => {
    setHasInteracted(true);
    await playVideoWithAudio();
  };

  useEffect(() => {
    if (!videoEnded) return;

    setShockwaveActive(true);
    if (shockwaveTimerRef.current) clearTimeout(shockwaveTimerRef.current);
    shockwaveTimerRef.current = setTimeout(() => {
      setShockwaveActive(false);
      setGateActive(true);
    }, 900);

    if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
    gateTimerRef.current = setTimeout(() => {
      setGateComplete(true);
      onComplete();
    }, 2100);

    return () => {
      if (shockwaveTimerRef.current) clearTimeout(shockwaveTimerRef.current);
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
    };
  }, [videoEnded, onComplete]);

  const allowHighMotion = !lowPowerMode;

  const shockwaveOverlay = allowHighMotion ? (
    <AnimatePresence>
      {shockwaveActive && (
        <motion.div
          key="shockwave-overlay"
          className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-32 w-32 rounded-full border border-[#f4c025]/80 bg-gradient-to-r from-transparent via-[#f4c025]/40 to-transparent shadow-[0_0_45px_rgba(244,192,37,0.4)]"
            initial={{ opacity: 0.9, scale: 0.2, filter: 'blur(2px)' }}
            animate={{ opacity: 0, scale: 8, filter: 'blur(12px)' }}
            transition={{ duration: 1.2, ease: [0.19, 1, 0.22, 1] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  ) : null;

  const gateOverlay = allowHighMotion ? (
    <AnimatePresence>
      {gateActive && (
        <motion.div
          key="gate-overlay"
          className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="relative h-48 w-48 rounded-full border border-[#f4c025]/80 bg-black/30 shadow-[0_0_40px_rgba(244,192,37,0.4)]"
            initial={{ scale: 0.4, opacity: 0.8 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1] }}
          >
            <div className="absolute inset-2 rounded-full border border-[#ffdd7a]/30 blur-sm" />
            <div className="absolute inset-6 rounded-full border border-[#d6a629]/20 blur-sm" />
          </motion.div>
          <motion.div
            className="absolute inset-0 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.6, ease: 'easeInOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-full items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src="/media/breach_intro.mp4"
          playsInline
          preload="auto"
          controls={false}
          muted={!hasInteracted}
          onCanPlay={() => setVideoReady(true)}
          onPlay={() => setVideoFailed(false)}
          onEnded={() => setVideoEnded(true)}
          onError={() => setVideoFailed(true)}
        />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {!hasInteracted && (
        <div className="relative z-30 flex flex-col items-center gap-6 text-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="space-y-3"
          >
            <p className="text-sm font-mono uppercase tracking-[0.4em] text-white/70">Reality Breach Protocol</p>
            <h1 className="text-4xl font-bold tracking-[0.2em] text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.35)]">
              TOUCH TO INITIATE
            </h1>
            <p className="text-xs font-mono uppercase tracking-[0.35em] text-[#f4c025]/80">
              Audio enabled • cinematic intro
            </p>
          </motion.div>

          <button
            onClick={handleInteraction}
            className="rounded-full border border-white/40 bg-white/10 px-10 py-3 font-mono text-xs uppercase tracking-[0.4em] text-white transition hover:bg-white/20 hover:border-white/70 disabled:opacity-40"
            disabled={!videoReady || !mediaReady}
          >
            {mediaReady ? (videoReady || videoFailed ? 'BEGIN' : 'BUFFERING') : 'PRIMING EXPERIENCE'}
          </button>

          <p className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/60">
            Portal Feed · {mediaReady ? 'SYNCHRONIZED' : 'CALIBRATING'}
          </p>

          {videoFailed && (
            <p className="text-xs font-mono text-red-300/80">
              Unable to load intro media. Please check your connection.
            </p>
          )}
        </div>
      )}

      {hasInteracted && !videoEnded && (
        <motion.div
          className="absolute bottom-10 flex flex-col items-center gap-2 text-white/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2 }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.35em]">Immersion initializing</p>
          <div className="h-px w-24 bg-white/40" />
        </motion.div>
      )}

      {shockwaveOverlay}
      {gateOverlay}

      {gateComplete && (
        <motion.div
          className="absolute inset-0 z-50 bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        />
      )}
    </div>
  );
};
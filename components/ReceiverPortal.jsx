import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const useVideoStartOffset = (videoRef, offset = 0) => {
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleLoaded = () => {
      try {
        video.currentTime = offset;
      } catch (error) {
        console.warn('[ReceiverPortal] Unable to set start offset', error);
      }
    };
    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [videoRef, offset]);
};

const OverlayButton = ({ label, onPress, lowPowerMode }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onPress(e); }}
    className={`
      absolute z-20 flex items-center justify-center 
      px-8 py-3 
      text-[11px] font-mono uppercase tracking-[0.4em] 
      text-white/90 
      transition-all duration-500
      hover:text-white hover:tracking-[0.5em] hover:bg-white/5
      focus:outline-none
      group
    `}
    style={{ 
      top: '65%', 
      left: '50%', 
      transform: 'translate(-50%, -50%)',
      textShadow: '0 0 8px rgba(255,255,255,0.5)'
    }}
  >
    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50 group-hover:opacity-80 transition-opacity" />
    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50 group-hover:opacity-80 transition-opacity" />
    <span className="relative z-10">{label}</span>
  </button>
);

const FullScreenBlurOverlay = ({ label, onPress, lowPowerMode, children }) => (
  <div className={`absolute inset-0 z-30 flex items-center justify-center bg-black/20 ${lowPowerMode ? 'bg-black/80' : 'backdrop-blur-md'}`}>
    <div className="relative group cursor-pointer flex flex-col items-center" onClick={onPress}>
        <OverlayButton label={label} onPress={onPress} lowPowerMode={lowPowerMode} />
    </div>
    {children}
  </div>
);

export const ReceiverPortal = ({
  onInitiate,
  activeMemory = null,
  onAudioUnlock,
  audioUnlocked = true,
  portalVideoSrc = '/media/portal_loop.mp4',
  lowPowerMode = false,
  mediaReady = false,
  onRequestVault,
  isVaultOpen = false,
  accessGranted = false,
  onResetToImport
}) => {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const reliveAudioRef = useRef(null);
  useVideoStartOffset(videoRef, 0);

  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  
  // PAUSE STATES
  const [pauseAt8, setPauseAt8] = useState(false);   // Enter Jeeniverse
  const [pauseAt14, setPauseAt14] = useState(false); // Select Exo (Guest only)
  const [pauseAtEnd, setPauseAtEnd] = useState(false); // End of video
  const [pauseAt29, setPauseAt29] = useState(false); // Loop Back Pause

  // FLOW CONTROL
  const [hasEnteredJeeniverse, setHasEnteredJeeniverse] = useState(false);
  const [exoReady, setExoReady] = useState(false);
  const [isWarping, setIsWarping] = useState(false);
  const [showStarfield, setShowStarfield] = useState(false);
  const [showLoadingClip, setShowLoadingClip] = useState(false);
  const [pendingLoadingAction, setPendingLoadingAction] = useState(null); // 'exit' | 'relive'
  const [loadingClipPlaying, setLoadingClipPlaying] = useState(false);
  const loadingClipRef = useRef(null);
  const [loadingClipSrc, setLoadingClipSrc] = useState('/media/Stargate_Clockwork_Video_Generation.mp4');
  const [veilActive, setVeilActive] = useState(false);
  const [exsoSelected, setExsoSelected] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false); // Track if we are seeking to prevent flashes
  // Extra interval-based one-shots
  const audio8Ref = useRef(null);
  const audio16Ref = useRef(null);
  const audio21Ref = useRef(null);
  const audio29Ref = useRef(null);
  const played8Ref = useRef(false);
  const played16Ref = useRef(false);
  const played21Ref = useRef(false);
  const played29Ref = useRef(false);
  const extraAudioRefs = [audio8Ref, audio16Ref, audio21Ref, audio29Ref];
  const [isExtraPlaying, setIsExtraPlaying] = useState(false);
  
  // Centralized audio manager: ensures only ONE audio plays at a time
  // Stop only interval extras (keep video playing)
  const stopExtras = useCallback(() => {
    extraAudioRefs.forEach(ref => {
      if (ref.current) {
        ref.current.pause();
        ref.current.currentTime = 0;
      }
    });
  }, [extraAudioRefs]);

  // Stop main / relive beds (do not touch video audio)
  const stopBedAudios = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (reliveAudioRef.current) {
      reliveAudioRef.current.pause();
    }
  }, []);

  // Hard stop everything non-video (used on transitions/resets)
  const stopAllAudios = useCallback(() => {
    stopBedAudios();
    stopExtras();
  }, [stopBedAudios, stopExtras]);
  
  const playExtraRef = useCallback((ref) => {
    if (!audioUnlocked || !ref) return;
    // Stop all non-video beds before playing the cue to avoid overlap
    stopAllAudios();
    setIsExtraPlaying(true);
    ref.muted = !audioUnlocked;
    ref.currentTime = 0;
    ref.play().catch(() => {});
  }, [audioUnlocked, stopAllAudios]);
  
  const playNextExtra = useCallback((from) => {
    if (!audioUnlocked) return;
    const idx = extraAudioRefs.findIndex((r) => r.current === from);
    if (idx === -1) {
      // No next audio found, stop extra playback and allow main audio to resume
      setIsExtraPlaying(false);
      return;
    }
    const next = extraAudioRefs[(idx + 1) % extraAudioRefs.length]?.current;
    if (next) {
      playExtraRef(next);
    } else {
      // No more extras, allow main audio to resume
      setIsExtraPlaying(false);
    }
  }, [audioUnlocked, extraAudioRefs, playExtraRef]);
  
  // Check if any extra audio is currently playing
  useEffect(() => {
    const checkPlaying = () => {
      const anyPlaying = extraAudioRefs.some(ref => {
        const el = ref.current;
        return el && !el.paused && el.currentTime > 0 && el.currentTime < el.duration;
      });
      if (!anyPlaying && isExtraPlaying) {
        setIsExtraPlaying(false);
      }
    };
    const interval = setInterval(checkPlaying, 100);
    return () => clearInterval(interval);
  }, [isExtraPlaying, extraAudioRefs]);
  
  // Refs for sync access in timeupdate
  const accessGrantedRef = useRef(accessGranted);
  const pauseAt8Ref = useRef(false);
  const pauseAt14Ref = useRef(false);
  const pauseAt29Ref = useRef(false);
  const pauseAtEndRef = useRef(false);
  const hasEnteredJeeniverseRef = useRef(false);
  const isPlayingThroughRef = useRef(false); // True if we are playing to end (Import or Exo Selected)
  const prevVaultOpenRef = useRef(isVaultOpen);
  const backLoopActiveRef = useRef(false); // True if we are in the 21-29 loop

  useEffect(() => { accessGrantedRef.current = accessGranted; }, [accessGranted]);
  useEffect(() => { pauseAt8Ref.current = pauseAt8; }, [pauseAt8]);
  useEffect(() => { pauseAt14Ref.current = pauseAt14; }, [pauseAt14]);
  useEffect(() => { pauseAt29Ref.current = pauseAt29; }, [pauseAt29]);
  useEffect(() => { pauseAtEndRef.current = pauseAtEnd; }, [pauseAtEnd]);
  useEffect(() => { hasEnteredJeeniverseRef.current = hasEnteredJeeniverse; }, [hasEnteredJeeniverse]);

  const primingExperience = !videoReady;
  // Keep portal visible until the loading clip actually starts playing, then crossfade
  const portalHidden = (showLoadingClip && loadingClipPlaying) || showStarfield;
  const isExitClip = showLoadingClip && loadingClipSrc.includes('Stargate_Clockwork');
  const isReliveClip = showLoadingClip && loadingClipSrc.includes('breach_intro');

  const pauseVideo = useCallback(async () => {
    try { await videoRef.current?.pause(); } catch {}
  }, []);

  const resumeVideo = useCallback(async () => {
    try { await videoRef.current?.play(); } catch {}
  }, []);

  // 1. Handle Vault Open/Close
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isVaultOpen) {
      video.pause();
      // Stop all audios when vault opens
      stopAllAudios();
      setIsExtraPlaying(false);
    } else if (prevVaultOpenRef.current) {
      // Vault just closed
      // Stop ALL audios before seeking to prevent overlap
      stopAllAudios();
      setIsExtraPlaying(false);
      
      // Set transition state to true immediately to mask frame jumps
      setIsSeeking(true);
      // hide current frame while we seek
      video.style.opacity = '0';
      
      const onSeeked = () => {
         // allow a tiny delay so the frame is stable before revealing
         setTimeout(() => {
            video.style.opacity = '';
            setIsSeeking(false);
         }, 180);
         video.removeEventListener('seeked', onSeeked);
      };
      video.addEventListener('seeked', onSeeked);

      if (activeMemory) {
        // EXO SELECTED: Jump to 0:29 and play to end
        setExsoSelected(true); // Trigger new audio
        isPlayingThroughRef.current = true;
        backLoopActiveRef.current = false;
        played29Ref.current = false; // allow 29s cue to fire after seek
        
        // Reset pause states that might interfere
        setPauseAt14(false);
        setPauseAt29(false);
        setPauseAtEnd(false);
        
        video.currentTime = 29.1;
        resumeVideo();
      } else {
        // BACK PRESSED (No Exo): Loop 21-29
        isPlayingThroughRef.current = false;
        backLoopActiveRef.current = true;
        played21Ref.current = false;
        played29Ref.current = false;
        
        setPauseAt14(false);
        setPauseAt29(false); // Will trigger at 29
        
        video.currentTime = 21;
        resumeVideo();
      }
    }
    prevVaultOpenRef.current = isVaultOpen;
  }, [isVaultOpen, activeMemory, resumeVideo, stopAllAudios]);

  // 2. Time Update Logic (The Brain)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;

      // --- 0:08 PAUSE (ENTER JEENIVERSE) ---
      // Occurs for everyone once at the start
      if (!hasEnteredJeeniverseRef.current && t >= 8 && !pauseAt8Ref.current) {
        setPauseAt8(true);
        pauseVideo();
      }

      // reset interval triggers when rewinding near start
      if (t < 7) {
        played8Ref.current = false;
        played16Ref.current = false;
        played21Ref.current = false;
        played29Ref.current = false;
      }

      // fire interval one-shots (non-looping)
      if (!played8Ref.current && t >= 8) {
        played8Ref.current = true;
        playExtraRef(audio8Ref.current);
      }
      if (!played16Ref.current && t >= 16) {
        played16Ref.current = true;
        playExtraRef(audio16Ref.current);
      }
      if (!played21Ref.current && t >= 21) {
        played21Ref.current = true;
        playExtraRef(audio21Ref.current);
      }
      if (!played29Ref.current && t >= 29) {
        played29Ref.current = true;
        playExtraRef(audio29Ref.current);
      }

      // Import Reality Key path: once authorized and playing through, skip all other pauses
      if (accessGrantedRef.current && isPlayingThroughRef.current) {
        return;
      }

      // --- 0:14 PAUSE (SELECT EXO - GUEST MODE) ---
      // Only if NOT accessGranted and NOT playing through final sequence already
      // And obviously only if we have passed the 8s mark
      if (hasEnteredJeeniverseRef.current && !accessGrantedRef.current && !isPlayingThroughRef.current && !backLoopActiveRef.current) {
        if (t >= 14 && !pauseAt14Ref.current) {
            setPauseAt14(true);
            pauseVideo();
        }
      }

      // Safety: if somehow paused at 14 while accessGranted toggled on, clear it
      if (pauseAt14Ref.current && accessGrantedRef.current) {
        setPauseAt14(false);
        isPlayingThroughRef.current = true;
        backLoopActiveRef.current = false;
        resumeVideo();
        return;
      }

      // --- 21-29 LOOP (BACK BUTTON MODE) ---
      if (backLoopActiveRef.current) {
        // If we hit 29 in back loop mode, pause and show Select Exo
        if (t >= 29 && !pauseAt29Ref.current) {
            setPauseAt29(true);
            pauseVideo();
        }
      }

      // --- FORCE LOOP START FOR BACK MODE ---
      // If user is in back loop mode, and video wraps or starts before 21, bump it to 21
      // (Unless we are just starting the seek)
      if (backLoopActiveRef.current && t < 21 && !pauseAt29Ref.current) {
          // Only nudge if playing
          if (!video.paused) {
             video.currentTime = 21;
          }
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [pauseVideo, resumeVideo]);

  // Play the loading clip when requested
  useEffect(() => {
    if (showLoadingClip && loadingClipRef.current) {
      try {
        loadingClipRef.current.currentTime = 0;
        loadingClipRef.current.play().catch(() => {});
      } catch {}
    }
  }, [showLoadingClip]);

  // Veil trigger for relive clip (last 3s)
  useEffect(() => {
    if (!showLoadingClip) return;
    const video = loadingClipRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!video.duration) return;
      const remaining = video.duration - video.currentTime;
      setVeilActive(!isExitClip && remaining <= 3);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);

    const timer = setTimeout(() => {
      handleLoadingClipEnded();
    }, 12000); // 12s safety
    return () => {
      clearTimeout(timer);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [showLoadingClip, isExitClip]);

  // 3. Audio & Ready States
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    const reliveAudio = reliveAudioRef.current;
    
    if (video) {
        video.muted = !audioUnlocked; // Portal audio always on
        if (audioUnlocked && !isVaultOpen && !primingExperience && !pauseAt8 && !pauseAt14 && !pauseAt29 && !pauseAtEnd) {
             resumeVideo();
        }
    }

    // Audio Overlay Logic:
    // If playing relive clip, play 'relive_score.wav' (looped false)
    // Else If exsoSelected is true (post-vault selection), play 'exso_audio.wav' (looped)
    // Else (before selection), play 'shadowmystic_score.wav' (no loop, intro only)
    
    if (audioUnlocked && !isVaultOpen && !primingExperience) {
      if ((isReliveClip || isExitClip) && loadingClipPlaying) {
         // Relive or Exit clip playing: stop ALL other audios first
         stopAllAudios();
         if (isReliveClip) {
           // Only play relive audio for relive clip
           if (reliveAudio) {
             reliveAudio.muted = !audioUnlocked;
             reliveAudio.play().catch(() => {});
           }
         }
         // Exit clip uses video audio only, no additional audio
      } else if (isExtraPlaying) {
         // Extra cue active: keep beds paused to avoid overlap
         stopBedAudios();
      } else if (exsoSelected) {
         // Exso selected (main loop) - stop all others, then play main audio
         stopAllAudios();
         if (audio) {
           audio.muted = !audioUnlocked;
           audio.play().catch(() => {});
         }
      } else {
         // Before selection (intro score - shadowmystic_score now) - stop all others, then play
         stopAllAudios();
         if (audio) {
           audio.muted = !audioUnlocked;
           audio.play().catch(() => {});
         }
      }
      // apply mute state to interval audios
      [audio8Ref, audio16Ref, audio21Ref, audio29Ref].forEach(ref => {
        if (ref.current) ref.current.muted = !audioUnlocked;
      });
    } else {
      // Audio locked or vault open - stop everything
      stopAllAudios();
    }
    
  }, [audioUnlocked, isVaultOpen, primingExperience, resumeVideo, exsoSelected, isReliveClip, loadingClipPlaying, isExtraPlaying, stopAllAudios, stopBedAudios]);

  // Pause portal video while bridge/loading visuals are up
  useEffect(() => {
    if (portalHidden) {
      pauseVideo();
      // Don't pause audio ref here blindly, handled above logic for Relive vs Main
    }
  }, [portalHidden, pauseVideo]);

  // Starfield intro/bridge: black with stars → fade to main video once ready
  useEffect(() => {
    if (!videoReady || !showStarfield) return;
    // keep the starfield visible briefly, then allow it to fade out
    const timer = setTimeout(() => setShowStarfield(false), 2200);
    return () => clearTimeout(timer);
  }, [videoReady, showStarfield]);

  useEffect(() => {
    if (activeMemory) {
        setExoReady(true);
    } else {
        setExoReady(false);
    }
  }, [activeMemory]);

  // 4. Handlers
  const handleVideoEnded = () => {
    setPauseAtEnd(true);
    pauseVideo();
    isPlayingThroughRef.current = false;
    backLoopActiveRef.current = false; 
  };

  const handleCorePress = async () => {
    if (primingExperience || videoError) return;

    // Unlock audio on first interact
    if (!audioUnlocked && typeof onAudioUnlock === 'function') {
      onAudioUnlock();
    }

    // CASE: Enter Jeeniverse (0:08)
    if (pauseAt8) {
      setPauseAt8(false);
      setHasEnteredJeeniverse(true);
      
      // If Access Granted, we play continuously to end.
      // If Guest, we play to 14.
      if (accessGrantedRef.current) {
          isPlayingThroughRef.current = true;
          setExsoSelected(true); // Import Reality Key triggers new audio too
      } else {
          isPlayingThroughRef.current = false;
      }

      await resumeVideo();
      return;
    }

    // CASE: Select Exo (0:14) OR Back Loop Pause (0:29)
    if (pauseAt14 || pauseAt29 || pauseAtEnd) {
      // If we need to select an exo but haven't
      if (!exoReady && !accessGranted) {
        if (typeof onRequestVault === 'function') {
          onRequestVault();
        }
        return;
      }

      // If we have an exo or access granted, PLAY THROUGH
      setPauseAt14(false);
      setPauseAt29(false);
      setPauseAtEnd(false);
      
      isPlayingThroughRef.current = true;
      backLoopActiveRef.current = false;
      setExsoSelected(true); // Ensure audio switches if not already

      // If we are at the end or 14/29 pause, jump to 29.1 to play finale
      // Wait, user said "continuing from 00:29" after selecting exo.
      // Also if "import reality key" (accessGranted), it plays continuously to end.
      // If we are paused at 14 (Guest), and they select Exo, we jump to 29.
      if (videoRef.current) {
          videoRef.current.currentTime = 29.1;
          await resumeVideo();
      }
      return;
    }
  };

  const performExitReset = async () => {
    // Stop ALL audios before reset
    stopAllAudios();
    setIsExtraPlaying(false);
    
    // Return to import overlay (“Enter Reality Key”) if provided
    if (typeof onResetToImport === 'function') {
      onResetToImport();
      return;
    }

    // Fallback: guest continue-to-vault state at 14s
    setPauseAtEnd(false);
    setPauseAt29(false);
    setPauseAt8(false);
    setHasEnteredJeeniverse(true); // we already entered
    setPauseAt14(true);            // show Select Exo overlay
    isPlayingThroughRef.current = false;
    backLoopActiveRef.current = false;
    setExsoSelected(false); // Reset audio to original portal sound
    
    if (videoRef.current) {
        videoRef.current.currentTime = 14;
        await pauseVideo();
    }
  };

  const performReliveReplay = async () => {
    // Stop ALL audios before relive replay
    stopAllAudios();
    setIsExtraPlaying(false);
    
    // Replay the finale from 29.1s
    setPauseAtEnd(false);
    setPauseAt14(false);
    setPauseAt29(false);
    isPlayingThroughRef.current = true;
    backLoopActiveRef.current = false;
    setExsoSelected(true); // Ensure proper audio
    if (videoRef.current) {
      videoRef.current.currentTime = 29.1;
      await resumeVideo();
    }
  };

  const handleLoadingClipEnded = async () => {
    const next = pendingLoadingAction;
    setShowLoadingClip(false);
    setLoadingClipPlaying(false);
    setVeilActive(false);
    setPendingLoadingAction(null);
    // Fade through starfield before returning to the main portal video
    setShowStarfield(true);
    // Hold the starfield briefly so it's visible before resuming portal
    await new Promise((resolve) => setTimeout(resolve, 1600));
    if (next === 'exit') {
      await performExitReset();
    } else if (next === 'relive') {
      await performReliveReplay();
    }
  };

  const handleExitToPortal = () => {
    pauseVideo();
    // Stop ALL audios before transition
    stopAllAudios();
    setIsExtraPlaying(false);
    setLoadingClipSrc('/media/Stargate_Clockwork_Video_Generation.mp4');
    setPendingLoadingAction('exit');
    setShowLoadingClip(true);
  };

  const handleReliveExo = () => {
    pauseVideo();
    // Stop ALL audios before relive transition
    stopAllAudios();
    setIsExtraPlaying(false);
    // Play breach intro as cinematic bridge before reliving exo
    setLoadingClipSrc('/media/breach_intro.mp4');
    setPendingLoadingAction('relive');
    setShowLoadingClip(true);
  };

  // 5. Render Logic
  const showOverlay = primingExperience || pauseAt8 || pauseAt14 || pauseAt29 || pauseAtEnd;
  
  let overlayLabel = '...';
  if (primingExperience) overlayLabel = 'PRIMING EXPERIENCE';
  else if (pauseAt8) overlayLabel = 'ENTER JEENIVERSE';
  else if (pauseAt14 || pauseAt29 || pauseAtEnd) overlayLabel = (accessGranted || exoReady) ? 'ENTER EXSO' : 'SELECT EXSO';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* 
          Audio Layering Logic:
          1. Portal Video Audio: Always active (unless muted globally).
          2. Overlay Audio:
             - Before Selection: 'shadowmystic_score.wav' (Intro, No Loop)
             - After Selection: 'exso_audio.wav' (Exo Theme, No Loop)
             - Relive Clip: 'relive_score.wav' (Breach Intro, No Loop)
      */}
      <audio 
        ref={audioRef}
        key={exsoSelected ? 'exso' : 'intro'} 
        src={exsoSelected ? "/media/exso_audio.wav" : "/media/shadowmystic_score.wav"}
        playsInline
        loop={false}
      />
      
      <audio 
        ref={reliveAudioRef}
        src="/media/relive_score.wav"
        playsInline
        loop={false}
      />
      {/* Interval one-shot audios at 0:08 / 0:16 / 0:21 / 0:29 */}
      <audio ref={audio8Ref} src="/media/Music_fx_celestial_uplifting_cinematic_score (3).wav" playsInline preload="auto" onEnded={() => playNextExtra(audio8Ref.current)} />
      <audio ref={audio16Ref} src="/media/Music_fx_deep_introspective_ambient_score_wi (1).wav" playsInline preload="auto" onEnded={() => playNextExtra(audio16Ref.current)} />
      <audio ref={audio21Ref} src="/media/Music_fx_deep_introspective_ambient_score_wi.wav" playsInline preload="auto" onEnded={() => playNextExtra(audio21Ref.current)} />
      <audio ref={audio29Ref} src="/media/Music_fx_celestial_uplifting_cinematic_score (3).wav" playsInline preload="auto" onEnded={() => playNextExtra(audio29Ref.current)} />

      <div className="absolute inset-0">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          style={{
            transform: 'scale(1.18)',
            objectPosition: 'center 38%',
            opacity: (portalHidden || isSeeking) ? 0 : 1,
            transition: 'opacity 0.65s ease-in-out'
          }}
          src={portalVideoSrc}
          autoPlay
          loop={false}
          muted={!audioUnlocked}
          playsInline
          preload="auto"
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoError(true)}
          onEnded={handleVideoEnded}
        />

        {primingExperience && <OverlayButton label="PRIMING EXPERIENCE" onPress={handleCorePress} />}
        
        {!primingExperience && pauseAt8 && (
            <FullScreenBlurOverlay label="ENTER JEENIVERSE" onPress={handleCorePress} lowPowerMode={lowPowerMode} />
        )}

        {!primingExperience && !showLoadingClip && !showStarfield && (pauseAt14 || pauseAt29) && (
          <FullScreenBlurOverlay label={overlayLabel} onPress={handleCorePress} lowPowerMode={lowPowerMode} />
        )}

        {/* End-of-video overlay: only Exit Exso or Relive Exso */}
        {!primingExperience && !showLoadingClip && !showStarfield && pauseAtEnd && (
          <div className={`absolute inset-0 z-30 flex items-center justify-center bg-black/20 ${lowPowerMode ? 'bg-black/80' : 'backdrop-blur-md'}`}>
            <div className="flex flex-col items-center gap-4">
              <div className="text-xs uppercase tracking-[0.35em] text-white/80">End of Sequence</div>
              <div className="flex gap-4">
                <button
                  onClick={(e) => { e.stopPropagation(); handleExitToPortal(); }}
                  className="px-5 py-2 rounded border border-white/30 bg-white/10 hover:bg-white/20 transition text-[11px] uppercase tracking-[0.3em]"
                >
                  Exit Exso
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReliveExo(); }}
                  className="px-5 py-2 rounded border border-white/30 bg-white/10 hover:bg-white/20 transition text-[11px] uppercase tracking-[0.3em]"
                >
                  Relive Exso
                </button>
              </div>
      </div>
        </div>
        )}

        {!showOverlay && (
          <div className="absolute inset-0 flex items-center justify-center">
             {/* Invisible tap area for general interaction if needed, or specific cues */}
            </div>
          )}
        </div>

      <AnimatePresence>
        {(isWarping || isSeeking) && (
          <motion.div
            className="absolute inset-0 pointer-events-none bg-black/60 backdrop-blur-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

  {/* Cinematic crossfade veil during relive clip (exit clip stays raw).
     Triggers only when remaining time <= 3s */}
  <AnimatePresence>
    {showLoadingClip && !isExitClip && (veilActive || isSeeking) && (
      <motion.div
        key="veil"
        className="absolute inset-0 z-30 bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.75 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 2.0, ease: 'easeInOut' }}
      />
    )}
  </AnimatePresence>

      {/* Initial starfield-to-video fade */}
      <AnimatePresence>
        {showStarfield && (
          <motion.div
            key="starfield"
            className="absolute inset-0 z-35"
            style={{
              backgroundColor: '#000',
              backgroundImage: `
                radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.8), transparent 55%),
                radial-gradient(1px 1px at 70% 20%, rgba(255,255,255,0.7), transparent 55%),
                radial-gradient(1.5px 1.5px at 40% 60%, rgba(255,255,255,0.9), transparent 60%),
                radial-gradient(1px 1px at 80% 70%, rgba(255,255,255,0.65), transparent 55%),
                radial-gradient(1px 1px at 50% 40%, rgba(255,255,255,0.75), transparent 55%),
                radial-gradient(2px 2px at 30% 80%, rgba(255,255,255,0.5), transparent 60%),
                radial-gradient(1px 1px at 90% 50%, rgba(255,255,255,0.55), transparent 55%),
                radial-gradient(180px 120px at 60% 55%, rgba(58,96,180,0.18), transparent 70%),
                radial-gradient(140px 100px at 30% 45%, rgba(160,98,180,0.14), transparent 70%)
              `,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '100% 100%'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLoadingClip && (
          <motion.div
            key={loadingClipSrc}
            className="absolute inset-0 z-40 bg-black"
            initial={{ opacity: 0, scale: 0.992 }}
            animate={{
              opacity: isExitClip ? (loadingClipPlaying ? 1 : 0) : (loadingClipPlaying ? 1 : 0),
              scale: isExitClip ? (loadingClipPlaying ? 1 : 0.994) : (loadingClipPlaying ? 1 : 0.992)
            }}
            exit={{ opacity: 0, scale: 1.008 }}
            transition={{ duration: isExitClip ? 0.8 : 1.8, ease: 'easeInOut' }}
          >
            <video
              ref={loadingClipRef}
              className="h-full w-full object-cover opacity-95"
              src={loadingClipSrc}
              autoPlay
              muted={!audioUnlocked}
              playsInline
              preload="auto"
              onPlay={() => setLoadingClipPlaying(true)}
              onEnded={handleLoadingClipEnded}
              onError={handleLoadingClipEnded}
              style={{
                transform: loadingClipSrc.includes('breach_intro') || loadingClipSrc.includes('Stargate_Clockwork') ? 'scale(1.16)' : 'scale(1.12)',
                objectPosition: 'center 60%'
              }}
            />
            {!isExitClip && (
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70 pointer-events-none" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReceiverPortal;

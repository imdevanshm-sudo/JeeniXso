// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { KeyRound, Shield } from 'lucide-react';

import { ReceiverPortal } from './components/ReceiverPortal';
import { VaultGallery } from './components/VaultGallery';
import { MemoryLog } from './types';

interface ImportOverlayProps {
  isScanning: boolean;
  onImport: () => void;
  onContinue: () => void;
  onInteract: () => void;
}

const ImportOverlay: React.FC<ImportOverlayProps> = ({ isScanning, onImport, onContinue, onInteract }) => (
  <motion.div
    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black text-white"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onInteract}
  >
    <motion.div
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      className="mb-16 flex h-32 w-32 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur"
    >
      <KeyRound className="h-16 w-16 text-white/70" />
    </motion.div>

    <div className="flex w-full max-w-md flex-col gap-4 px-6">
      <button
        onClick={(e) => { e.stopPropagation(); onImport(); }}
        disabled={isScanning}
        className="flex items-center justify-center gap-3 rounded-md border border-white/30 bg-white/10 py-4 font-semibold tracking-[0.35em] uppercase transition hover:bg-white/20 disabled:cursor-wait"
      >
        <Shield className="h-5 w-5" />
        {isScanning ? 'SCANNING KEY…' : 'IMPORT REALITY KEY'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onContinue(); }}
        className="rounded-md border border-white/15 bg-white/5 py-4 font-semibold tracking-[0.35em] uppercase text-white/70 transition hover:bg-white/10"
      >
        CONTINUE TO VAULT
      </button>
    </div>
  </motion.div>
);

const App: React.FC = () => {
  const [showImport, setShowImport] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [activeMemory, setActiveMemory] = useState<MemoryLog | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(true);
  const [portalVideoSrc, setPortalVideoSrc] = useState('/media/portal_loop.mp4');
  const [vaultVideoSrc, setVaultVideoSrc] = useState('/media/vault_loop.mp4');
  const [mediaReady, setMediaReady] = useState(false);
  const [lowPowerMode, setLowPowerMode] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const introAudioRef = useRef<HTMLAudioElement>(null);
  const [introAudioSrc, setIntroAudioSrc] = useState('/media/Music_fx_epic_worldcinematic_fusion_with_glo.wav');

  const handleIntroAudioEnded = () => {
    // Switch to the 'guest mode' audio (exso_audio.wav) when intro finishes
    // Ensure it plays once (no loop is set on the element by default unless specified)
    setIntroAudioSrc('/media/exso_audio.wav');
  };

  useEffect(() => {
    // Attempt auto-play on mount
    const tryAutoPlay = async () => {
        try {
            if (introAudioRef.current) {
                // We must respect the audioUnlocked state for muting
                introAudioRef.current.muted = !audioUnlocked;
                await introAudioRef.current.play();
                // If play succeeds, ensure state reflects unlocked if it wasn't
                if (!audioUnlocked) setAudioUnlocked(true);
            }
        } catch (e) {
            console.log("Autoplay blocked, waiting for interaction");
            // Don't force lock here, just let it stay in default state
        }
    };
    if (showImport) {
        // Add a small delay to ensure DOM is ready
        setTimeout(tryAutoPlay, 100);
    }
  }, [showImport]);

  useEffect(() => {
    const detectLowPowerMode = () => {
      if (typeof navigator === 'undefined') return false;
      const cores = navigator.hardwareConcurrency ?? 8;
      const memory = (navigator as any).deviceMemory ?? 8;
      const connection = (navigator as any).connection;
      const saveData = connection?.saveData;
      const effectiveType = connection?.effectiveType;
      const slowConnection = effectiveType === '2g' || effectiveType === 'slow-2g';
      return cores <= 4 || memory <= 4 || saveData || slowConnection;
    };

    setLowPowerMode(detectLowPowerMode());

    const handleConnectionChange = () => setLowPowerMode(detectLowPowerMode());
    const connection = (navigator as any).connection;
    connection?.addEventListener?.('change', handleConnectionChange);

    return () => {
      connection?.removeEventListener?.('change', handleConnectionChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    const prefetchAsset = async (path: string, setter: (url: string) => void) => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (!response.ok) {
          throw new Error(`Failed to fetch ${path}`);
        }
        const bytes = await response.arrayBuffer();
        if (cancelled) return;
        const blob = new Blob([bytes], { type: response.headers.get('content-type') || undefined });
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.push(objectUrl);
        setter(objectUrl);
      } catch (error) {
        console.warn('[prefetch] fallback to original asset', error);
        if (!cancelled) setter(path);
      }
    };

    Promise.all([
      prefetchAsset('/media/portal_loop.mp4', setPortalVideoSrc),
      prefetchAsset('/media/vault_loop.mp4', setVaultVideoSrc)
    ])
      .catch((error) => console.warn('[prefetch] error', error))
      .finally(() => {
        if (!cancelled) setMediaReady(true);
      });

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const handleMemorySelect = (memory: MemoryLog) => {
    setActiveMemory(memory);
  };

  const handleOpenVault = () => {
    setIsVaultOpen(true);
  };

  const handleCloseVault = (reason?: 'back' | 'selected') => {
    setIsVaultOpen(false);
    if (reason === 'back') {
      setActiveMemory(null);
    }
  };

  const handleImportKey = () => {
    if (isScanning) return;
    setIsScanning(true);
    // Ensure audio is unlocked/playing if not already
    setAudioUnlocked(true);
    if (introAudioRef.current) {
        introAudioRef.current.muted = false;
        introAudioRef.current.play().catch(() => {});
    }
    
    setTimeout(() => {
      setIsScanning(false);
      setAccessGranted(true);
      setShowImport(false);
    }, 2000);
  };

  const handleContinueGuest = () => {
    setAccessGranted(false);
    setShowImport(false);
    setAudioUnlocked(true);
    if (introAudioRef.current) {
        introAudioRef.current.muted = false;
        introAudioRef.current.play().catch(() => {});
    }
  };
  
  const handleInteract = () => {
    if (!audioUnlocked) {
        setAudioUnlocked(true);
        if (introAudioRef.current) {
            introAudioRef.current.muted = false;
            introAudioRef.current.play().catch(() => {});
        }
    }
  };

  const handleResetToImport = () => {
    setShowImport(true);
    setAccessGranted(false);
    setActiveMemory(null);
    setIsVaultOpen(false);
    setIntroAudioSrc('/media/Music_fx_epic_worldcinematic_fusion_with_glo.wav');
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black font-display text-white">
      <div className="fixed inset-0 bg-black" />
      
      {/* Intro/Import Audio Layer: Only plays while Import Overlay is visible */}
      {showImport && (
        <audio 
          ref={introAudioRef}
          key={introAudioSrc}
          src={introAudioSrc}
          playsInline
          autoPlay
          muted={!audioUnlocked}
          onEnded={handleIntroAudioEnded}
        />
      )}

      <AnimatePresence>
        {showImport && (
          <ImportOverlay
            key="import-overlay"
            isScanning={isScanning}
            onImport={handleImportKey}
            onContinue={handleContinueGuest}
            onInteract={handleInteract}
          />
        )}
      </AnimatePresence>

      {!showImport && (
        <div className="absolute inset-0 z-10">
          <ReceiverPortal
            onInitiate={handleOpenVault}
            activeMemory={activeMemory}
            onAudioUnlock={() => setAudioUnlocked(true)}
            audioUnlocked={audioUnlocked}
            portalVideoSrc={portalVideoSrc}
            lowPowerMode={lowPowerMode}
            mediaReady={mediaReady}
            onRequestVault={handleOpenVault}
            isVaultOpen={isVaultOpen}
            accessGranted={accessGranted}
            onResetToImport={handleResetToImport}
          />
        </div>
      )}

      <AnimatePresence>
        {isVaultOpen && (
          <motion.div
            key="vault"
            className="absolute inset-0 z-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <VaultGallery
              onBack={handleCloseVault}
              onMemorySelect={handleMemorySelect}
              audioUnlocked={audioUnlocked}
              videoSrc={vaultVideoSrc}
              lowPowerMode={lowPowerMode}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;

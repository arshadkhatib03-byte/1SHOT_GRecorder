export interface Translations {
  nav: {
    studio: string;
    presets: string;
    clips: string;
    smoothness: string;
    startCapture: string;
    stopCapture: string;
  };
  hero: {
    title: string;
    subtitle: string;
    selectScreenBtn: string;
    startingIn: string;
    cancel: string;
    ecoBannerTitle: string;
    ecoBannerBody: string;
    showPreview: string;
    hidePreview: string;
    pause: string;
    resume: string;
    stopSave: string;
    muteMic: string;
    unmuteMic: string;
    recordingBadge: string;
    pausedBadge: string;
    unsupportedTitle: string;
    unsupportedBody: string;
    recordMicOnlyFallback: string;
  };
  presets: {
    sectionTitle: string;
    sectionDesc: string;
    zeroLagGaming: string;
    zeroLagGamingDesc: string;
    ultraQuality: string;
    ultraQualityDesc: string;
    batterySaver: string;
    batterySaverDesc: string;
    custom: string;
    customDesc: string;
    resolutionLabel: string;
    fpsLabel: string;
    bitrateLabel: string;
    codecLabel: string;
    countdownLabel: string;
    ecoPreviewLabel: string;
    ecoPreviewHint: string;
    autoSaveLabel: string;
    autoSaveHint: string;
    safeCanvasLabel: string;
    safeCanvasHint: string;
    chooseFolderBtn: string;
    folderReadyLabel: string;
  };
  audio: {
    sectionTitle: string;
    sectionDesc: string;
    micLabel: string;
    micOn: string;
    micOff: string;
    testMicBtn: string;
    stopTestBtn: string;
    systemAudioLabel: string;
    systemAudioHint: string;
    micGain: string;
    systemGain: string;
    noiseSuppression: string;
    echoCancellation: string;
    autoGain: string;
    micActivePrompt: string;
  };
  smoothness: {
    sectionTitle: string;
    sectionDesc: string;
    runBenchmarkBtn: string;
    measuring: string;
    refreshRate: string;
    frameTime: string;
    jitter: string;
    codecMatrixTitle: string;
    supported: string;
    notSupported: string;
    recommended: string;
    zeroLagTipsTitle: string;
    tip1Title: string;
    tip1Desc: string;
    tip2Title: string;
    tip2Desc: string;
    tip3Title: string;
    tip3Desc: string;
  };
  clips: {
    sectionTitle: string;
    searchPlaceholder: string;
    filterAll: string;
    filterMic: string;
    filterHighFps: string;
    emptyTitle: string;
    emptyDesc: string;
    emptyCta: string;
    download: string;
    delete: string;
    rename: string;
    saveName: string;
    micIncluded: string;
    screenOnly: string;
    closePlayer: string;
    shareSave: string;
  };
}

export const EN_COPY: Translations = {
  nav: {
    studio: 'Studio',
    presets: 'Presets',
    clips: 'Clips',
    smoothness: 'Smoothness',
    startCapture: 'Start Capture',
    stopCapture: 'Stop Capture',
  },
  hero: {
    title: 'Zero-Lag High-Quality Screen & Mic Capture',
    subtitle:
      'Record games, apps, and voiceovers at 60 FPS with hardware codec selection and automatic preview offload so your device stays fast and responsive.',
    selectScreenBtn: 'Start Screen & Mic Recording',
    startingIn: 'Starting capture in',
    cancel: 'Cancel',
    ecoBannerTitle: 'Game Mode Active — Preview Offloaded',
    ecoBannerBody:
      'Live video preview is paused inside this tab to save GPU and CPU cycles for your game. Your screen and mic are still recording at full quality.',
    showPreview: 'Show Live Preview',
    hidePreview: 'Offload Preview (Zero-Lag)',
    pause: 'Pause',
    resume: 'Resume',
    stopSave: 'Stop & Save',
    muteMic: 'Mute Mic',
    unmuteMic: 'Unmute Mic',
    recordingBadge: 'REC',
    pausedBadge: 'PAUSED',
    unsupportedTitle: 'Screen capture API unavailable in this browser view',
    unsupportedBody:
      'Mobile in-app browsers and iOS Safari restrict tab/screen sharing via getDisplayMedia. Open this page in Desktop Chrome/Edge or Android Chrome (Desktop site / screen share supported) for full screen capture, or test microphone-only capture below.',
    recordMicOnlyFallback: 'Record Voice / Mic Only',
  },
  presets: {
    sectionTitle: 'Capture Profile & Zero-Lag Engine',
    sectionDesc: 'Pick a tuned performance profile or customize resolution, frame rate, and hardware codec.',
    zeroLagGaming: 'Game Mode (Zero-Lag)',
    zeroLagGamingDesc: 'Native res · 60 FPS · Unlimited duration · Hardware-friendly codec',
    ultraQuality: 'Ultra HD Quality',
    ultraQualityDesc: 'Native res · 60 FPS · 16 Mbps bitrate · Crisp detail',
    batterySaver: 'Cool & Battery Safe',
    batterySaverDesc: '720p · 30 FPS · 5 Mbps · Minimal heat & RAM use',
    custom: 'Custom',
    customDesc: 'Manual control over bitrate, FPS, and encoder',
    resolutionLabel: 'Resolution',
    fpsLabel: 'Frame Rate',
    bitrateLabel: 'Video Bitrate',
    codecLabel: 'Encoder Codec',
    countdownLabel: 'Start Countdown',
    ecoPreviewLabel: 'Zero-Lag Preview Offload',
    ecoPreviewHint: 'Hides the live mirror while recording so games get maximum GPU/CPU priority.',
    autoSaveLabel: 'Auto-Save to Device Storage',
    autoSaveHint: 'Automatically downloads each finished recording to your phone or PC Downloads folder.',
    safeCanvasLabel: 'Anti-Black-Screen Safe Mode',
    safeCanvasHint: 'Routes screen frames through a 2D canvas pipeline if your GPU records black video in direct mode.',
    chooseFolderBtn: 'Choose Save Folder',
    folderReadyLabel: 'Saving directly to folder:',
  },
  audio: {
    sectionTitle: 'Dual Audio Mixer',
    sectionDesc: 'Blend your microphone voiceover with game or system audio in real time.',
    micLabel: 'Microphone',
    micOn: 'Enabled',
    micOff: 'Muted',
    testMicBtn: 'Test Mic Level',
    stopTestBtn: 'Stop Test',
    systemAudioLabel: 'Game / System Audio',
    systemAudioHint: 'Make sure to check "Share tab/system audio" in the browser screen picker.',
    micGain: 'Mic Volume',
    systemGain: 'Game Audio Volume',
    noiseSuppression: 'Noise Suppression',
    echoCancellation: 'Echo Cancellation',
    autoGain: 'Auto Gain Control',
    micActivePrompt: 'Live mic level active',
  },
  smoothness: {
    sectionTitle: 'Device Smoothness & Codec Probe',
    sectionDesc: 'Measure real browser frame pacing and verify hardware-accelerated encoders before launching a game.',
    runBenchmarkBtn: 'Run 2s Smoothness Check',
    measuring: 'Sampling frames...',
    refreshRate: 'Display Refresh',
    frameTime: 'Avg Frame Time',
    jitter: 'Frame Jitter',
    codecMatrixTitle: 'Detected Hardware & Software Codecs',
    supported: 'Supported',
    notSupported: 'Unavailable',
    recommended: 'Recommended',
    zeroLagTipsTitle: 'Why Recording Stays Smooth',
    tip1Title: '2-Second Chunked Flushing',
    tip1Desc: 'Encoded packets flush incrementally every 2 seconds instead of building massive memory spikes that cause game stutters.',
    tip2Title: 'Playback Latency Audio Graph',
    tip2Desc: 'Web Audio runs with playback latencyHint to prevent audio crackling and reduce CPU wakeups during heavy gameplay.',
    tip3Title: 'Zero-Blit Preview Offload',
    tip3Desc: 'Turning off the live preview mirror stops redundant 60 FPS GPU frame copies while recording in the background.',
  },
  clips: {
    sectionTitle: 'Recorded Clips Library',
    searchPlaceholder: 'Search recordings by name...',
    filterAll: 'All Clips',
    filterMic: 'With Mic',
    filterHighFps: '60+ FPS',
    emptyTitle: 'No recordings saved yet',
    emptyDesc: 'Your high-quality recordings are saved privately in your browser storage and appear here ready for playback or download.',
    emptyCta: 'Start First Recording',
    download: 'Download',
    delete: 'Delete',
    rename: 'Rename',
    saveName: 'Save',
    micIncluded: 'Mic + Screen',
    screenOnly: 'Screen Only',
    closePlayer: 'Close Player',
    shareSave: 'Save / Share',
  },
};

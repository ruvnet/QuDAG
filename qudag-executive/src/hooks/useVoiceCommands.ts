/**
 * @description Voice Commands Hook - Speech recognition for CEO interface
 * @author Claude Code
 * @created 2025-06-23
 * @lastModified 2025-06-23 - Revolutionary voice-first business interface
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { VoiceState } from '../types';

interface UseVoiceCommandsOptions {
  onCommand: (transcript: string) => void;
  onNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  enabled?: boolean;
  language?: string;
  wakeWord?: string;
  continuous?: boolean;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Global speech recognition interface (for TypeScript)
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  
  start(): void;
  stop(): void;
  abort(): void;
  
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new(): SpeechRecognition;
};

export function useVoiceCommands({
  onCommand,
  onNotification,
  enabled = true,
  language = 'en-US',
  wakeWord = 'hey qudag',
  continuous = false
}: UseVoiceCommandsOptions) {
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    confidence: 0
  });

  const [isSupported, setIsSupported] = useState(false);
  const [isWakeWordMode, setIsWakeWordMode] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeWordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCommandTimeRef = useRef<number>(0);

  // Check browser support
  useEffect(() => {
    const hasSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setIsSupported(hasSupport);
    
    if (!hasSupport && enabled) {
      onNotification('Voice commands not supported in this browser. Try Chrome or Edge.', 'warning');
    }
  }, [enabled, onNotification]);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported || !enabled) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    // Configure recognition
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 3;

    // Event handlers
    recognition.onstart = () => {
      setVoiceState(prev => ({
        ...prev,
        isListening: true,
        error: undefined
      }));
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';
      let maxConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          finalTranscript += transcript;
          maxConfidence = Math.max(maxConfidence, confidence);
        } else {
          interimTranscript += transcript;
        }
      }

      // Update state with interim results
      setVoiceState(prev => ({
        ...prev,
        transcript: finalTranscript || interimTranscript,
        confidence: maxConfidence || 0.8
      }));

      // Process final transcript
      if (finalTranscript) {
        processFinalTranscript(finalTranscript.trim(), maxConfidence);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      
      let errorMessage = 'Voice recognition error. ';
      switch (event.error) {
        case 'no-speech':
          errorMessage += 'No speech detected. Try speaking louder.';
          break;
        case 'audio-capture':
          errorMessage += 'Microphone not found or permission denied.';
          break;
        case 'not-allowed':
          errorMessage += 'Microphone access denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage += 'Network error. Check your internet connection.';
          break;
        case 'aborted':
          // Don't show error for user-initiated stops
          return;
        default:
          errorMessage += 'Please try again.';
      }

      setVoiceState(prev => ({
        ...prev,
        isListening: false,
        error: event.error
      }));

      onNotification(errorMessage, 'error');
    };

    recognition.onend = () => {
      setVoiceState(prev => ({
        ...prev,
        isListening: false,
        isProcessing: false
      }));

      // Restart if in wake word mode
      if (isWakeWordMode && enabled) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (error) {
            console.warn('Failed to restart voice recognition:', error);
          }
        }, 1000);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, enabled, language, continuous, isWakeWordMode, onNotification]);

  // Process final transcript from speech recognition
  const processFinalTranscript = useCallback((transcript: string, confidence: number) => {
    const now = Date.now();
    
    // Prevent duplicate commands (within 2 seconds)
    if (now - lastCommandTimeRef.current < 2000) {
      return;
    }
    
    lastCommandTimeRef.current = now;

    const normalizedTranscript = transcript.toLowerCase().trim();

    // Check for wake word
    if (isWakeWordMode) {
      if (normalizedTranscript.includes(wakeWord.toLowerCase())) {
        onNotification('🎤 I\'m listening...', 'info');
        setIsWakeWordMode(false);
        
        // Extract command after wake word
        const wakeWordIndex = normalizedTranscript.indexOf(wakeWord.toLowerCase());
        const commandPart = transcript.substring(wakeWordIndex + wakeWord.length).trim();
        
        if (commandPart) {
          processCommand(commandPart, confidence);
        } else {
          // Wait for follow-up command
          setWakeWordTimeout();
        }
        return;
      }
      return; // Ignore other speech in wake word mode
    }

    // Process command directly
    processCommand(transcript, confidence);
  }, [isWakeWordMode, wakeWord, onNotification]);

  // Process the actual command
  const processCommand = useCallback((command: string, confidence: number) => {
    if (command.length < 3) {
      onNotification('Command too short. Please try again.', 'warning');
      return;
    }

    if (confidence < 0.3) {
      onNotification('I didn\'t catch that clearly. Please repeat your command.', 'warning');
      return;
    }

    setVoiceState(prev => ({
      ...prev,
      isProcessing: true
    }));

    // Execute the command
    onCommand(command);

    // Reset state after processing
    setTimeout(() => {
      setVoiceState(prev => ({
        ...prev,
        isProcessing: false,
        transcript: ''
      }));
    }, 1000);

  }, [onCommand, onNotification]);

  // Set timeout for wake word mode
  const setWakeWordTimeout = useCallback(() => {
    if (wakeWordTimeoutRef.current) {
      clearTimeout(wakeWordTimeoutRef.current);
    }

    wakeWordTimeoutRef.current = setTimeout(() => {
      setIsWakeWordMode(true);
      onNotification('🔇 Wake word mode. Say "Hey QuDAG" to activate.', 'info');
    }, 10000); // 10 seconds timeout
  }, [onNotification]);

  // Start listening
  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isSupported || !enabled) {
      onNotification('Voice recognition not available', 'error');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      onNotification('Failed to start voice recognition. Please try again.', 'error');
    }
  }, [isSupported, enabled, onNotification]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setIsWakeWordMode(false);
    
    if (wakeWordTimeoutRef.current) {
      clearTimeout(wakeWordTimeoutRef.current);
      wakeWordTimeoutRef.current = null;
    }
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (voiceState.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceState.isListening, startListening, stopListening]);

  // Enable wake word mode
  const enableWakeWordMode = useCallback(() => {
    if (!isSupported || !enabled) {
      onNotification('Wake word mode not supported', 'warning');
      return;
    }

    setIsWakeWordMode(true);
    onNotification(`🎤 Wake word mode enabled. Say "${wakeWord}" to activate.`, 'info');
    startListening();
  }, [isSupported, enabled, wakeWord, startListening, onNotification]);

  // Disable wake word mode
  const disableWakeWordMode = useCallback(() => {
    setIsWakeWordMode(false);
    stopListening();
    onNotification('Wake word mode disabled', 'info');
  }, [stopListening, onNotification]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (wakeWordTimeoutRef.current) {
        clearTimeout(wakeWordTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    voiceState,
    isSupported,
    isWakeWordMode,
    enabled,

    // Actions
    startListening,
    stopListening,
    toggleListening,
    enableWakeWordMode,
    disableWakeWordMode,

    // Utilities
    hasPermission: isSupported,
    canUseVoice: isSupported && enabled
  };
}
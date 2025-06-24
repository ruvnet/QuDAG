/**
 * @description Revolutionary CEO Command Bar - The centerpiece of AI-CEO interface
 * @author Claude Code
 * @created 2025-06-23
 * @lastModified 2025-06-23 - Initial implementation of natural language command system
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Search,
  Sparkles,
  ArrowRight,
  Clock,
  Zap,
  Users,
  TrendingUp,
  Command,
  Send
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { CEOCommand, CommandSuggestion, VoiceState } from '../types';

interface CEOCommandBarProps {
  theme: 'light' | 'dark';
  onCommand: (command: string) => Promise<void>;
  onNotification: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  isExecuting?: boolean;
}

const COMMAND_EXAMPLES = [
  "Hire 5 sales agents for Q1 expansion",
  "Show me this month's performance metrics", 
  "Optimize costs for the marketing department",
  "Generate board meeting report",
  "Scale customer service team by 50%",
  "Analyze top performing agents",
  "Deploy new product launch campaign",
  "What's the ROI on our AI workforce?"
];

const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  {
    text: "Hire agents",
    description: "Deploy new AI agents to your workforce",
    category: "hiring",
    examples: ["Hire 3 sales agents", "Add customer service specialist", "Deploy marketing team"]
  },
  {
    text: "Show metrics", 
    description: "View performance and business analytics",
    category: "analytics",
    examples: ["Show revenue metrics", "Display agent performance", "View cost analysis"]
  },
  {
    text: "Optimize operations",
    description: "Improve efficiency and reduce costs", 
    category: "optimization",
    examples: ["Optimize marketing spend", "Reduce operational costs", "Improve efficiency"]
  },
  {
    text: "Scale business",
    description: "Expand operations and workforce",
    category: "operations", 
    examples: ["Scale to 100 agents", "Expand to new markets", "Double production capacity"]
  }
];

export function CEOCommandBar({ theme, onCommand, onNotification, isExecuting = false }: CEOCommandBarProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentCommands, setRecentCommands] = useState<string[]>([]);
  const [voiceState, setVoiceState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    transcript: '',
    confidence: 0
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Rotating examples effect
  useEffect(() => {
    const interval = setInterval(() => {
      setExampleIndex((prev) => (prev + 1) % COMMAND_EXAMPLES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      const recognition = recognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setVoiceState(prev => ({ ...prev, isListening: true, error: undefined }));
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        
        const confidence = event.results[0]?.[0]?.confidence || 0;
        
        setVoiceState(prev => ({
          ...prev,
          transcript,
          confidence
        }));

        if (event.results[0]?.isFinal) {
          setInput(transcript);
          setVoiceState(prev => ({ ...prev, isListening: false }));
        }
      };

      recognition.onerror = (event) => {
        setVoiceState(prev => ({
          ...prev,
          isListening: false,
          error: event.error
        }));
        onNotification('Voice recognition error. Please try again.', 'error');
      };

      recognition.onend = () => {
        setVoiceState(prev => ({ ...prev, isListening: false }));
      };
    }
  }, [onNotification]);

  const handleVoiceToggle = useCallback(() => {
    if (!recognitionRef.current) {
      onNotification('Voice recognition not supported in this browser', 'warning');
      return;
    }

    if (voiceState.isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [voiceState.isListening, onNotification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const command = input.trim();
    
    // Add to recent commands
    setRecentCommands(prev => [command, ...prev.slice(0, 4)]);
    
    try {
      await onCommand(command);
      setInput('');
      setIsFocused(false);
    } catch (error) {
      onNotification('Failed to execute command. Please try again.', 'error');
    }
  };

  const handleSuggestionClick = (suggestion: CommandSuggestion) => {
    setInput(suggestion.text);
    inputRef.current?.focus();
    setShowSuggestions(false);
  };

  const filteredSuggestions = COMMAND_SUGGESTIONS.filter(suggestion =>
    suggestion.text.toLowerCase().includes(input.toLowerCase()) ||
    suggestion.examples.some(example => 
      example.toLowerCase().includes(input.toLowerCase())
    )
  );

  return (
    <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative rounded-2xl border backdrop-blur-xl transition-all duration-300',
          theme === 'dark'
            ? 'bg-gray-900/80 border-gray-700/50 shadow-2xl shadow-purple-500/10'
            : 'bg-white/80 border-gray-200/50 shadow-2xl shadow-blue-500/10',
          isFocused && 'scale-105 ring-2 ring-purple-500/30'
        )}
      >
        {/* Main Command Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-3 p-4">
            {/* AI Sparkle Icon */}
            <motion.div
              animate={{ rotate: isExecuting ? 360 : 0 }}
              transition={{ duration: 2, repeat: isExecuting ? Infinity : 0, ease: "linear" }}
              className="flex-shrink-0"
            >
              <Sparkles className={cn(
                "w-6 h-6",
                isExecuting ? "text-purple-500" : theme === 'dark' ? "text-purple-400" : "text-purple-600"
              )} />
            </motion.div>

            {/* Input Field */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  setIsFocused(true);
                  setShowSuggestions(true);
                }}
                onBlur={() => {
                  // Delay to allow suggestion clicks
                  setTimeout(() => {
                    setIsFocused(false);
                    setShowSuggestions(false);
                  }, 200);
                }}
                disabled={isExecuting}
                placeholder={isExecuting ? "Executing your command..." : COMMAND_EXAMPLES[exampleIndex]}
                className={cn(
                  "w-full bg-transparent border-none outline-none text-lg font-medium placeholder-transition",
                  theme === 'dark' 
                    ? "text-white placeholder-gray-400" 
                    : "text-gray-900 placeholder-gray-500",
                  isExecuting && "cursor-not-allowed opacity-60"
                )}
              />
              
              {/* Animated placeholder */}
              <AnimatePresence mode="wait">
                {!input && !isFocused && (
                  <motion.div
                    key={exampleIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 pointer-events-none flex items-center"
                  >
                    <span className={cn(
                      "text-lg font-medium",
                      theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {COMMAND_EXAMPLES[exampleIndex]}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Voice Button */}
            <motion.button
              type="button"
              onClick={handleVoiceToggle}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isExecuting}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                voiceState.isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : theme === 'dark'
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                isExecuting && "cursor-not-allowed opacity-50"
              )}
            >
              {voiceState.isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </motion.button>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={!input.trim() || isExecuting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-2 rounded-full transition-all duration-200",
                input.trim() && !isExecuting
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : theme === 'dark'
                    ? "bg-gray-700 text-gray-500"
                    : "bg-gray-100 text-gray-400",
                "disabled:cursor-not-allowed"
              )}
            >
              {isExecuting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Zap className="w-5 h-5" />
                </motion.div>
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          </div>

          {/* Voice Transcript Display */}
          <AnimatePresence>
            {voiceState.isListening && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={cn(
                  "px-4 pb-3 border-t",
                  theme === 'dark' ? "border-gray-700" : "border-gray-200"
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className={cn(
                      "font-medium",
                      theme === 'dark' ? "text-red-400" : "text-red-600"
                    )}>
                      Listening...
                    </span>
                  </div>
                  {voiceState.transcript && (
                    <span className={cn(
                      "italic",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      "{voiceState.transcript}"
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>

        {/* Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && (isFocused || input) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "absolute top-full left-0 right-0 mt-2 rounded-xl border backdrop-blur-xl shadow-xl z-10",
                theme === 'dark' 
                  ? "bg-gray-900/90 border-gray-700/50" 
                  : "bg-white/90 border-gray-200/50"
              )}
            >
              <div className="p-3">
                {input ? (
                  <div>
                    <h4 className={cn(
                      "text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Suggestions
                    </h4>
                    <div className="space-y-1">
                      {filteredSuggestions.slice(0, 4).map((suggestion, index) => (
                        <motion.button
                          key={suggestion.text}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className={cn(
                            "w-full text-left p-2 rounded-lg transition-colors",
                            theme === 'dark' 
                              ? "hover:bg-gray-700/50 text-gray-200" 
                              : "hover:bg-gray-100/50 text-gray-800"
                          )}
                        >
                          <div className="font-medium">{suggestion.text}</div>
                          <div className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            {suggestion.description}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className={cn(
                      "text-sm font-medium mb-2",
                      theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      Try these commands
                    </h4>
                    <div className="grid grid-cols-2 gap-1">
                      {COMMAND_SUGGESTIONS.map((suggestion, index) => (
                        <motion.button
                          key={suggestion.text}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className={cn(
                            "text-left p-2 rounded-lg transition-all duration-200",
                            theme === 'dark' 
                              ? "hover:bg-gray-700/50 text-gray-200" 
                              : "hover:bg-gray-100/50 text-gray-800"
                          )}
                        >
                          <div className="font-medium text-sm">{suggestion.text}</div>
                          <div className={cn(
                            "text-xs",
                            theme === 'dark' ? "text-gray-400" : "text-gray-500"
                          )}>
                            {suggestion.description}
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Keyboard Shortcut Hint */}
              <div className={cn(
                "px-3 py-2 border-t text-xs flex items-center justify-between",
                theme === 'dark' 
                  ? "border-gray-700 text-gray-400 bg-gray-800/50" 
                  : "border-gray-200 text-gray-500 bg-gray-50/50"
              )}>
                <span>Pro tip: Press Cmd+K to quick access</span>
                <div className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>+</span>
                  <span className="font-mono">K</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
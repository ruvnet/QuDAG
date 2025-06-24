/**
 * @description Revolutionary CEO Command Bar - The centerpiece of AI-CEO interface
 * @author Claude Code
 * @created 2025-06-23
 * @lastModified 2025-06-23 - Initial implementation of natural language command system
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Sparkles, ArrowRight, Zap, Command } from "lucide-react";
import { cn } from "../lib/utils";
import type { CommandSuggestion, VoiceState } from "../types";

interface CEOCommandBarProps {
  theme: "light" | "dark";
  onCommand: (command: string) => Promise<void>;
  onNotification: (
    message: string,
    type: "info" | "success" | "warning" | "error"
  ) => void;
  isExecuting?: boolean;
}

const COMMAND_SUGGESTIONS: CommandSuggestion[] = [
  {
    text: "Hire agents",
    description: "Deploy new AI agents to your workforce",
    category: "hiring",
    examples: [
      "Hire 3 sales agents",
      "Add customer service specialist",
      "Deploy marketing team",
    ],
  },
  {
    text: "Show metrics",
    description: "View performance and business analytics",
    category: "analytics",
    examples: [
      "Show revenue metrics",
      "Display agent performance",
      "View cost analysis",
    ],
  },
  {
    text: "Optimize operations",
    description: "Improve efficiency and reduce costs",
    category: "optimization",
    examples: [
      "Optimize marketing spend",
      "Reduce operational costs",
      "Improve efficiency",
    ],
  },
  {
    text: "Scale business",
    description: "Expand operations and workforce",
    category: "operations",
    examples: [
      "Scale to 100 agents",
      "Expand to new markets",
      "Double production capacity",
    ],
  },
];

export function CEOCommandBar({
  theme,
  onCommand,
  onNotification,
  isExecuting = false,
}: CEOCommandBarProps) {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [voiceState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    transcript: "",
    confidence: 0,
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Voice functionality placeholders
  const handleVoiceToggle = useCallback(() => {
    // Voice functionality would be implemented here
    onNotification("Voice functionality coming soon!", "info");
  }, [onNotification]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;

    const command = input.trim();

    try {
      await onCommand(command);
      setInput("");
      setIsFocused(false);
    } catch {
      onNotification("Failed to execute command. Please try again.", "error");
    }
  };

  const handleSuggestionClick = (suggestion: CommandSuggestion) => {
    setInput(suggestion.text);
    inputRef.current?.focus();
    setShowSuggestions(false);
  };

  const filteredSuggestions = COMMAND_SUGGESTIONS.filter(
    (suggestion) =>
      suggestion.text.toLowerCase().includes(input.toLowerCase()) ||
      suggestion.examples.some((example) =>
        example.toLowerCase().includes(input.toLowerCase())
      )
  );

  return (
    <div className="relative w-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          "relative rounded-lg border transition-all duration-300",
          theme === "dark" ?
            "bg-gray-700/50 border-gray-600/50"
          : "bg-gray-50/50 border-gray-300/50",
          isFocused && "ring-2 ring-purple-500/30"
        )}
      >
        {/* Main Command Input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-2 p-2">
            {/* AI Sparkle Icon */}
            <motion.div
              animate={{ rotate: isExecuting ? 360 : 0 }}
              transition={{
                duration: 2,
                repeat: isExecuting ? Infinity : 0,
                ease: "linear",
              }}
              className="flex-shrink-0"
            >
              <Sparkles
                className={cn(
                  "w-4 h-4",
                  isExecuting ? "text-purple-500"
                  : theme === "dark" ? "text-purple-400"
                  : "text-purple-600"
                )}
              />
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
                placeholder={
                  isExecuting ? "Executing..." : "Ask your AI CEO anything..."
                }
                className={cn(
                  "w-full bg-transparent border-none outline-none text-sm font-medium placeholder-transition",
                  theme === "dark" ?
                    "text-white placeholder-gray-400"
                  : "text-gray-900 placeholder-gray-500",
                  isExecuting && "cursor-not-allowed opacity-60"
                )}
              />
            </div>

            {/* Voice Button */}
            <motion.button
              type="button"
              onClick={handleVoiceToggle}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isExecuting}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                voiceState.isListening ? "bg-red-500 text-white animate-pulse"
                : theme === "dark" ?
                  "bg-gray-600 text-gray-300 hover:bg-gray-500"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300",
                isExecuting && "cursor-not-allowed opacity-50"
              )}
            >
              {voiceState.isListening ?
                <MicOff className="w-3 h-3" />
              : <Mic className="w-3 h-3" />}
            </motion.button>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={!input.trim() || isExecuting}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                input.trim() && !isExecuting ?
                  "bg-purple-600 text-white hover:bg-purple-700"
                : theme === "dark" ? "bg-gray-600 text-gray-500"
                : "bg-gray-200 text-gray-400",
                "disabled:cursor-not-allowed"
              )}
            >
              {isExecuting ?
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Zap className="w-3 h-3" />
                </motion.div>
              : <ArrowRight className="w-3 h-3" />}
            </motion.button>
          </div>
        </form>

        {/* Compact Suggestions Dropdown */}
        <AnimatePresence>
          {showSuggestions && (isFocused || input) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={cn(
                "absolute top-full left-0 right-0 mt-2 rounded-lg border backdrop-blur-xl shadow-xl z-50",
                theme === "dark" ?
                  "bg-gray-800/95 border-gray-700/50"
                : "bg-white/95 border-gray-200/50"
              )}
            >
              <div className="p-3 max-h-64 overflow-y-auto">
                {input ?
                  <div>
                    <h4
                      className={cn(
                        "text-xs font-medium mb-2",
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Suggestions
                    </h4>
                    <div className="space-y-1">
                      {filteredSuggestions
                        .slice(0, 3)
                        .map((suggestion, index) => (
                          <motion.button
                            key={suggestion.text}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={cn(
                              "w-full text-left p-2 rounded-md transition-colors text-sm",
                              theme === "dark" ?
                                "hover:bg-gray-700/50 text-gray-200"
                              : "hover:bg-gray-100/50 text-gray-800"
                            )}
                          >
                            <div className="font-medium">{suggestion.text}</div>
                            <div
                              className={cn(
                                "text-xs",
                                theme === "dark" ? "text-gray-400" : (
                                  "text-gray-500"
                                )
                              )}
                            >
                              {suggestion.description}
                            </div>
                          </motion.button>
                        ))}
                    </div>
                  </div>
                : <div>
                    <h4
                      className={cn(
                        "text-xs font-medium mb-2",
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      )}
                    >
                      Quick Commands
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                      {COMMAND_SUGGESTIONS.slice(0, 4).map(
                        (suggestion, index) => (
                          <motion.button
                            key={suggestion.text}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className={cn(
                              "text-left p-2 rounded-md transition-all duration-200 text-sm",
                              theme === "dark" ?
                                "hover:bg-gray-700/50 text-gray-200"
                              : "hover:bg-gray-100/50 text-gray-800"
                            )}
                          >
                            <div className="font-medium">{suggestion.text}</div>
                            <div
                              className={cn(
                                "text-xs",
                                theme === "dark" ? "text-gray-400" : (
                                  "text-gray-500"
                                )
                              )}
                            >
                              {suggestion.description}
                            </div>
                          </motion.button>
                        )
                      )}
                    </div>
                  </div>
                }
              </div>

              {/* Compact Keyboard Shortcut Hint */}
              <div
                className={cn(
                  "px-3 py-1.5 border-t text-xs flex items-center justify-between",
                  theme === "dark" ?
                    "border-gray-700 text-gray-400 bg-gray-800/50"
                  : "border-gray-200 text-gray-500 bg-gray-50/50"
                )}
              >
                <span>Cmd+K for quick access</span>
                <div className="flex items-center gap-1">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

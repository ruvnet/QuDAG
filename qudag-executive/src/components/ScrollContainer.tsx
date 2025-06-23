import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";

interface ScrollContainerProps {
  children: React.ReactNode;
  className?: string;
  theme?: "light" | "dark";
}

export function ScrollContainer({
  children,
  className,
  theme = "light",
}: ScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });

  const updateScrollState = () => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const canScrollUp = scrollTop > 0;
    const canScrollDown = scrollTop < scrollHeight - clientHeight - 1;

    setScrollState({ canScrollUp, canScrollDown });
  };

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    // Initial check
    updateScrollState();

    // Add scroll listener
    scrollElement.addEventListener("scroll", updateScrollState);

    // Add resize observer to handle content changes
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(scrollElement);

    return () => {
      scrollElement.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative flex-1 overflow-hidden", className)}>
      {/* Top scroll shadow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: scrollState.canScrollUp ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "absolute top-0 left-0 right-0 h-6 pointer-events-none z-10",
          "bg-gradient-to-b",
          theme === "dark" ?
            "from-gray-900 to-transparent"
          : "from-gray-50 to-transparent"
        )}
      />

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="h-full overflow-y-auto scrollbar-thin"
        style={{
          scrollbarGutter: "stable",
        }}
      >
        {children}
      </div>

      {/* Bottom scroll shadow */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: scrollState.canScrollDown ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10",
          "bg-gradient-to-t",
          theme === "dark" ?
            "from-gray-900 to-transparent"
          : "from-gray-50 to-transparent"
        )}
      />
    </div>
  );
}

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const ScrollToTop = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    setIsScrolling(true);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    // Reset scrolling state after animation completes
    setTimeout(() => {
      setIsScrolling(false);
      setIsVisible(false); // Hide briefly
      setTimeout(() => {
        if (window.scrollY > 300) setIsVisible(true);
      }, 500);
    }, 1500);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          className="fixed bottom-8 right-8 z-50 group"
        >
          {/* Ambient Glow (Subtle) */}
          <div className="absolute inset-0 rounded-full bg-[var(--color-primary)] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500" />

          <motion.button
            onClick={scrollToTop}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
            animate={
              isScrolling
                ? {
                    y: -120,
                    opacity: 0,
                    scale: 0.5,
                    transition: { duration: 0.8, ease: [0.32, 0, 0.67, 0] }, // Ease-in back
                  }
                : { y: 0, opacity: 1, scale: 1 }
            }
            className="relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg overflow-hidden border border-white/10 backdrop-blur-sm"
            style={{
              background: `linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)`,
              boxShadow: `
                0 4px 6px -1px rgba(0, 0, 0, 0.1),
                0 2px 4px -1px rgba(0, 0, 0, 0.06),
                inset 0 1px 0 rgba(255, 255, 255, 0.2)
              `,
            }}
            aria-label="Scroll to top"
          >
            {/* Shimmer Effect on Hover */}
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />

            {/* Rocket Icon Container */}
            <motion.div
              className="relative z-20 text-white"
              animate={
                isScrolling
                  ? {
                      y: -2,
                      rotate: 0, // Keep straight for launch
                    }
                  : {
                      rotate: 0,
                    }
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-md"
              >
                <path d="m12 19-9 2 9-18 9 18-9-2zm0 0v-8" />
              </svg>
            </motion.div>

            {/* Launch Exhaust Particles (Visible only when scrolling) */}
            {isScrolling && (
              <>
                <motion.div
                  className="absolute bottom-2 left-1/2 w-1 h-1 bg-white rounded-full"
                  initial={{ opacity: 1, scale: 1, y: 0 }}
                  animate={{ opacity: 0, scale: 0, y: 20 }}
                  transition={{ duration: 0.4, repeat: Infinity, delay: 0.0 }}
                />
                <motion.div
                  className="absolute bottom-2 left-1/2 w-1.5 h-1.5 bg-orange-300 rounded-full"
                  initial={{ opacity: 1, scale: 1, y: 0 }}
                  animate={{ opacity: 0, scale: 0, y: 25, x: -5 }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                />
                <motion.div
                  className="absolute bottom-2 left-1/2 w-1.5 h-1.5 bg-orange-300 rounded-full"
                  initial={{ opacity: 1, scale: 1, y: 0 }}
                  animate={{ opacity: 0, scale: 0, y: 25, x: 5 }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                />
              </>
            )}

            {/* Idle Flame (Visible only on Hover) */}
            {!isScrolling && (
              <motion.div
                className="absolute bottom-3 left-1/2 -translate-x-1/2 w-0 h-0"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
              >
                <motion.div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-4 bg-gradient-to-t from-orange-500 to-yellow-300 rounded-full blur-[1px]"
                  animate={{
                    scaleY: [1, 1.2, 0.9, 1.1],
                    opacity: [0.8, 1, 0.8],
                  }}
                  transition={{
                    duration: 0.2,
                    repeat: Infinity,
                  }}
                />
              </motion.div>
            )}
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


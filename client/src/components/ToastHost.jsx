import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const listeners = new Set();
export function toast(message, type = 'info') {
  listeners.forEach((fn) => fn({ message, type, id: Date.now() + Math.random() }));
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handler = (t) => {
      setToasts((prev) => [...prev.slice(-3), t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3200);
    };
    listeners.add(handler);
    return () => listeners.delete(handler);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className={`pointer-events-auto rounded-full border px-5 py-2.5 text-xs tracking-widest backdrop-blur-xl ${
              t.type === 'error'
                ? 'border-red-400/30 bg-red-950/70 text-red-200'
                : 'border-aurora-400/30 bg-black/70 text-aurora-200'
            }`}
          >
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

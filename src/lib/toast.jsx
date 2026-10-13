// Toasts : une confirmation après chaque action, et les belles prises des amis en direct.
import { CheckCircle, Gift, Sparkle, WarningCircle, UserPlus } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);
const ICONS = { ok: CheckCircle, error: WarningCircle, gift: Gift, sparkle: Sparkle, join: UserPlus };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (message, { kind = 'ok', color, duration = 4500, image } = {}) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, message, kind, color, image }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push, error: (err) => push(err?.message ?? String(err), { kind: 'error' }) }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+68px)] z-[95] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:top-auto sm:items-end"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = ICONS[t.kind] ?? Sparkle;
            const color = t.kind === 'error' ? '#ff6b6b' : (t.color ?? '#ffc53d');
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                onClick={() => dismiss(t.id)}
                className="pointer-events-auto flex w-full max-w-[380px] cursor-pointer items-center gap-3 rounded-2xl border border-line-2 bg-[#14172c]/95 p-3 pr-4 text-sm shadow-pop backdrop-blur-xl"
                style={{ boxShadow: `inset 3px 0 0 ${color}, 0 24px 60px -20px rgb(0 0 0 / .8)` }}
              >
                {t.image ? (
                  <img src={t.image} alt="" className="h-11 w-9 flex-none rounded-md object-cover" />
                ) : (
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl" style={{ background: `${color}22`, color }}>
                    <Icon size={18} weight="fill" />
                  </span>
                )}
                <div className="min-w-0 leading-snug text-text/90">{t.message}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

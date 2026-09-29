import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { gsap, useGSAP, prefersReducedMotion, CLEAR } from '../../lib/motion';

/**
 * Dialog with an animated entrance and exit. It stays mounted after `isOpen`
 * turns false until the exit animation has played, showing the content it had
 * while open, since callers often clear the data behind it when closing.
 */
export function Modal({ isOpen, onClose, title, children }) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);
  const [mounted, setMounted] = useState(isOpen);
  const [openContent, setOpenContent] = useState(children);

  // Adjust during render (React's pattern for state that follows props)
  if (isOpen && !mounted) setMounted(true);
  if (isOpen && openContent !== children) setOpenContent(children);

  useGSAP(
    () => {
      if (!mounted) return;
      const overlay = overlayRef.current;
      const panel = panelRef.current;

      if (isOpen) {
        if (prefersReducedMotion()) return;
        gsap
          .timeline()
          .fromTo(overlay, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'power1.out', overwrite: true, clearProps: CLEAR })
          .fromTo(
            panel,
            { autoAlpha: 0, y: 16, scale: 0.97 },
            { autoAlpha: 1, y: 0, scale: 1, duration: 0.32, overwrite: true, clearProps: CLEAR },
            0.04
          );
        return;
      }

      if (prefersReducedMotion()) {
        setMounted(false);
        return;
      }
      gsap
        .timeline({ onComplete: () => setMounted(false) })
        .to(panel, { autoAlpha: 0, y: 8, scale: 0.98, duration: 0.18, ease: 'power2.in', overwrite: true })
        .to(overlay, { autoAlpha: 0, duration: 0.18, ease: 'power1.in', overwrite: true }, 0.05);
    },
    { dependencies: [isOpen, mounted] }
  );

  if (!mounted) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      // Ignore clicks while the exit plays, so a closing dialog cannot be used
      style={isOpen ? undefined : { pointerEvents: 'none' }}
    >
      <div ref={panelRef} className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors rounded-full p-1 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {isOpen ? children : openContent}
        </div>
      </div>
    </div>
  );
}

import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { useGame } from '../store/game';
import { useTutorial } from '../store/tutorial';
import { READ_ONLY, tutorialFinished, tutorialStep } from './tutorial';

export function Coach() {
  const { on, done, dismiss, stop } = useTutorial();
  const state = useGame((s) => s.state);
  const hub = useGame((s) => s.hub);
  const step = on ? tutorialStep(state, new Set(done)) : null;
  const ended = on && tutorialFinished(new Set(done)); // every read step passed: the tutorial ends itself
  useEffect(() => { if (ended) stop(); }, [ended, stop]);
  if (!step || hub) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.aside key={step.id} className="coach" role="status" aria-live="polite"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.25 }}>
        <b>{step.title}</b>
        <p>{step.text}</p>
        <div className="coach-buttons">
          <button className="link" onClick={stop}>Skip tutorial</button>
          {READ_ONLY.includes(step.id) && <button className="primary" onClick={() => dismiss(step.id)}>Got it</button>}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

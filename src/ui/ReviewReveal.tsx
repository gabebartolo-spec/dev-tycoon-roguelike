import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { content } from '../data/load';
import { useGame } from '../store/game';
import { money, signed } from './format';

const step = { hidden: { opacity: 0, y: 8 }, shown: { opacity: 1, y: 0 } };
const STEP_S = 0.45; // seconds between reveal steps: slow enough to read each one

/** Score counts up after its inputs are shown, so the player sees why before the number lands. */
function Score({ value, delay }: { value: number; delay: number }) {
  const n = useMotionValue(0);
  const text = useTransform(n, (v) => v.toFixed(0));
  useEffect(() => { const c = animate(n, value, { delay, duration: 0.8, ease: 'easeOut' }); return () => c.stop(); }, [n, value, delay]);
  return <motion.span className="score" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay, duration: 0.2 }}><motion.span>{text}</motion.span>/10</motion.span>;
}

export function Review() {
  const { state } = useGame();
  const r = state.releases[state.releases.length - 1];
  if (!r) return null;
  const genre = content.genres.find((g) => g.id === r.genreId)!;
  const lines = [
    <>Quality <b>{r.quality.toFixed(1)}</b> vs expectation <b>{r.expectation}</b></>,
    <>Hype <b>{r.hype.toFixed(1)}</b></>,
    <>Bugs <b>{r.bugs.toFixed(1)}</b></>,
  ];
  return (
    <motion.section key={state.releases.length} className="review" aria-live="polite" initial="hidden" animate="shown"
      transition={{ staggerChildren: STEP_S }}>
      <h2>Last release: {content.topics.find((t) => t.id === r.topicId)?.name} {genre.name}, review <Score value={r.review} delay={STEP_S * 3} /></h2>
      {lines.map((l, i) => <motion.span key={i} className="review-step" variants={step}>{l}</motion.span>)}
      <motion.p className="muted" variants={step}>Cost {money(r.cost)} · sales so far {money(r.revenue)}</motion.p>
      <motion.div className="why" variants={step}>
        <div><h3>Helped</h3>{r.best.map((l) => <div key={l.source} className="pos">{signed(l.impact)} {l.source}</div>)}</div>
        <div><h3>Hurt</h3>{r.worst.length ? r.worst.map((l) => <div key={l.source} className="neg">{signed(l.impact)} {l.source}</div>) : <div className="muted">nothing</div>}</div>
      </motion.div>
    </motion.section>
  );
}

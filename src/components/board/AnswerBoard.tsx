import { motion } from 'framer-motion';
import type { FeudAnswer } from '../../game/gameTypes';
import { usePrefersReducedMotion } from '../../game/usePrefersReducedMotion';

function AnswerCard({ answer, index }: { answer: FeudAnswer; index: number }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <div className="answer-card-scene">
      <motion.div
        className="answer-card-inner"
        animate={{ rotateY: answer.revealed ? 180 : 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.4,
          ease: 'easeInOut',
        }}
      >
        <div className="answer-face answer-face--front" aria-hidden={answer.revealed}>
          <span className="answer-slot-number">{index + 1}</span>
        </div>
        <div
          className="answer-face answer-face--back"
          aria-hidden={!answer.revealed}
        >
          {answer.revealed ? (
            <>
              <span className="answer-text">{answer.text}</span>
              <span className="answer-points">{answer.points}</span>
            </>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}

export default function AnswerBoard({ answers }: { answers: FeudAnswer[] }) {
  return (
    <div className="answer-board">
      {answers.map((answer, index) => (
        <AnswerCard key={answer.id} answer={answer} index={index} />
      ))}
    </div>
  );
}

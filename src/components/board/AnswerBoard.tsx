import { motion } from 'framer-motion';
import type { FeudAnswer } from '../../game/gameTypes';

function AnswerCard({ answer }: { answer: FeudAnswer }) {
  return (
    <div className="answer-card-scene">
      <motion.div
        className="answer-card-inner"
        animate={{ rotateY: answer.revealed ? 180 : 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
      >
        <div className="answer-face answer-face--front">
          <span className="answer-points-only">{answer.points}</span>
        </div>
        <div className="answer-face answer-face--back">
          <span className="answer-text">{answer.text}</span>
          <span className="answer-points">{answer.points}</span>
        </div>
      </motion.div>
    </div>
  );
}

export default function AnswerBoard({ answers }: { answers: FeudAnswer[] }) {
  return (
    <div className="answer-board">
      {answers.map((answer) => (
        <AnswerCard key={answer.id} answer={answer} />
      ))}
    </div>
  );
}

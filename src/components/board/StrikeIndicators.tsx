import { MAX_STRIKES } from '../../game/gameTypes';

export default function StrikeIndicators({ strikes }: { strikes: number }) {
  return (
    <div
      className="strikes"
      role="img"
      aria-label={`${strikes} of ${MAX_STRIKES} strikes`}
    >
      {Array.from({ length: MAX_STRIKES }, (_, index) => (
        <span
          key={index}
          className={index < strikes ? 'strike strike--on' : 'strike'}
        >
          ✕
        </span>
      ))}
    </div>
  );
}

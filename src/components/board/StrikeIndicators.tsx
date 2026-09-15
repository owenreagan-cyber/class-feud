import { MAX_STRIKES } from '../../game/gameTypes';

export default function StrikeIndicators({ strikes }: { strikes: number }) {
  return (
    <div
      className="strikes"
      role="img"
      aria-label={`${strikes} of ${MAX_STRIKES} strikes`}
    >
      {Array.from({ length: MAX_STRIKES }, (_, index) => {
        const on = index < strikes;
        const isThird = on && index === MAX_STRIKES - 1;
        const className = ['strike', on ? 'strike--on' : '', isThird ? 'strike--third' : '']
          .filter(Boolean)
          .join(' ');
        return (
          <span key={index} className={className}>
            ✕
          </span>
        );
      })}
    </div>
  );
}

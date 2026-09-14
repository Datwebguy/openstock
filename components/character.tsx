type CharacterName = "bellwether" | "scout" | "flux" | "split" | "receipt";
type CharacterState = "idle" | "observing" | "aligned" | "uncertain" | "blocked" | "ready" | "confirmed";

type CharacterProps = {
  character: CharacterName;
  state?: CharacterState;
  size?: "sm" | "md" | "lg";
  label?: string;
  decorative?: boolean;
};

const characterNames: Record<CharacterName, string> = {
  bellwether: "Bellwether",
  scout: "Scout",
  flux: "Flux",
  split: "Split",
  receipt: "Receipt",
};

export function Character({ character, state = "idle", size = "md", label, decorative = true }: CharacterProps) {
  return (
    <div
      className={`character character--${character} character--${size} character--${state}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label ?? characterNames[character]}
      aria-hidden={decorative ? true : undefined}
    >
      <div className="character__halo" />
      <div className="character__body">
        <span className="character__signal" />
        <span className="character__eye character__eye--left" />
        <span className="character__eye character__eye--right" />
        <span className="character__detail character__detail--one" />
        <span className="character__detail character__detail--two" />
      </div>
      <div className="character__shadow" />
    </div>
  );
}

export function CharacterLabel({ character, state }: { character: CharacterName; state: CharacterState }) {
  return <span className="character-label"><span className="status-dot" /> {characterNames[character]} · {state}</span>;
}

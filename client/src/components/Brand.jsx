import { Droplet } from "lucide-react";

export function Brand() {
  return (
    <a className="brand" href="/" aria-label="Sweety home">
      <span className="brand-icon">
        <Droplet size={26} strokeWidth={2.5} />
      </span>
      <span>
        sweety<span className="brand-period">.</span>
      </span>
    </a>
  );
}

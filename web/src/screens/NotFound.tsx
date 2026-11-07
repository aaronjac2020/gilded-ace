import { Link } from "react-router-dom";
import { PlayingCard } from "../components/theme/PlayingCard";
import { buttonVariants } from "../components/ui/button";
import { HeroBand } from "../components/ui/hero-band";

export default function NotFound() {
  return (
    <div>
      <HeroBand className="-mx-6" eyebrow="404" title="This card isn’t in the deck" sub="The link may be from an older build.">
        <div className="flex items-end gap-10">
          <div className="relative h-[116px] w-[150px]" aria-hidden>
            {[-10, 0, 10].map((r, i) => (
              <div key={r} className="absolute bottom-0" style={{ left: i * 34 }}>
                <PlayingCard faceUp={false} fan={r} className="h-[112px] w-[80px]" />
              </div>
            ))}
          </div>
          <Link to="/" className={buttonVariants({ variant: "primary" })}>
            Back to the table
          </Link>
        </div>
      </HeroBand>
    </div>
  );
}

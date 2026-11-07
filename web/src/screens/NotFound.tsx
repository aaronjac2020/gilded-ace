import { Link } from "react-router-dom";
import { buttonVariants } from "../components/ui/button";
import { HeroBand } from "../components/ui/hero-band";

export default function NotFound() {
  return (
    <div>
      <HeroBand className="-mx-6" eyebrow="404" title="This page is not on the floor" sub="The link may be from an older build. Every screen is one keystroke away: press G then V for the verdict.">
        <Link to="/" className={buttonVariants({ variant: "primary" })}>
          Go to verdict
        </Link>
      </HeroBand>
    </div>
  );
}

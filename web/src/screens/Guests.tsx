import Players from "./Players";
import Comps from "./Comps";

/** Round-1 fallback: the earlier screens, stacked in the new theme until this chapter is rebuilt. */
export default function Guests() {
  return (
    <div className="mx-auto max-w-content space-y-24 px-6 pb-24 pt-10">
      <Players />
      <Comps />
    </div>
  );
}

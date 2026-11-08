import FloorMap from "./FloorMap";
import Demand from "./Demand";
import Downtime from "./Downtime";
import { ForecastSection } from "./ModelLab";

/** Round-1 fallback: the earlier screens, stacked in the new theme until this chapter is rebuilt. */
export default function Floor() {
  return (
    <div className="mx-auto max-w-content space-y-24 px-6 pb-24 pt-10">
      <FloorMap />
      <ForecastSection />
      <Demand />
      <Downtime />
    </div>
  );
}

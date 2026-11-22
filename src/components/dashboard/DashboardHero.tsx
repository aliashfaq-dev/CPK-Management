import Link from "next/link";
import { faTowerBroadcast } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function DashboardHero() {
  return (
    <Card className="mb-4 p-5 md:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white">
            <FontAwesomeIcon icon={faTowerBroadcast} />
            Karachi community watch · Active
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight md:text-2xl">Community Policing Karachi: operations overview</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Together for a Safer Karachi. Camera nodes, plate detections, and watch flags across the city in one place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/live-camera" className={buttonClasses("primary")}>
            Open live camera
          </Link>
          <Link href="/find-flag" className={buttonClasses("danger")}>
            New flag entry
          </Link>
        </div>
      </div>
    </Card>
  );
}

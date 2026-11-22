import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faChartLine,
  faFlag,
  faGauge,
  faGear,
  faTableList,
  faVideo,
} from "@fortawesome/free-solid-svg-icons";

export interface NavItem {
  label: string;
  href: string;
  icon: IconDefinition;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: faGauge },
  { label: "Detections", href: "/detections", icon: faTableList },
  { label: "Find Flag", href: "/find-flag", icon: faFlag },
  { label: "Analytics", href: "/analytics", icon: faChartLine },
  { label: "Live Camera", href: "/live-camera", icon: faVideo },
  { label: "Settings", href: "/settings", icon: faGear },
];

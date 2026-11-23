import { BookOpen, ChartNoAxesColumn, Dumbbell, House, Library, PencilRuler, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Shorter label for the bottom tab bar on phones. */
  shortLabel?: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: House },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/case-studies", label: "Case studies", shortLabel: "Cases", icon: PencilRuler },
  { href: "/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/glossary", label: "Glossary", icon: Library },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

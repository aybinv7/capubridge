export const REPO_URL = "https://github.com/aybinv7/capubridge";
export const DOCS_URL = `${REPO_URL}#readme`;
export const ISSUES_URL = `${REPO_URL}/issues`;
export const RELEASES_URL = `${REPO_URL}/releases`;

export interface NavLink {
  label: string;
  href: string;
  external?: boolean;
}

/** Kept for the mobile menu only - the desktop rail replaces these links. */
export const navLinks: NavLink[] = [
  { label: "Problem", href: "#problem" },
  { label: "How it works", href: "#how" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Only here", href: "#flagships" },
];

export const footerGroups: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Capabilities", href: "#capabilities" },
      { label: "Only here", href: "#flagships" },
      { label: "Download", href: "#download" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: DOCS_URL, external: true },
      { label: "Releases", href: RELEASES_URL, external: true },
      { label: "Report an issue", href: ISSUES_URL, external: true },
    ],
  },
  {
    title: "Source",
    links: [
      { label: "GitHub", href: REPO_URL, external: true },
      { label: "License · MIT", href: `${REPO_URL}/blob/master/LICENSE`, external: true },
    ],
  },
];

export interface SectionMark {
  id: string;
  index: string;
  label: string;
}

export const sectionMarks: SectionMark[] = [
  { id: "top", index: "00", label: "Overview" },
  { id: "problem", index: "01", label: "The broken workflow" },
  { id: "how", index: "02", label: "How it works" },
  { id: "capabilities", index: "03", label: "Capabilities" },
  { id: "flagships", index: "04", label: "Only here" },
  { id: "download", index: "05", label: "Download" },
];

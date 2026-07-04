export type NavItem = {
  href: string;
  label: string;
  icon: string; // key into the icon map (kept as a string so it crosses the RSC boundary)
  exact?: boolean;
  badge?: string | number;
};

export type NavSection = {
  label?: string;
  items: NavItem[];
};

export type Surface = {
  href: string;
  label: string;
  icon: string;
};

export type ShellBrand = {
  label: string;
  href: string;
  sublabel?: string;
};

export type ShellUser = {
  name: string | null;
  email: string | null;
  initials: string;
};

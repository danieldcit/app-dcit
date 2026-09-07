"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  COLABORADOR_SIDEBAR,
  COLABORADORES_GROUP,
  GESTOR_CAREER_LINK,
  GESTOR_SIDEBAR_ORDER,
  isSidebarGroup,
  NAV_SECTIONS,
  RH_SIDEBAR_ORDER,
  type NavRole,
  type SidebarEntry,
  type SidebarGroup,
  type SidebarLink,
} from "@/lib/nav-sections";
import { NavIcon } from "./nav-icon";

import styles from "./app-shell.module.css";

// A link's href may carry its own query string (the Gestão de Carreiras
// children use `?aba=...`) — usePathname() never includes the query, so a
// plain `pathname === link.href` comparison can never match those. This
// checks the path plus only the query params the link itself specifies,
// ignoring any others present in the current URL (e.g. `userId`) so the
// active state survives picking a colaborador.
function isLinkActive(link: SidebarLink, pathname: string, searchParams: URLSearchParams): boolean {
  const [linkPath, linkQuery] = link.href.split("?");
  if (pathname !== linkPath) return false;
  if (!linkQuery) return true;
  for (const [key, value] of new URLSearchParams(linkQuery)) {
    if (searchParams.get(key) !== value) return false;
  }
  return true;
}

function NavLinkItem({
  link,
  pathname,
  searchParams,
  collapsed,
}: {
  link: SidebarLink;
  pathname: string;
  searchParams: URLSearchParams;
  collapsed?: boolean;
}) {
  const active = isLinkActive(link, pathname, searchParams);
  return (
    <li>
      <Link
        href={link.href}
        className={active ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink}
        aria-current={active ? "page" : undefined}
        title={collapsed ? link.label : undefined}
      >
        <NavIcon href={link.href} className={styles.navItemIcon} />
        <span className={styles.navLabel}>{link.label}</span>
      </Link>
    </li>
  );
}

function NavGroupItem({
  group,
  pathname,
  searchParams,
  collapsed,
}: {
  group: SidebarGroup;
  pathname: string;
  searchParams: URLSearchParams;
  collapsed?: boolean;
}) {
  const active = isLinkActive(group, pathname, searchParams);
  // Always starts collapsed ("normal") — expanding is a deliberate click,
  // not something the current route decides for you. Auto-expanding
  // whenever the group's own page was active looked like it never actually
  // collapsed, since "/" (the group's target) is where a colaborador lands
  // right after login.
  const [open, setOpen] = useState(false);
  // A collapsed sidebar has no room for children anyway — treat the group
  // like a plain link (icon + tooltip, straight to its own href) instead of
  // showing a chevron that can never reveal anything.
  const showChildren = open && !collapsed;

  return (
    <div className={styles.navGroup}>
      <div className={active ? `${styles.navGroupRow} ${styles.navLinkActive}` : styles.navGroupRow}>
        <Link
          href={group.href}
          className={styles.navGroupLink}
          aria-current={active ? "page" : undefined}
          title={collapsed ? group.label : undefined}
        >
          <NavIcon href={group.href} className={styles.navItemIcon} />
          <span className={styles.navLabel}>{group.label}</span>
        </Link>
        {collapsed ? null : (
          <button
            type="button"
            className={styles.navGroupToggle}
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={open ? `Recolher ${group.label}` : `Expandir ${group.label}`}
          >
            <svg
              className={open ? `${styles.navChevron} ${styles.navChevronOpen}` : styles.navChevron}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      {showChildren ? (
        <ul className={styles.navChildren}>
          {group.children.map((child) => (
            <NavLinkItem key={child.href} link={child} pathname={pathname} searchParams={searchParams} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function NavLinks({
  role,
  collapsed,
  restricted,
}: {
  role: NavRole;
  collapsed?: boolean;
  restricted?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (restricted) {
    return (
      <nav className={styles.navSections}>
        <ul className={styles.nav}>
          <NavLinkItem
            link={{ href: "/onboarding", label: "Onboarding" }}
            pathname={pathname}
            searchParams={searchParams}
            collapsed={collapsed}
          />
        </ul>
      </nav>
    );
  }

  if (role === "colaborador") {
    return (
      <nav className={styles.navSections}>
        {COLABORADOR_SIDEBAR.map((entry) =>
          isSidebarGroup(entry) ? (
            <NavGroupItem
              key={entry.href}
              group={entry}
              pathname={pathname}
              searchParams={searchParams}
              collapsed={collapsed}
            />
          ) : (
            <ul className={styles.nav} key={entry.href}>
              <NavLinkItem link={entry} pathname={pathname} searchParams={searchParams} collapsed={collapsed} />
            </ul>
          ),
        )}
      </nav>
    );
  }

  if (role === "gestor") {
    // Ponto, Banco de Horas, Holerites and Benefícios render inside
    // COLABORADORES_GROUP instead of this flat list — see its comment in
    // nav-sections.ts.
    const flatEntries = NAV_SECTIONS.filter(
      (section) =>
        section.roles.includes("gestor") && GESTOR_SIDEBAR_ORDER.includes(section.href),
    ).sort((a, b) => GESTOR_SIDEBAR_ORDER.indexOf(a.href) - GESTOR_SIDEBAR_ORDER.indexOf(b.href));
    return (
      <nav className={styles.navSections}>
        <NavGroupItem
          group={COLABORADORES_GROUP}
          pathname={pathname}
          searchParams={searchParams}
          collapsed={collapsed}
        />
        <ul className={styles.nav}>
          {flatEntries.map((link) => (
            <NavLinkItem key={link.href} link={link} pathname={pathname} searchParams={searchParams} collapsed={collapsed} />
          ))}
        </ul>
        <ul className={styles.nav}>
          <NavLinkItem link={GESTOR_CAREER_LINK} pathname={pathname} searchParams={searchParams} collapsed={collapsed} />
        </ul>
      </nav>
    );
  }

  // Only remaining role at this point is "rh" — same idea as gestor
  // (Ponto/Banco de Horas/Holerites/Benefícios nest inside Colaboradores),
  // but Colaboradores keeps its place inline in RH_SIDEBAR_ORDER rather than
  // always leading, so the group and the flat items interleave in one list.
  const rhChildHrefs = COLABORADORES_GROUP.children.map((child) => child.href);
  const rhEntries: SidebarEntry[] = NAV_SECTIONS.filter(
    (section) => section.roles.includes(role) && !rhChildHrefs.includes(section.href),
  )
    .map((section): SidebarEntry =>
      section.href === COLABORADORES_GROUP.href ? COLABORADORES_GROUP : section,
    )
    .sort((a, b) => RH_SIDEBAR_ORDER.indexOf(a.href) - RH_SIDEBAR_ORDER.indexOf(b.href));
  return (
    <nav>
      {rhEntries.map((entry) =>
        isSidebarGroup(entry) ? (
          <NavGroupItem
            key={entry.href}
            group={entry}
            pathname={pathname}
            searchParams={searchParams}
            collapsed={collapsed}
          />
        ) : (
          <ul className={styles.nav} key={entry.href}>
            <NavLinkItem link={entry} pathname={pathname} searchParams={searchParams} collapsed={collapsed} />
          </ul>
        ),
      )}
    </nav>
  );
}

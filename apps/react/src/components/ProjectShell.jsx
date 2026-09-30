import { useEffect, useRef, useState } from 'react';
import {
  Content, SideNav, SideNavItems, SideNavLink, SideNavDivider, SkipToContent,
} from '@carbon/react';
import AppHeader from './AppHeader.jsx';
import { breakpoints } from '@carbon/layout';
import useMediaQuery from '../hooks/useMediaQuery.js';

const primaryItems = [
  ['participants', '参加者'],
  ['organization-car', '車割'],
  ['organization-team', '班割'],
  ['settlement', '精算'],
];
const supportingItems = [
  ['overview', '概要'],
  ['history-settings', '履歴'],
];

function ProjectLink({ item: [id, label], section, navigation, onNavigate }) {
  const active = section === id;
  const props = {
    href: navigation.hrefFor(id),
    isActive: active,
    'aria-current': active ? 'page' : undefined,
    onClick(event) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onNavigate(id);
    },
    children: label,
  };
  return <SideNavLink {...props} />;
}

export default function ProjectShell({ projectName, roomId, section, navigation, headerProps, children }) {
  const isDesktop = useMediaQuery(`(min-width: ${breakpoints.lg.width})`);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigationButtonRef = useRef(null);
  const expanded = isDesktop || mobileNavOpen;

  useEffect(() => setMobileNavOpen(false), [section]);
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      setMobileNavOpen(false);
      requestAnimationFrame(() => navigationButtonRef.current?.focus());
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  function navigate(id) {
    const changed = navigation.navigate(id);
    setMobileNavOpen(false);
    if (!changed) requestAnimationFrame(() => document.getElementById('project-page-title')?.focus());
  }

  function dismissNavigation() {
    setMobileNavOpen(false);
    requestAnimationFrame(() => navigationButtonRef.current?.focus());
  }

  return <>
    <SkipToContent href="#main-content">本文へ移動</SkipToContent>
    <AppHeader
      {...headerProps}
      projectName={projectName}
      navigationButtonRef={navigationButtonRef}
      navigationOpen={mobileNavOpen}
      onToggleNavigation={() => setMobileNavOpen(value => !value)}
      onCloseNavigation={() => setMobileNavOpen(false)}
    />
    <SideNav
      id="project-navigation"
      aria-label="企画内ナビゲーション"
      className="project-navigation"
      expanded={expanded}
      isChildOfHeader
      isPersistent
      onOverlayClick={dismissNavigation}
      onSideNavBlur={() => { if (!isDesktop) setMobileNavOpen(false); }}
    >
      <div className="project-navigation__context">
        <span>現在の企画</span>
        <strong title={projectName || '企画名未設定'}>{projectName || '企画名未設定'}</strong>
        <small>{roomId}</small>
      </div>
      <SideNavItems aria-label="主要作業" isSideNavExpanded={expanded}>
        {primaryItems.map(item => <ProjectLink key={item[0]} item={item} section={section} navigation={navigation} onNavigate={navigate} />)}
        <SideNavDivider />
      </SideNavItems>
      <SideNavItems aria-label="企画情報と履歴" isSideNavExpanded={expanded}>
        {supportingItems.map(item => <ProjectLink key={item[0]} item={item} section={section} navigation={navigation} onNavigate={navigate} />)}
      </SideNavItems>
    </SideNav>
    <Content id="main-content" className="project-content">{children}</Content>
  </>;
}

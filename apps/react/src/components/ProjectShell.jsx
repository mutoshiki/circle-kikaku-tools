import { useEffect, useRef, useState } from 'react';
import {
  Content, SideNav, SideNavItems, SideNavLink, SideNavMenu, SideNavMenuItem, SkipToContent,
} from '@carbon/react';
import AppHeader from './AppHeader.jsx';
import useMediaQuery from '../hooks/useMediaQuery.js';

const primaryItems = [
  ['overview', '概要'],
  ['participants', '参加者'],
];
const organizationItems = [
  ['organization-car', '車割'],
  ['organization-team', '班割'],
];
const closingItems = [
  ['settlement', '精算'],
  ['history-settings', '履歴と設定'],
];

function ProjectLink({ item: [id, label], section, navigation, onNavigate, nested = false }) {
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
  return nested ? <SideNavMenuItem {...props} /> : <SideNavLink {...props} />;
}

export default function ProjectShell({ projectName, roomId, section, navigation, headerProps, children }) {
  const isDesktop = useMediaQuery('(min-width: 66rem)');
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
    navigation.navigate(id);
    setMobileNavOpen(false);
  }

  return <>
    <SkipToContent href="#main-content">本文へ移動</SkipToContent>
    <AppHeader
      {...headerProps}
      projectName={projectName}
      navigationButtonRef={navigationButtonRef}
      navigationOpen={mobileNavOpen}
      onToggleNavigation={() => setMobileNavOpen(value => !value)}
    />
    <SideNav
      aria-label="企画内ナビゲーション"
      className={`project-navigation${mobileNavOpen ? ' project-navigation--mobile-open' : ''}`}
      expanded={expanded}
      isChildOfHeader
      isPersistent
      onOverlayClick={() => setMobileNavOpen(false)}
    >
      <div className="project-navigation__context">
        <span>現在の企画</span>
        <strong title={projectName || '企画名未設定'}>{projectName || '企画名未設定'}</strong>
        <small>{roomId}</small>
      </div>
      <SideNavItems isSideNavExpanded={expanded}>
        {primaryItems.map(item => <ProjectLink key={item[0]} item={item} section={section} navigation={navigation} onNavigate={navigate} />)}
        <SideNavMenu title="運営準備" defaultExpanded isActive={section.startsWith('organization-')} isSideNavExpanded={expanded}>
          {organizationItems.map(item => <ProjectLink key={item[0]} item={item} section={section} navigation={navigation} onNavigate={navigate} nested />)}
        </SideNavMenu>
        {closingItems.map(item => <ProjectLink key={item[0]} item={item} section={section} navigation={navigation} onNavigate={navigate} />)}
      </SideNavItems>
    </SideNav>
    <Content id="main-content" className="project-content">{children}</Content>
  </>;
}

import { useRef, useState } from 'react';
import {
  Header, HeaderGlobalAction, HeaderGlobalBar, HeaderMenuButton, HeaderName, HeaderPanel,
  Menu, MenuItem, Popover, PopoverContent, Switcher, SwitcherItem,
} from '@carbon/react';
import { Link, OverflowMenuVertical, Switcher as SwitcherIcon } from '@carbon/icons-react';

const relatedApplications = [
  { name: '山歩会フォームメーカー', href: 'https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec' },
  { name: '学務提出書類作成ツール', href: 'https://github.com/mutoshiki/sampokai-submission-builder/releases' },
  { name: '山歩会企画ツール一覧', href: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/' },
];

export default function AppHeader({ theme, projectName, showSampleData, navigationButtonRef, navigationOpen, onToggleNavigation, onCloseNavigation, onShare, onOpenUtility, onToggleTheme }) {
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherButton = useRef(null);

  function openUtility(name) {
    setUtilityOpen(false);
    onOpenUtility(name);
  }

  function toggleUtility() {
    onCloseNavigation();
    setSwitcherOpen(false);
    setUtilityOpen(value => !value);
  }

  function toggleSwitcher() {
    onCloseNavigation();
    setUtilityOpen(false);
    setSwitcherOpen(value => !value);
  }

  return <Header aria-label="山歩会企画ツール" className="app-header">
    <HeaderMenuButton ref={navigationButtonRef} aria-label={navigationOpen ? '企画メニューを閉じる' : '企画メニューを開く'} aria-controls="project-navigation" aria-expanded={navigationOpen} isActive={navigationOpen} onClick={() => { setUtilityOpen(false); setSwitcherOpen(false); onToggleNavigation(); }} />
    <HeaderName as="span" prefix="">山歩会企画ツール</HeaderName>
    <div className="app-header__project" title={projectName || '企画名未設定'}><span>{projectName || '企画名未設定'}</span></div>
    <HeaderGlobalBar>
      <HeaderGlobalAction aria-label="共有リンク" tooltipAlignment="end" onClick={onShare}><Link size={20} /></HeaderGlobalAction>
      <Popover className="utility-menu-popover" open={utilityOpen} align="bottom-end" autoAlign onRequestClose={() => setUtilityOpen(false)}>
        <HeaderGlobalAction aria-label="ユーティリティメニュー" tooltipAlignment="end" isActive={utilityOpen} onClick={toggleUtility}><OverflowMenuVertical size={20} /></HeaderGlobalAction>
        <PopoverContent className="utility-menu-popover__content">
          <Menu label="ユーティリティメニュー" open={utilityOpen} target={null} legacyAutoalign={false} onClose={() => setUtilityOpen(false)}>
            <MenuItem label="使い方" onClick={() => openUtility('guide')} />
            {showSampleData && <MenuItem label="サンプルデータ" onClick={() => openUtility('sample')} />}
            <MenuItem label={theme === 'g10' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'} onClick={() => { setUtilityOpen(false); onToggleTheme(); }} />
            <MenuItem label="バグを報告する" onClick={() => openUtility('bug')} />
          </Menu>
        </PopoverContent>
      </Popover>
      <HeaderGlobalAction ref={switcherButton} aria-label="関連アプリ" tooltipAlignment="end" isActive={switcherOpen} onClick={toggleSwitcher}><SwitcherIcon size={20} /></HeaderGlobalAction>
    </HeaderGlobalBar>
    <HeaderPanel role="navigation" aria-label="関連アプリ" expanded={switcherOpen} onHeaderPanelFocus={() => { setSwitcherOpen(false); switcherButton.current?.focus(); }}>
      <Switcher aria-label="関連アプリ" expanded={switcherOpen}>
        {relatedApplications.map(application => <SwitcherItem key={application.name} href={application.href} target="_blank" rel="noreferrer">{application.name}</SwitcherItem>)}
      </Switcher>
    </HeaderPanel>
  </Header>;
}

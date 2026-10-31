import { useRef, useState } from 'react';
import {
  Header, HeaderGlobalAction, HeaderGlobalBar, HeaderName, HeaderPanel,
  Menu, MenuItem, Popover, PopoverContent, SkipToContent, Switcher, SwitcherItem,
} from '@carbon/react';
import { Link, OverflowMenuVertical, Switcher as SwitcherIcon } from '@carbon/icons-react';

const relatedApplications = [
  { name: '山歩会フォームメーカー', href: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/' },
  { name: '学務提出書類作成ツール', href: 'https://github.com/mutoshiki/sampokai-submission-builder/releases' },
  { name: '山歩会企画ツール一覧', href: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/' },
];

export default function AppHeader({ theme, themePreference, onShare, onOpenUtility, onToggleTheme, onUseSystemTheme, debugSample = false }) {
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherButton = useRef(null);

  function openUtility(name) {
    setUtilityOpen(false);
    onOpenUtility(name);
  }

  function toggleUtility() {
    setSwitcherOpen(false);
    setUtilityOpen(value => !value);
  }

  function toggleSwitcher() {
    setUtilityOpen(false);
    setSwitcherOpen(value => !value);
  }

  return <Header aria-label="サークル企画ツール" className="app-header">
    <SkipToContent href="#main-content">メインコンテンツへ移動</SkipToContent>
    <HeaderName prefix="">サークル企画ツール</HeaderName>
    <HeaderGlobalBar>
      {!debugSample && <HeaderGlobalAction aria-label="企画のリンクをコピー" tooltipAlignment="end" onClick={onShare}><Link size={20} /></HeaderGlobalAction>}
      <Popover className="utility-menu-popover" open={utilityOpen} align="bottom-end" autoAlign onRequestClose={() => setUtilityOpen(false)}>
        <HeaderGlobalAction aria-label="その他の操作" tooltipAlignment="end" isActive={utilityOpen} onClick={toggleUtility}><OverflowMenuVertical size={20} /></HeaderGlobalAction>
        <PopoverContent className="utility-menu-popover__content">
          <Menu label="その他の操作" open={utilityOpen} target={null} legacyAutoalign={false} onClose={() => setUtilityOpen(false)}>
            <MenuItem label="使い方" onClick={() => openUtility('guide')} />
            <MenuItem label="サンプルデータ" onClick={() => openUtility('sample')} />
            <MenuItem label={theme === 'g10' ? 'ダークモードに切り替え' : 'ライトモードに切り替え'} onClick={() => { setUtilityOpen(false); onToggleTheme(); }} />
            {themePreference !== 'system' && <MenuItem label="端末の表示設定に合わせる" onClick={() => { setUtilityOpen(false); onUseSystemTheme(); }} />}
            <MenuItem label="不具合を報告" onClick={() => openUtility('bug')} />
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

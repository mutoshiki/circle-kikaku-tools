import { useRef, useState } from 'react';
import {
  Header, HeaderGlobalAction, HeaderGlobalBar, HeaderName, HeaderPanel,
  Menu, MenuItem, Modal, Popover, PopoverContent, SkipToContent, Switcher, SwitcherItem, TextInput, Theme,
} from '@carbon/react';
import { Link, OverflowMenuVertical, Switcher as SwitcherIcon } from '@carbon/icons-react';

const relatedApplications = [
  { name: '山歩会フォームメーカー', href: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/' },
  { name: '学務提出書類作成ツール', href: 'https://github.com/mutoshiki/sampokai-submission-builder/releases' },
  { name: '山歩会企画ツール一覧', href: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/' },
];

export default function AppHeader({ projectName, theme, themePreference, onShare, onRename, onOpenUtility, onToggleTheme, onUseSystemTheme, debugSample = false }) {
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState('');
  const switcherButton = useRef(null);
  const utilityButton = useRef(null);
  const composing = useRef(false);
  const isProject = projectName !== undefined;
  const displayName = String(projectName || '').trim() || '企画名未設定';

  function closeRename() {
    setRenameOpen(false);
    requestAnimationFrame(() => utilityButton.current?.focus());
  }

  function beginRename() {
    setDraftName(projectName || '');
    setRenameError('');
    setUtilityOpen(false);
    setRenameOpen(true);
  }

  function saveRename() {
    if (draftName === (projectName || '')) { closeRename(); return; }
    try {
      onRename(draftName);
      setRenameError('');
      closeRename();
    } catch {
      setRenameError('企画名を保存できませんでした。もう一度お試しください。');
    }
  }

  function handleRenameKeyDown(event) {
    if (composing.current || event.nativeEvent.isComposing) {
      if (event.key === 'Enter' || event.key === 'Escape') event.preventDefault();
      return;
    }
    if (event.key === 'Enter') { event.preventDefault(); saveRename(); }
    else if (event.key === 'Escape') { event.preventDefault(); closeRename(); }
  }

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

  return <>
  <Header aria-label={isProject ? `${displayName}のヘッダー` : 'サークル企画ツール'} className="app-header">
    <SkipToContent href="#main-content">メインコンテンツへ移動</SkipToContent>
    <HeaderName className="app-header__project-name" prefix=""><span>{isProject ? displayName : 'サークル企画ツール'}</span></HeaderName>
    <HeaderGlobalBar>
      {!debugSample && <HeaderGlobalAction aria-label="企画のリンクをコピー" tooltipAlignment="end" onClick={onShare}><Link size={20} /></HeaderGlobalAction>}
      <Popover className="utility-menu-popover" open={utilityOpen} align="bottom-end" autoAlign onRequestClose={() => setUtilityOpen(false)}>
        <HeaderGlobalAction ref={utilityButton} aria-label="その他の操作" tooltipAlignment="end" isActive={utilityOpen} onClick={toggleUtility}><OverflowMenuVertical size={20} /></HeaderGlobalAction>
        <PopoverContent className="utility-menu-popover__content">
          <Menu label="その他の操作" open={utilityOpen} target={null} legacyAutoalign={false} onClose={() => setUtilityOpen(false)}>
            {projectName !== undefined && <MenuItem label="企画名を変更" onClick={beginRename} />}
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
  </Header>
  <Theme theme={theme}><Modal className="app-modal" closeButtonLabel="閉じる" open={renameOpen} size="sm" modalHeading="企画名を変更" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={saveRename} onRequestClose={closeRename} selectorPrimaryFocus="#header-project-name">
    <TextInput id="header-project-name" labelText="企画名" placeholder="企画名未設定" value={draftName} invalid={!!renameError} invalidText={renameError} onChange={event => setDraftName(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={handleRenameKeyDown} />
  </Modal></Theme>
  </>;
}

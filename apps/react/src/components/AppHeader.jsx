import { useEffect, useRef, useState } from 'react';
import {
  Header, HeaderGlobalAction, HeaderGlobalBar, HeaderName,
  Menu, MenuItem, MenuItemDivider, Modal, Popover, PopoverContent,
  SkipToContent, TextInput, Theme,
} from '@carbon/react';
import { Link, OverflowMenuVertical } from '@carbon/icons-react';

const externalTools = [
  { name: '山歩会フォームメーカー（外部ツール）', href: 'https://mutoshiki.github.io/sanpokai-kikaku-portal/form-maker/' },
  { name: '学務提出書類作成ツール（外部ツール）', href: 'https://github.com/mutoshiki/sampokai-submission-builder/releases' },
];

export default function AppHeader({ projectName, theme, onShare, onRename, onOpenUtility, onOpenTabEditor, onNavigateToProjects, debugSample = false }) {
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState('');
  const utilityButton = useRef(null);
  const firstMenuItem = useRef(null);
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

  function openExternalTool(href) {
    setUtilityOpen(false);
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  function toggleUtility() {
    setUtilityOpen(value => {
      const next = !value;
      if (next) requestAnimationFrame(() => firstMenuItem.current?.focus());
      return next;
    });
  }

  useEffect(() => {
    if (!utilityOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key !== 'Escape') return;
      setUtilityOpen(false);
      requestAnimationFrame(() => utilityButton.current?.focus());
    }
    document.addEventListener('keydown', closeOnEscape, true);
    return () => document.removeEventListener('keydown', closeOnEscape, true);
  }, [utilityOpen]);

  return <>
  <Header aria-label={isProject ? `${displayName}のヘッダー` : 'サークル企画ツール'} className="app-header">
    <SkipToContent href="#main-content">メインコンテンツへ移動</SkipToContent>
    <HeaderName className="app-header__project-name" prefix=""><span>{isProject ? displayName : 'サークル企画ツール'}</span></HeaderName>
    <HeaderGlobalBar>
      {!debugSample && <HeaderGlobalAction aria-label="企画のリンクをコピー" tooltipAlignment="end" onClick={onShare}><Link size={20} /></HeaderGlobalAction>}
      <Popover className="utility-menu-popover" open={utilityOpen} align="bottom-end" onRequestClose={() => setUtilityOpen(false)}>
        <HeaderGlobalAction ref={utilityButton} aria-label="その他の操作" aria-haspopup="menu" aria-expanded={utilityOpen} aria-controls="app-header-utility-menu" tooltipAlignment="end" isActive={utilityOpen} onClick={toggleUtility}><OverflowMenuVertical size={20} /></HeaderGlobalAction>
        <PopoverContent className="utility-menu-popover__content">
          <Menu id="app-header-utility-menu" label="その他の操作" open={utilityOpen} target={null} legacyAutoalign={false} onClose={() => setUtilityOpen(false)}>
            {isProject && <>
              <MenuItem ref={firstMenuItem} label="企画一覧へ" onClick={() => { setUtilityOpen(false); onNavigateToProjects?.(); }} />
              <MenuItem label="企画名を変更" onClick={beginRename} />
              <MenuItem label="タブを編集" onClick={() => { setUtilityOpen(false); onOpenTabEditor?.(); }} />
            </>}
            <MenuItemDivider />
            <MenuItem label="使い方" onClick={() => openUtility('guide')} />
            <MenuItem label="不具合を報告" onClick={() => openUtility('bug')} />
            <MenuItem label="サンプルデータ" onClick={() => openUtility('sample')} />
            <MenuItemDivider />
            {externalTools.map(tool => <MenuItem key={tool.href} label={tool.name} onClick={() => openExternalTool(tool.href)} />)}
          </Menu>
        </PopoverContent>
      </Popover>
    </HeaderGlobalBar>
  </Header>
  <Theme theme={theme}><Modal className="app-modal" closeButtonLabel="閉じる" open={renameOpen} size="sm" modalHeading="企画名を変更" primaryButtonText="保存" secondaryButtonText="キャンセル" onRequestSubmit={saveRename} onRequestClose={closeRename} selectorPrimaryFocus="#header-project-name">
    <TextInput id="header-project-name" labelText="企画名" placeholder="企画名未設定" value={draftName} invalid={!!renameError} invalidText={renameError} onChange={event => setDraftName(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={handleRenameKeyDown} />
  </Modal></Theme>
  </>;
}

import { useEffect, useMemo, useState } from 'react';
import {
  Button, Checkbox, Column, ContainedList, ContainedListItem, Grid, Header,
  HeaderName, InlineNotification, RadioButton, RadioButtonGroup, SkipToContent,
  TextInput, Theme,
} from '@carbon/react';
import { createTemplateWorkspace, resolveInitialTool, TEMPLATE_REGISTRY, TOOL_REGISTRY } from '../services/project-workspace.js';
import { creationIntentKey, resolveEntryScreen } from '../services/project-entry.js';
import { readPortalProjects } from '../services/portal-history.js';
import SectionHeading from './ui/SectionHeading.jsx';

const templateTools = new Map(Object.values(TEMPLATE_REGISTRY).map(template => [template.id, template.tools]));
const toolLabels = new Map(TOOL_REGISTRY.map(tool => [tool.id, tool.label]));
const viewForTool = new Map(TOOL_REGISTRY.map(tool => [tool.id, tool.view]));
const themePreferenceKey = 'sanpo-react:theme-preference:v1';

function readThemePreference() {
  try {
    const preference = window.localStorage.getItem(themePreferenceKey);
    return preference === 'light' || preference === 'dark' ? preference : 'system';
  } catch { return 'system'; }
}

function readSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'g100' : 'g10';
}

function projectUrl(roomId) {
  const url = new URL(import.meta.env.BASE_URL, window.location.href);
  url.searchParams.set('room', roomId);
  return url;
}

function createUrl() {
  const url = new URL(import.meta.env.BASE_URL, window.location.href);
  url.searchParams.set('screen', 'create');
  return url.href;
}

function formatProjectActivity(project) {
  const hasOpenedAt = Number.isFinite(project.lastOpenedAt);
  const timestamp = hasOpenedAt ? project.lastOpenedAt : project.updatedAt;
  if (!Number.isFinite(timestamp)) return '閲覧日時不明';
  try {
    const date = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
    return `${hasOpenedAt ? '最終閲覧' : '最終更新'}：${date}`;
  } catch { return '日時不明'; }
}

export default function ProjectEntry({ storage = window.localStorage, crypto = window.crypto }) {
  const mode = resolveEntryScreen(window.location.href) || 'list';
  const [themePreference, setThemePreference] = useState(readThemePreference);
  const [systemTheme, setSystemTheme] = useState(readSystemTheme);
  const theme = themePreference === 'dark' ? 'g100' : themePreference === 'light' ? 'g10' : systemTheme;
  const [templateId, setTemplateId] = useState('personal');
  const [roomName, setRoomName] = useState('');
  const [customTools, setCustomTools] = useState([]);
  const [error, setError] = useState('');
  const index = useMemo(() => readPortalProjects(storage), [storage]);

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = event => setSystemTheme(event.matches ? 'g100' : 'g10');
    const updateStoredPreference = event => {
      if (event.key === themePreferenceKey || event.key === null) setThemePreference(readThemePreference());
    };
    colorScheme.addEventListener('change', updateSystemTheme);
    window.addEventListener('storage', updateStoredPreference);
    return () => {
      colorScheme.removeEventListener('change', updateSystemTheme);
      window.removeEventListener('storage', updateStoredPreference);
    };
  }, []);

  function openProject(roomId) {
    return projectUrl(roomId).href;
  }

  function createProject(event) {
    event.preventDefault();
    setError('');
    try {
      if (typeof crypto?.randomUUID !== 'function') {
        setError('このブラウザーでは企画を作成できません。ブラウザーを更新してください。');
        return;
      }
      const roomId = crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
      const workspace = createTemplateWorkspace({ templateId, customTools });
      const intentKey = creationIntentKey(roomId);
      storage.setItem(intentKey, JSON.stringify({ roomId, roomName: roomName.trim(), workspace }));
      const url = projectUrl(roomId);
      url.searchParams.set('view', viewForTool.get(resolveInitialTool(workspace)) || 'tools');
      window.location.assign(url);
    } catch {
      setError('企画を作成できませんでした。ブラウザーの保存設定を確認してください。');
    }
  }

  return <Theme theme={theme} className="application">
    <Header aria-label="サークル企画ツール" className="app-header">
      <SkipToContent href="#main-content">メインコンテンツへ移動</SkipToContent>
      <HeaderName prefix="">サークル企画ツール</HeaderName>
    </Header>
    <main id="main-content" className="project-entry-main" tabIndex={-1}>
      <Grid fullWidth>
        <Column sm={4} md={8} lg={{ span: 12, start: 3 }} xlg={{ span: 12, start: 3 }} max={{ span: 12, start: 3 }}>
          {mode === 'create' ? <section className="project-entry-panel" aria-labelledby="project-entry-heading">
            <SectionHeading as="h1" className="project-entry-heading" id="project-entry-heading" title="新しい企画" actions={<Button kind="ghost" size="sm" onClick={() => window.location.assign(new URL(import.meta.env.BASE_URL, window.location.href))}>企画一覧へ戻る</Button>} />
            <form className="project-create-form" onSubmit={createProject}>
              <TextInput id="new-project-name" labelText="企画名（任意）" placeholder="例：秋名山登山企画" value={roomName} onChange={event => setRoomName(event.target.value)} />
              <RadioButtonGroup legendText="テンプレート" name="project-template" valueSelected={templateId} onChange={value => setTemplateId(String(value))} orientation="vertical">
                {Object.values(TEMPLATE_REGISTRY).map(template => <RadioButton key={template.id} id={`template-${template.id}`} labelText={template.label} value={template.id} />)}
              </RadioButtonGroup>
              <div className="project-template-notes">
                <p>ツールの表示は、作成後も変更できます。</p>
                <p>{templateId === 'custom' ? '使うツールを選んでください。' : `最初に表示：${(templateTools.get(templateId) || []).map(id => toolLabels.get(id)).join('、')}`}</p>
              </div>
              {templateId === 'custom' && <fieldset className="project-custom-tools"><legend>使うツール</legend>{TOOL_REGISTRY.filter(tool => !tool.system).map(tool => <Checkbox key={tool.id} id={`custom-tool-${tool.id}`} labelText={tool.label} checked={customTools.includes(tool.id)} onChange={(_, { checked }) => setCustomTools(current => checked ? [...new Set([...current, tool.id])] : current.filter(id => id !== tool.id))} />)}</fieldset>}
              {error && <InlineNotification kind="error" title={error} hideCloseButton />}
              <Button type="submit" kind="primary">企画を作成</Button>
            </form>
          </section> : <section className="project-entry-panel" aria-labelledby="project-entry-heading">
            <SectionHeading as="h1" className="project-entry-heading" id="project-entry-heading" title="企画一覧" actions={<Button kind="primary" href={createUrl()} target="_blank" rel="noopener">新しい企画を作成</Button>} />
            <p className="project-entry-local-label">この一覧は、このブラウザーで開いた企画の履歴です。他の端末とは共有されません。</p>
            {index.status === 'empty' && <div className="project-list-empty"><h2>最近開いた企画はありません</h2><p>共有リンクから企画を開くと、ここに追加されます。</p></div>}
            {index.status === 'unavailable' && <InlineNotification kind="error" title="企画履歴を読み取れません" subtitle="共有リンクから企画を開いてください。" hideCloseButton />}
            {index.status === 'partial' && <InlineNotification kind="warning" title="企画履歴の一部を読み取れません" subtitle="表示されない企画は、共有リンクから直接開いてください。" hideCloseButton />}
            {index.projects.length > 0 && <ContainedList label="最近開いた企画" kind="on-page">{index.projects.map(project => <ContainedListItem key={project.roomId}><a className="project-list-item" href={openProject(project.roomId)} target="_blank" rel="noopener"><span className="project-list-item__copy"><strong>{project.name || '企画名未設定'}</strong><small>{formatProjectActivity(project)}</small></span><span className="project-list-item__id">別タブで開く</span></a></ContainedListItem>)}</ContainedList>}
          </section>}
        </Column>
      </Grid>
    </main>
  </Theme>;
}

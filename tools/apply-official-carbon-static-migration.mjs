import { readFile, writeFile } from 'node:fs/promises';

function replaceOnce(source, pattern, replacement, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Migration anchor not found: ${label}`);
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Migration did not change source: ${label}`);
  return next;
}

const indexPath = new URL('../index.html', import.meta.url);
let index = await readFile(indexPath, 'utf8');

const officialShellMarkup = `      <cds-header id="app-header" aria-label="サークル企画ツール">
        <cds-header-menu-button id="overviewMenuBtn" button-label-active="ナビゲーションを閉じる" button-label-inactive="ナビゲーションを開く"></cds-header-menu-button>
        <cds-header-name href="./">サークル企画ツール</cds-header-name>
        <div class="cds--header__global header-actions">
          <cds-icon-button id="shareLinkBtn" class="header-action share-action" kind="ghost" size="lg" align="bottom-right" aria-label="共有リンク">
            <span data-carbon-icon="link" slot="icon" aria-hidden="true"></span>
          </cds-icon-button>
          <div class="header-more">
            <cds-overflow-menu class="header-action header-app-switcher" kind="ghost" size="lg" label="アプリメニュー" aria-label="アプリメニュー" align="bottom-end" enable-v12-overflowmenu>
              <span class="app-switcher-icon" slot="icon" data-carbon-icon="switcher" aria-hidden="true"></span>
              <cds-menu class="header-overflow-body">
                <cds-menu-item id="userGuideBtn" label="使い方"><span data-carbon-icon="help" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                <cds-menu-item id="sampleDataBtn" label="サンプルデータ"><span data-carbon-icon="magic-wand" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                <cds-menu-item id="themeToggleBtn" label="ダークモードに切り替え" aria-pressed="false"><span data-carbon-icon="moon" data-state-icon="theme" data-icon-state="light" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
                <cds-menu-item id="editLockBtn" label="ロック"><span data-carbon-icon="unlocked" data-state-icon="editLock" data-icon-state="unlocked" slot="render-icon" aria-hidden="true"></span></cds-menu-item>
              </cds-menu>
            </cds-overflow-menu>
          </div>
        </div>
      </cds-header>
      <cds-side-nav id="overviewDrawer" is-not-persistent collapse-mode="responsive" aria-label="山歩会ツール">
        <cds-side-nav-items>
          <cds-side-nav-link href="https://script.google.com/macros/s/AKfycbw0R5VgBdSLS8aRDJDw7GUIEfHlXRZ6rPrOgjXmO2N7LvhuoGyS_opUCFTCSiUiDZw5/exec" target="_blank" rel="noopener noreferrer">山歩会フォームメーカー</cds-side-nav-link>
          <cds-side-nav-link href="https://github.com/mutoshiki/sampokai-submission-builder/releases" target="_blank" rel="noopener noreferrer">学務提出書類作成ツール</cds-side-nav-link>
          <cds-side-nav-link href="https://mutoshiki.github.io/sanpokai-kikaku-portal/" target="_blank" rel="noopener noreferrer">山歩会企画ツール一覧</cds-side-nav-link>
          <cds-side-nav-divider></cds-side-nav-divider>
          <cds-side-nav-link id="bugReportMenuItem" href="#bug-report">バグを報告する</cds-side-nav-link>
        </cds-side-nav-items>
      </cds-side-nav>
      <section id="projectTitleRegion" class="project-title-region" data-state="expanded" aria-label="企画名">
        <div class="project-title-content">
          <div class="app-room-field project-title-carbon-field">
            <cds-text-input id="roomNameInput" class="app-room-input" type="text" size="lg" label="企画名" hide-label placeholder="企画名を入力" autocomplete="off" aria-label="企画名"></cds-text-input>
          </div>
          <cds-tag id="syncStatusBadge" class="sync-status-badge" data-status="local" type="blue" size="sm" aria-live="polite"><span class="sync-status-label">ローカル保存</span></cds-tag>
        </div>
      </section>
      <div id="top-area">`;

index = replaceOnce(
  index,
  /      <header id="app-header">[\s\S]*?      <div id="top-area">/,
  officialShellMarkup,
  'official Carbon UI shell markup'
);

const carbonBatchHelpMarkup = `<cds-accordion id="batchImportHelpAccordion" class="batch-import-help-accordion" alignment="end" aria-label="スプレッドシート取り込みの説明">
<cds-accordion-item title="貼り付け方を見る">
<div class="batch-import-notice"><span aria-hidden="true" data-carbon-icon="information"></span><span>各項目の見出しの行も必ず一緒にコピーしてください。</span></div>
<div aria-label="Googleフォームの回答をスプレッドシートで表示する方法" class="form-sheet-howto">
<div class="form-sheet-howto-title">Googleフォームの回答をスプレッドシートで表示する方法</div>
<div class="form-sheet-howto-body">応募フォームの管理画面で「回答」を開き、右上の <span aria-hidden="true" class="form-sheet-icon"></span> 緑色のスプレッドシートアイコンを押すと、回答用スプレッドシートを作成できます。</div>
</div>
</cds-accordion-item>
<cds-accordion-item title="自動判定の仕組み">
<div class="batch-auto-simple">
<p class="batch-auto-lead">自動判定では、名前、学年または学籍番号、車出しの有無の3つを使います。列の順番は自由です。見出しと回答の文言から、それぞれの列を判定します。</p>
<div aria-label="自動判定に使う情報と読み取れる文言の例" class="batch-auto-table-wrap">
<cds-table class="batch-auto-rule-table" size="sm" aria-label="自動判定に使う情報と読み取れる文言の例">
<cds-table-head>
<cds-table-header-row>
<cds-table-header-cell>項目</cds-table-header-cell>
<cds-table-header-cell>名前</cds-table-header-cell>
<cds-table-header-cell>学年、または学籍番号</cds-table-header-cell>
<cds-table-header-cell>車出しの有無</cds-table-header-cell>
</cds-table-header-row>
</cds-table-head>
<cds-table-body>
<cds-table-row>
<cds-table-cell>質問名として読み取れる例</cds-table-cell>
<cds-table-cell>名前、氏名、お名前、参加者名、フルネーム、Name、name</cds-table-cell>
<cds-table-cell>学年、年、年次、grade、Grade、学籍番号、学生番号、学籍、番号、student id、studentId、id</cds-table-cell>
<cds-table-cell>車出し、車、運転、配車、車を出せる、車出し可、自家用車、driver、car</cds-table-cell>
</cds-table-row>
<cds-table-row>
<cds-table-cell>回答として読み取れる例</cds-table-cell>
<cds-table-cell>入力された名前</cds-table-cell>
<cds-table-cell>1、1年、1年生、一年、一年生、壱年、B1、学部1年、1回生など。2〜4年も同じ形式で判定できます。学籍番号の場合は、24T1234A、24t1234a、２４Ｔ１２３４Ａなど。</cds-table-cell>
<cds-table-cell>あり：true、1、yes、y、○、◯、〇、はい、する、出す、出せる、出せます、できます、出来ます、可能、可、車出し可、運転可、自家用車あり、車あり、あり、有<br/>なし：false、0、no、n、×、✕、x、いいえ、しない、出さない、出せない、出せません、できない、できません、出来ない、出来ません、不可、無理、車出し不可、運転不可、自家用車なし、車なし、なし、無し、無</cds-table-cell>
</cds-table-row>
<cds-table-row>
<cds-table-cell>補足</cds-table-cell>
<cds-table-cell>空欄の行は読み込み対象外です。同じ名前が複数行にある場合は、1人にまとまります。</cds-table-cell>
<cds-table-cell>学年がある場合は、その値を使います。学籍番号の場合は、先頭2桁を入学年度として学年を推定します。</cds-table-cell>
<cds-table-cell>同じ人に複数の回答がある場合は、車出しありを優先します。</cds-table-cell>
</cds-table-row>
</cds-table-body>
</cds-table>
</div>
</div>
</cds-accordion-item>
</cds-accordion>`;

index = replaceOnce(
  index,
  /<details class="batch-import-help-details">[\s\S]*?<\/details>\n<details class="batch-import-help-details batch-import-auto-details">[\s\S]*?<\/details>/,
  carbonBatchHelpMarkup,
  'Carbon accordion and data table for batch help'
);

const mainCarbonBundle = '    <script type="module" src="./assets/vendor/carbon/carbon-entry.min.js?v=carbon-ui-actions-v60"></script>';
if (!index.includes('./assets/vendor/carbon/ui-shell.min.js')) {
  index = replaceOnce(
    index,
    mainCarbonBundle,
    `    <script type="module" src="./assets/vendor/carbon/ui-shell.min.js?v=official-shell-v97"></script>\n${mainCarbonBundle}`,
    'self-hosted UI shell script'
  );
}
await writeFile(indexPath, index, 'utf8');

const headerEventsPath = new URL('../assets/js/features/events/02-static-header-events.js', import.meta.url);
let headerEvents = await readFile(headerEventsPath, 'utf8');

const officialHeaderOwner = `    function ensureCarbonShellHeader() {
        const header = byId('app-header');
        const roomInput = byId('roomNameInput');
        const region = byId('projectTitleRegion');
        if (!header || header.tagName !== 'CDS-HEADER' || !roomInput || !region) return;

        const roomField = roomInput.closest('.app-room-field');
        roomField?.classList.remove('project-title-source');
        roomField?.removeAttribute('aria-hidden');
        roomInput.removeAttribute('aria-hidden');
        roomInput.tabIndex = 0;
        region.dataset.state ||= 'expanded';

        const overflow = document.querySelector('.header-more cds-overflow-menu');
        if (overflow) {
            overflow.classList.add('header-app-switcher');
            overflow.setAttribute('label', 'アプリメニュー');
            overflow.setAttribute('aria-label', 'アプリメニュー');
            overflow.setAttribute('align', 'bottom-end');
        }
        global.SanpoCarbon?.renderCarbonIcons?.(header);
    }

    function readCurrentShellView() {`;

headerEvents = replaceOnce(
  headerEvents,
  /    function createCarbonShellIconButton[\s\S]*?    function readCurrentShellView\(\) \{/,
  officialHeaderOwner,
  'static header owner'
);

const carbonTitleReveal = `    function setProjectTitleExpanded(expanded) {
        const region = byId('projectTitleRegion');
        const roomInput = byId('roomNameInput');
        if (!region || !roomInput) return;
        const nextState = expanded ? 'expanded' : 'collapsed';
        if (region.dataset.state === nextState) return;
        if (!expanded && roomInput.matches?.(':focus-within')) roomInput.blur?.();
        region.dataset.state = nextState;
        roomInput.inert = !expanded;
        roomInput.tabIndex = expanded ? 0 : -1;
    }

    function getActiveProjectTitleScrollNodes() {`;

headerEvents = replaceOnce(
  headerEvents,
  /    function setProjectTitleExpanded[\s\S]*?    function getActiveProjectTitleScrollNodes\(\) \{/,
  carbonTitleReveal,
  'Carbon project title reveal'
);

const officialSideNavOwner = `    function setupAppNavigationDrawer() {
        const drawer = byId('overviewDrawer');
        const trigger = byId('overviewMenuBtn');
        if (!drawer || drawer.tagName !== 'CDS-SIDE-NAV' || !trigger) return;
        drawer.setAttribute('aria-label', '山歩会ツール');
        drawer.setAttribute('collapse-mode', 'responsive');
        drawer.setAttribute('is-not-persistent', '');
        trigger.setAttribute('aria-controls', 'overviewDrawer');
    }

    function setupStaticHeaderEvents() {`;

headerEvents = replaceOnce(
  headerEvents,
  /    function createAppNavigationDrawer[\s\S]*?    function setupStaticHeaderEvents\(\) \{/,
  officialSideNavOwner,
  'official Carbon side navigation owner'
);

await writeFile(headerEventsPath, headerEvents, 'utf8');

console.log('Applied official Carbon static UI migration.');

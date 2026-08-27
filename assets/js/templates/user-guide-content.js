// User guide content.
// Every image is cropped from the real mobile interface; explanatory copy follows the current interaction model.
window.SanpoUserGuideContent = `
  <article class="user-manual" aria-labelledby="userGuideModalTitle">
    <header class="user-manual-intro">
      <p>参加者の選択、車割、班割、精算を上部の4つのタブから行います。</p>
      <figure class="user-manual-figure user-manual-figure--header">
        <img src="./assets/images/user-guide/01-navigation.webp" alt="スマホ画面上部のメインタブとメニュー" width="390" height="250">
        <figcaption>参加者 → 車割 → 班割 → 精算の順に操作します。</figcaption>
      </figure>
    </header>

    <nav class="user-manual-nav" aria-label="使い方の目次">
      <a href="#manual-register">参加者</a>
      <a href="#manual-car">車割</a>
      <a href="#manual-team">班割</a>
      <a href="#manual-share">共有</a>
      <a href="#manual-settlement">精算</a>
    </nav>

    <section id="manual-register" class="user-manual-section">
      <div class="user-manual-heading"><span>1</span><h2>参加者を決める</h2></div>
      <p>「参加者」タブで応募者を確認し、企画に参加する人を選びます。手動で追加する場合もこの画面から行います。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/02-participant-import.webp" alt="スマホの参加者画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-car" class="user-manual-section">
      <div class="user-manual-heading"><span>2</span><h2>車割を作る</h2></div>
      <p>「車割」タブで各車の空席に参加者を追加します。全体を作り直したいときは「ランダム割り当て」を押すだけで、ロックしていない参加者をランダムに配置できます。</p>
      <p>各参加者のメニューから「運転手にする／運転手を外す」を切り替えられます。運転手は1台に複数人設定でき、運転手タグが付いた人は車内の上側に並びます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/03-car-allocation.webp" alt="スマホの車割画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-team" class="user-manual-section">
      <div class="user-manual-heading"><span>3</span><h2>班割を作る</h2></div>
      <p>「班割」タブは車割とは別の画面です。空席から参加者を追加し、必要なら「ランダム割り当て」で全体を作り直します。</p>
      <p>班長も参加者メニューからオン・オフできます。複数人に設定でき、班長タグが付いた参加者は班内の上側に並びます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/04-team-allocation.webp" alt="スマホの班割画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-share" class="user-manual-section">
      <div class="user-manual-heading"><span>4</span><h2>企画を共有する</h2></div>
      <p>右上の共有ボタンは、車割・班割専用の特別画面ではなく通常の企画ルームのリンクをコピーします。同じリンクから参加者、車割、班割、精算へ移動できます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/05-shared-screen.webp" alt="スマホで企画ルームを共有する画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-settlement" class="user-manual-section">
      <div class="user-manual-heading"><span>5</span><h2>精算する</h2></div>
      <p>「精算」タブで端数処理や車ごとの費用を設定し、集金額と運転手への支払いを確認します。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/07-settlement-settings.webp" alt="スマホの精算設定画面" width="390" height="844">
      </figure>

      <h3>車ごとの費用</h3>
      <p>各車の「編集」から距離・燃費・単価・高速代などを入力します。必要ならレンタカー料金も追加できます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/08-car-cost.webp" alt="スマホの車ごとの費用入力画面" width="390" height="844">
      </figure>

      <h3>結果</h3>
      <p>合計、運転手への支払い、集金状況を確認します。「精算メモをコピー」で連絡用の文章をコピーできます。</p>
      <div class="user-manual-media-stack">
        <figure class="user-manual-figure">
          <img loading="lazy" src="./assets/images/user-guide/10-settlement-summary.webp" alt="スマホの精算結果上部" width="390" height="844">
        </figure>
        <figure class="user-manual-figure">
          <img loading="lazy" src="./assets/images/user-guide/11-settlement-checks.webp" alt="スマホの集金チェックと精算メモ" width="390" height="844">
        </figure>
      </div>
    </section>

    <section id="manual-save" class="user-manual-section">
      <div class="user-manual-heading"><span>6</span><h2>保存と同期</h2></div>
      <p>変更は自動保存されます。共有同期中なら同じ企画リンクを別の端末で開いて続きから操作できます。</p>
    </section>
  </article>
`;

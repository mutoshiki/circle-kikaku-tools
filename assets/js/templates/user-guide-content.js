// User guide content.
// Every image is cropped from the real 390px-wide mobile interface.
window.SanpoUserGuideContent = `
  <article class="user-manual" aria-labelledby="userGuideModalTitle">
    <header class="user-manual-intro">
      <p>参加者登録から車割・班割、共有、精算までをまとめて行えます。</p>
      <figure class="user-manual-figure user-manual-figure--header">
        <img src="./assets/images/user-guide/01-navigation.webp" alt="スマホ画面上部の画面切り替え、ロック、共有、メニュー" width="390" height="250">
        <figcaption>上部のタブと右上のボタンから操作します。</figcaption>
      </figure>
    </header>

    <nav class="user-manual-nav" aria-label="使い方の目次">
      <a href="#manual-register">登録</a>
      <a href="#manual-car">車割</a>
      <a href="#manual-team">班割</a>
      <a href="#manual-share-view">共有</a>
      <a href="#manual-overview">予定</a>
      <a href="#manual-settlement">精算</a>
    </nav>

    <section id="manual-register" class="user-manual-section">
      <div class="user-manual-heading"><span>1</span><h2>参加者を登録する</h2></div>
      <p>「車割・班割」から「参加者登録」を開きます。フォーム回答は見出し行ごと貼り付け、「読み込む」→内容確認→「登録内容で更新」の順です。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/02-participant-import.webp" alt="スマホの参加者登録画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-car" class="user-manual-section">
      <div class="user-manual-heading"><span>2</span><h2>車割を作る</h2></div>
      <p>車出しにした人ごとに車が作られます。未割り当ての人をドラッグするか、「空席」「ランダム」で自動配置します。固定した人は動きません。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/03-car-allocation.webp" alt="スマホの車割画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-team" class="user-manual-section">
      <div class="user-manual-heading"><span>3</span><h2>班割を作る</h2></div>
      <p>「班割」に切り替え、班長と班員をドラッグして配置します。定員、自動配置、固定の使い方は車割と同じです。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/04-team-allocation.webp" alt="スマホの班割画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-share-view" class="user-manual-section">
      <div class="user-manual-heading"><span>4</span><h2>共有画面を整える</h2></div>
      <p>車割・班割・タイムテーブルが参加者向けに表示されます。右下の鉛筆から直し、「完了」で保存します。表は横に動かしたり、ピンチで拡大できます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/05-shared-screen.webp" alt="スマホの共有画面" width="390" height="844">
      </figure>
    </section>

    <section id="manual-overview" class="user-manual-section">
      <div class="user-manual-heading"><span>5</span><h2>予定を入れて共有する</h2></div>
      <p>「概要」でメモとタイムテーブルを編集します。タイムテーブルは共有画面にも表示されます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/06-overview.webp" alt="スマホの概要画面" width="390" height="844">
      </figure>
      <p class="user-manual-followup">内容ができたら、右上の鍵で編集をロックし、共有ボタンからリンクをコピーします。</p>
    </section>

    <section id="manual-settlement" class="user-manual-section">
      <div class="user-manual-heading"><span>6</span><h2>精算する</h2></div>
      <p>最初に端数処理などを設定します。車割を使わない企画は「人数だけで精算する」を選びます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/07-settlement-settings.webp" alt="スマホの精算設定画面" width="390" height="844">
      </figure>

      <h3>車ごとの費用</h3>
      <p>各車の「編集」から距離・燃費・単価・高速代などを入力します。必要ならレンタカー料金も追加できます。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/08-car-cost.webp" alt="スマホの車ごとの費用入力画面" width="390" height="844">
      </figure>

      <h3>移動距離</h3>
      <p>移動距離計算ツールからGoogleマップを開き、往復距離を確認します。自宅住所ではなく、近くの施設などを使います。</p>
      <figure class="user-manual-figure">
        <img loading="lazy" src="./assets/images/user-guide/09-route-helper.webp" alt="スマホの移動距離計算ツール" width="390" height="844">
      </figure>

      <h3>結果</h3>
      <p>合計、ドライバーへの支払い、集金状況を確認します。「精算メモをコピー」で連絡用の文章をコピーできます。</p>
      <div class="user-manual-media-stack">
        <figure class="user-manual-figure">
          <img loading="lazy" src="./assets/images/user-guide/10-settlement-summary.webp" alt="スマホの精算結果上部" width="390" height="844">
        </figure>
        <figure class="user-manual-figure">
          <img loading="lazy" src="./assets/images/user-guide/11-settlement-checks.webp" alt="スマホの支払いチェックと共有用テキスト" width="390" height="844">
        </figure>
      </div>
    </section>

    <section id="manual-save" class="user-manual-section">
      <div class="user-manual-heading"><span>7</span><h2>保存と復元</h2></div>
      <p>変更はこの端末に自動保存されます。共有同期中なら、同じリンクを別の端末で開いて続きから使えます。履歴やリセットは右上のメニューにあります。</p>
    </section>
  </article>
`;

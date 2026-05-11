// Guide content templates
// Keeps long guide markup out of index.html while preserving the existing rendered HTML.

window.SanpoGuideTemplates = {
  global: `            <div class="guide-step-nav">
              <button class="guide-step-btn active" data-guide="global" data-step="0">登録</button>
              <button class="guide-step-btn" data-guide="global" data-step="1">車割</button>
              <button class="guide-step-btn" data-guide="global" data-step="2">共有・精算</button>
            </div>
            <div class="guide-step-panel" data-guide="global" data-panel="0" style="display:none;">
              <h6 class="guide-step-title">① 全体の流れを確認する</h6>
              <p class="guide-page-lead">このサイトは、車割メーカー・車割発表ビュー・精算ツールの3画面で使います。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card guide-feature-wide">
                  <div class="guide-feature-title"><i class="fas fa-layer-group me-2" aria-hidden="true"></i>3つの画面</div>
                  <div class="guide-mini-screen">
                    <div class="guide-mini-toolbar">
                      <div class="guide-mini-tool guide-mini-primary">車割メーカー</div>
                      <div class="guide-mini-tool">発表ビュー</div>
                      <div class="guide-mini-tool">精算ツール</div>
                    </div>
                    <div class="guide-mini-sheet">
                      <div class="head">登録</div><div class="head">確認</div><div class="head">会計</div>
                      <div>参加者<br>車出し</div><div>車ごとの<br>一覧</div><div>集金<br>支払い</div>
                    </div>
                  </div>
                  <p class="guide-short-text">編集、確認、会計を分けて使います。</p>
                </div>
                <div class="guide-feature-card">
                  <div class="guide-feature-title"><i class="fas fa-users me-2" aria-hidden="true"></i>登録</div>
                  <div class="guide-mini-screen"><div class="guide-copy-mock">Googleフォーム<br>↓<br>参加者登録</div></div>
                  <p class="guide-short-text">参加者と車出しを登録します。</p>
                </div>
                <div class="guide-feature-card">
                  <div class="guide-feature-title"><i class="fas fa-pen-to-square me-2" aria-hidden="true"></i>後から編集</div>
                  <div class="guide-mini-screen"><div class="guide-edit-card-mock"><div class="guide-edit-field"><span>名前</span><strong>山本 花<span class="typing-caret">|</span></strong></div><div class="guide-edit-field compact"><span>学年</span><em>1年</em></div><div class="guide-edit-actions"><button>保存</button><button class="ghost">削除</button></div></div></div>
                  <p class="guide-short-text">参加者登録から、あとで追加・削除・修正できます。</p>
                </div>
              </div>
            </div>
            <div class="guide-step-panel" data-guide="global" data-panel="1" style="display:none;">
              <h6 class="guide-step-title">② 車割を作って確認する</h6>
              <p class="guide-page-lead">車割メーカーで配置を作り、発表ビューで見え方を確認します。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-shuffle me-2" aria-hidden="true"></i>車割メーカー</div><div class="guide-mini-screen"><div class="guide-action-row"><div class="guide-action-box"><i class="fas fa-fill-drip" aria-hidden="true"></i>空席を埋める</div><div class="guide-action-box primary"><i class="fas fa-shuffle" aria-hidden="true"></i>自動割当</div></div></div><p class="guide-short-text">自動割当と手動調整で車割を作ります。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-table-list me-2" aria-hidden="true"></i>発表ビュー</div><div class="guide-mini-screen"><div class="guide-mini-sheet"><div class="head">車</div><div class="head">車出し</div><div class="head">同乗者</div><div>田中車</div><div>田中</div><div>山本・佐藤</div><div>高橋車</div><div>高橋</div><div>鈴木・中村</div></div></div><p class="guide-short-text">未配置や定員超過がないか確認します。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-lock me-2" aria-hidden="true"></i>共有前のロック</div><div class="guide-mini-screen"><div class="guide-copy-mock"><i class="fas fa-lock" aria-hidden="true"></i> ロック中<br>編集・精算を保護</div></div><p class="guide-short-text">共有前にロックすると、参加者には発表ビューを見せたまま、編集画面や精算画面を開きにくくできます。</p></div>
              </div>
            </div>
            <div class="guide-step-panel" data-guide="global" data-panel="2" style="display:none;">
              <h6 class="guide-step-title">③ 共有し、必要なら精算する</h6>
              <p class="guide-page-lead">共有リンクを案内し、車ごとの費用から集金額と支払い額を確認します。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-link me-2" aria-hidden="true"></i>共有</div><div class="guide-mini-screen"><div class="guide-copy-mock">共有リンクをコピー<br>LINEなどに貼り付け</div></div><p class="guide-short-text">参加者は発表ビューで車割を確認できます。</p></div>
                <div class="guide-feature-card guide-feature-wide"><div class="guide-feature-title"><i class="fas fa-yen-sign me-2" aria-hidden="true"></i>精算</div><div class="guide-mini-screen seisan-guide-summary-screen"><div class="seisan-mock-flow"><div class="seisan-mock-summary collect"><div class="seisan-mock-label">集める</div><div class="seisan-mock-value">¥2,400</div></div><div class="seisan-mock-summary account"><div class="seisan-mock-label">部費負担</div><div class="seisan-mock-value">¥300</div></div><div class="seisan-mock-summary pay"><div class="seisan-mock-label">支払い</div><div class="seisan-mock-value">¥9,800</div></div></div></div><p class="guide-short-text">車割の参加者と車出しを使って、集金額・部費負担・車出しに渡す額を計算します。</p></div>
              </div>
            </div>
          </div>`,
  car: `            <div class="guide-step-nav">
              <button class="guide-step-btn active" data-guide="car" data-step="0">登録</button>
              <button class="guide-step-btn" data-guide="car" data-step="1">割当</button>
              <button class="guide-step-btn" data-guide="car" data-step="2">調整・発表</button>
            </div>
            <div class="guide-step-panel" data-guide="car" data-panel="0" style="display:none;">
              <h6 class="guide-step-title">① 参加者と車出しを登録する</h6>
              <p class="guide-page-lead">Googleフォームの回答や名簿を貼り付け、参加者と車出しを登録します。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card guide-feature-wide">
                  <div class="guide-feature-title"><i class="fas fa-table me-2" aria-hidden="true"></i>名簿から登録</div>
                  <div class="guide-compare-ui-grid">
                    <div class="guide-ui-card mock-sheet-app">
                      <div class="mock-sheet-top"><span class="dot green"></span><span>Googleスプレッドシート</span></div>
                      <div class="mock-sheet-toolbar"><span>学年順</span><span class="active">車出し順</span></div>
                      <div class="mock-sheet-table realistic">
                        <div class="head">名前</div><div class="head">学年</div><div class="head">車出し</div>
                        <div>田中 太郎</div><div>1年</div><div>可</div>
                        <div>山本 花子</div><div>1年</div><div>不可</div>
                        <div>佐藤 健</div><div>2年</div><div>不可</div>
                      </div>
                    </div>
                    <div class="guide-compare-arrow"><i class="fas fa-arrow-right" aria-hidden="true"></i></div>
                    <div class="guide-ui-card mock-register-ui">
                      <div class="mock-register-head"><i class="fas fa-users" aria-hidden="true"></i><span>参加者登録</span><button>登録</button></div>
                      <div class="mock-register-grid">
                        <div class="driver"><small>車出し</small><p>田中 太郎<br>定員 4人</p></div>
                        <div><small>参加者</small><p>山本 花子<br>1年</p></div>
                        <div><small>参加者</small><p>佐藤 健<br>2年</p></div>
                        <div><small>あとから編集</small><p>追加・削除・修正</p></div>
                      </div>
                    </div>
                  </div>
                  <p class="guide-short-text">学年や車出しの有無で並べてから貼り付けると、貼り付け後の確認や修正がしやすくなります。</p>
                </div>
                <div class="guide-feature-card">
                  <div class="guide-feature-title"><i class="fas fa-car-side me-2" aria-hidden="true"></i>車出し</div>
                  <div class="guide-mini-screen"><div class="guide-mini-car"><div class="guide-mini-car-head"><span>田中車</span><span>定員 4人 <i class="fas fa-pen" aria-hidden="true"></i></span></div><div class="guide-mini-grid"><div class="driver-seat" data-gender="male"><div class="driver-main-line"><span class="driver-name-disp">田中</span><span class="grade-badge" data-grade="1">1年</span><span>⋮</span></div></div><div class="seat-slot"></div><div class="seat-slot"></div><div class="seat-slot"></div></div></div></div>
                  <p class="guide-short-text">車出しできる人を登録すると車カードが作られます。定員はあとから車カードで変更できます。</p>
                </div>
                <div class="guide-feature-card">
                  <div class="guide-feature-title"><i class="fas fa-pen-to-square me-2" aria-hidden="true"></i>登録後の修正</div>
                  <div class="guide-mini-screen"><div class="guide-edit-card-mock"><div class="guide-edit-field"><span>名前</span><strong>山本 花<span class="typing-caret">|</span></strong></div><div class="guide-edit-field compact"><span>学年</span><em>1年</em></div><div class="guide-edit-actions"><button>保存</button><button class="ghost">削除</button></div></div></div>
                  <p class="guide-short-text">参加者登録を開くと、あとから名前・学年の修正、追加、削除ができます。</p>
                </div>
              </div>
            </div>
            <div class="guide-step-panel" data-guide="car" data-panel="1" style="display:none;">
              <h6 class="guide-step-title">② 条件を決めて自動割当する</h6>
              <p class="guide-page-lead">下の設定で条件を決めてから、自動割当を使います。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-shuffle me-2" aria-hidden="true"></i>割当</div><div class="guide-mini-screen"><div class="guide-action-row"><div class="guide-action-box"><i class="fas fa-fill-drip" aria-hidden="true"></i>空席を埋める</div><div class="guide-action-box primary"><i class="fas fa-shuffle" aria-hidden="true"></i>自動割当</div></div></div><p class="guide-short-text">既に決めた配置を残す場合は「空席を埋める」、作り直す場合は「自動割当」を使います。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-sliders me-2" aria-hidden="true"></i>割当設定</div><div class="guide-mini-screen"><div class="guide-mini-form"><div class="field">設定 → 女子をまとめる：ON</div><div class="field">男子をまとめる：OFF</div><div class="field">学年をまとめる：ON</div></div></div><p class="guide-short-text">女子・男子・学年をまとめたい場合だけ、条件をオンにします。条件をすべて外すとランダムに近い形で割り当てます。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-lock me-2" aria-hidden="true"></i>固定</div><div class="guide-mini-screen"><div class="guide-mini-car"><div class="guide-mini-car-head"><span>高橋車</span><span>2/4</span></div><div class="guide-mini-grid"><div class="guide-mini-card" data-gender="female">山本 <span class="grade-badge" data-grade="1">1年</span> <i class="fas fa-lock" aria-hidden="true"></i></div><div class="guide-mini-card" data-gender="male">佐藤 <span class="grade-badge" data-grade="2">2年</span></div></div></div></div><p class="guide-short-text">配置を変えたくない人は固定します。固定した人はそのまま残し、ほかの人だけ組み直せます。</p></div>
              </div>
            </div>
            <div class="guide-step-panel" data-guide="car" data-panel="2" style="display:none;">
              <h6 class="guide-step-title">③ 手動で整えて発表ビューを確認する</h6>
              <p class="guide-page-lead">自動割当のあと、必要なところだけ手動で調整します。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card guide-feature-wide">
                  <div class="guide-feature-title"><i class="fas fa-hand-pointer me-2" aria-hidden="true"></i>長押しで移動</div>
                  <div class="guide-mini-screen">
                    <div class="guide-mini-car">
                      <div class="guide-mini-car-head"><span>高橋車</span><span>3/4</span></div>
                      <div class="guide-mini-grid">
                        <div class="driver-seat" data-gender="male"><div class="driver-main-line"><span class="driver-name-disp">高橋</span><span class="grade-badge" data-grade="3">3年</span><span>⋮</span></div></div>
                        <div class="guide-mini-card" data-gender="male"><i class="fas fa-hand-pointer" aria-hidden="true"></i> 田中 <span class="grade-badge" data-grade="1">1年</span></div>
                        <div class="guide-mini-card" data-gender="female">山本 <span class="grade-badge" data-grade="2">2年</span></div>
                        <div class="seat-slot"></div>
                      </div>
                    </div>
                  </div>
                  <p class="guide-short-text">長押しでカードを移動できます。</p>
                </div>
                <div class="guide-feature-card">
                  <div class="guide-feature-title"><i class="fas fa-user-clock me-2" aria-hidden="true"></i>待機メンバー</div>
                  <div class="guide-mini-screen"><div class="guide-copy-mock">未配置の人<br>あとから車へ移動</div></div>
                  <p class="guide-short-text">定員不足などで入らなかった人は、待機メンバーに残ります。</p>
                </div>
                <div class="guide-feature-card">
                  <div class="guide-feature-title"><i class="fas fa-table-list me-2" aria-hidden="true"></i>発表ビュー</div>
                  <div class="guide-mini-screen">
                    <div class="guide-mini-sheet">
                      <div class="head">車</div><div class="head">車出し</div><div class="head">同乗者</div>
                      <div>高橋車</div><div>高橋</div><div>田中・山本</div>
                      <div>中村車</div><div>中村</div><div>佐藤・鈴木</div>
                    </div>
                  </div>
                  <p class="guide-short-text">未配置・定員超過・待機人数を確認します。細かく直すときは、クイック編集も使えます。</p>
                </div>
              </div>
            </div>
          </div>`,
  seisan: `            <div class="guide-step-nav">
              <button class="guide-step-btn active" data-guide="seisan" data-step="0">入力</button>
              <button class="guide-step-btn" data-guide="seisan" data-step="1">確認</button>
              <button class="guide-step-btn" data-guide="seisan" data-step="2">記録</button>
            </div>
            <div class="guide-step-panel" data-guide="seisan" data-panel="0" style="display:none;">
              <h6 class="guide-step-title">① 車ごとの費用を入力する</h6>
              <p class="guide-page-lead">先に車割を登録しておくと、車出しと参加者が精算に反映されます。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-route me-2" aria-hidden="true"></i>移動距離</div><div class="guide-mini-screen"><div class="route-guide-mock"><div><i class="fas fa-location-dot" aria-hidden="true"></i> 目的地・経由地</div><div><i class="fas fa-map-location-dot" aria-hidden="true"></i> Googleマップで往復距離を確認</div><button type="button">距離を確認する</button></div></div><p class="guide-short-text">移動距離計算からGoogleマップを開き、確認した往復距離を車ごとの距離に入力します。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-gas-pump me-2" aria-hidden="true"></i>ガソリン代</div><div class="guide-mini-screen"><div class="seisan-mock-car"><div class="seisan-mock-car-head"><span>佐藤車</span><span class="seisan-mock-car-total">¥5,560</span></div><div class="seisan-mock-car-inputs"><div class="seisan-mock-row"><small>往復距離</small><strong>180km</strong></div><div class="seisan-mock-row"><small>燃費</small><strong>15km/L</strong></div><div class="seisan-mock-row"><small>単価</small><strong>180円/L</strong></div></div></div></div><p class="guide-short-text">往復の移動距離・燃費・ガソリン単価から、車出しに渡すガソリン代を計算します。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-receipt me-2" aria-hidden="true"></i>諸経費</div><div class="guide-mini-screen"><div class="seisan-mock-expenses"><div class="seisan-mock-expense"><span>高速代</span><strong>¥2,000</strong><span class="seisan-mock-chip split">割り勘</span></div><div class="seisan-mock-expense"><span>駐車場</span><strong>¥500</strong><span class="seisan-mock-chip club">部費</span></div></div></div><p class="guide-short-text">高速代は割り勘、駐車場代は部費負担など、費目ごとに選べます。</p></div>
              </div>
            </div>
            <div class="guide-step-panel" data-guide="seisan" data-panel="1" style="display:none;">
              <h6 class="guide-step-title">② 集金額と支払い額を確認する</h6>
              <p class="guide-page-lead">端数処理、車出し協力代、企画者の扱いを確認します。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-sliders me-2" aria-hidden="true"></i>精算設定</div><div class="guide-mini-screen"><div class="seisan-mock-settings"><div class="seisan-mock-field"><small>端数処理</small><strong>100円</strong></div><div class="seisan-mock-field"><small>車出し協力代</small><strong>¥1,000/台</strong></div><div class="seisan-mock-toggle"><span>企画者を集金対象から外す</span><span class="seisan-mock-switch"></span></div></div></div><p class="guide-short-text">車出し協力代は、車を出した人への上乗せ分として計算されます。</p></div>
                <div class="guide-feature-card guide-feature-wide"><div class="guide-feature-title"><i class="fas fa-yen-sign me-2" aria-hidden="true"></i>計算結果</div><div class="guide-mini-screen seisan-guide-summary-screen"><div class="seisan-mock-flow"><div class="seisan-mock-summary collect"><div class="seisan-mock-label">集める</div><div class="seisan-mock-value">¥2,400</div></div><div class="seisan-mock-summary account"><div class="seisan-mock-label">部費負担</div><div class="seisan-mock-value">¥300</div></div><div class="seisan-mock-summary pay"><div class="seisan-mock-label">支払い</div><div class="seisan-mock-value">¥9,800</div></div></div></div><p class="guide-short-text">集める＝参加者1人あたりの集金額、部費負担＝会計側の負担、支払い＝車出しに渡す合計額です。</p></div>
              </div>
            </div>
            <div class="guide-step-panel" data-guide="seisan" data-panel="2" style="display:none;">
              <h6 class="guide-step-title">③ 集金と支払いを記録する</h6>
              <p class="guide-page-lead">集金状況と車出しへの支払い状況を残します。</p>
              <div class="guide-card-grid-three compact-guide-grid">
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-clipboard-check me-2" aria-hidden="true"></i>集金チェック</div><div class="guide-mini-screen"><div class="seisan-mock-checks"><div class="seisan-mock-check done"><span class="seisan-mock-box-check"><i class="fas fa-check" aria-hidden="true"></i></span><span class="seisan-mock-check-name">田中</span><span class="seisan-mock-amount">集金済み</span></div><div class="seisan-mock-check"><span class="seisan-mock-box-check"></span><span class="seisan-mock-check-name">山本</span><span class="seisan-mock-amount">未回収</span></div></div></div><p class="guide-short-text">集金した人にチェックを入れます。集金対象外の人や待機の人は注記を確認します。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-hand-holding-yen me-2" aria-hidden="true"></i>支払いチェック</div><div class="guide-mini-screen"><div class="seisan-mock-driver-list"><div class="seisan-mock-driver-pay done"><span class="seisan-mock-box-check"><i class="fas fa-check" aria-hidden="true"></i></span><span class="seisan-mock-driver-name">佐藤へ</span><span class="seisan-mock-amount">¥5,560</span></div><div class="seisan-mock-driver-pay"><span class="seisan-mock-box-check"></span><span class="seisan-mock-driver-name">鈴木へ</span><span class="seisan-mock-amount">¥4,980</span></div></div></div><p class="guide-short-text">車出しに渡したら、その人の行にチェックを入れます。</p></div>
                <div class="guide-feature-card"><div class="guide-feature-title"><i class="fas fa-copy me-2" aria-hidden="true"></i>共有用テキスト</div><div class="guide-mini-screen"><div class="guide-copy-mock">精算メモ<br>内訳つき<br>コピー</div></div><p class="guide-short-text">諸経費の内訳と部費・割勘の扱いまでまとめてコピーできます。</p></div>
              </div>
            </div>
          </div>`
};

function mountGuideTemplates(root = document) {
    const templates = window.SanpoGuideTemplates || {};
    Object.entries(templates).forEach(([guide, html]) => {
        const target = root.querySelector(`.unified-guide-body[data-guide-root="${guide}"]`);
        if (!target || target.dataset.templateMounted === "true") return;
        target.innerHTML = html;
        target.dataset.templateMounted = "true";
    });
}

window.mountGuideTemplates = mountGuideTemplates;
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mountGuideTemplates());
} else {
    mountGuideTemplates();
}

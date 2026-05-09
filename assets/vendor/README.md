# サークル企画ルーム

サークルの企画で使える、車割作成・発表・精算をまとめたWebツールです。
参加者登録、車割、共有、ガソリン代や部費負担を含む精算まで、スマホで扱いやすいようにしています。

現在は Bootstrap、Font Awesome、Sortable をCDNから読み込んでいます。

完全オフライン対応にする場合は、ここに以下を配置し、`index.html` のCDNリンクをローカル参照へ変更してください。

- bootstrap.bundle.min.js
- bootstrap.min.css
- all.min.css または必要なFont Awesome subset
- Sortable.min.js

今回の修正では、CDNが落ちたときに警告クラスをbodyへ付ける最低限の検知だけ入れています。

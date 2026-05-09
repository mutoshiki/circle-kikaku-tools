# Vendor files

現在は Bootstrap、Font Awesome、Sortable をCDNから読み込んでいます。

完全オフライン対応にする場合は、ここに以下を配置し、`index.html` のCDNリンクをローカル参照へ変更してください。

- bootstrap.bundle.min.js
- bootstrap.min.css
- all.min.css または必要なFont Awesome subset
- Sortable.min.js

今回の修正では、CDNが落ちたときに警告クラスをbodyへ付ける最低限の検知だけ入れています。

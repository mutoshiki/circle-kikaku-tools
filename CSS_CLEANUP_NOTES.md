# CSS cleanup notes

今回の安全な削減では、最後に読み込まれる `99-final-overrides.css` を中心に `!important` を削減しました。

- 変更前の `99-final-overrides.css` 内 `!important`: 55
- 変更後の `99-final-overrides.css` 内 `!important`: 13

全体の古いCSS削除は、実機確認しながら進める必要があります。特にテーマ系とスマホ調整系は重複して見えても、後方互換のために残っている指定があります。

# ローカルvendor方針

GitHub Pagesがリポジトリ内の静的ファイルを直接配信できるよう、ブラウザ実行時は外部CDNへ依存しない。

- SortableJS 1.15.0はドラッグ操作用にローカル配置する。BootstrapとFont AwesomeはCarbon全面移行後に削除済み。
- Carbon Web Components 2.60.0とCarbon Icons 11.85.0は、`assets/js/carbon-entry.js`を`npm run build:carbon`でbundleし、`carbon/carbon-entry.min.js`へ生成する。
- IBM Plex Sans 1.1.0／IBM Plex Sans JP 3.0.0は、使用するRegularとSemiBoldだけを配信する。日本語は公式unicode-range splitを使い、全字形を維持しつつ必要なsubsetだけを取得する。
- 生成物とライセンスをこのdirectoryに保持するため、GitHub Pages上で`node_modules`やbare module specifierは不要。

Carbon関連packageのversionを変更した場合は、lockfile更新後に`npm run build:carbon`を実行し、生成差分をVisual Regressionで承認する。

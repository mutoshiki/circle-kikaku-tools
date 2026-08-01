# ローカルvendor方針

GitHub Pagesがリポジトリ内の静的ファイルを直接配信できるよう、ブラウザ実行時は外部CDNへ依存しない。

- Bootstrap 5.3.0、Font Awesome 6.4.0、SortableJS 1.15.0は移行完了まで従来どおりローカル配置する。
- Carbon Web Components 2.60.0とCarbon Icons 11.85.0は、`assets/js/carbon-entry.js`を`npm run build:carbon`でbundleし、`carbon/carbon-entry.min.js`へ生成する。
- IBM Plex Sans 1.1.0／IBM Plex Sans JP 3.0.0は、RegularとSemiBoldのWOFF2を`ibm-plex/fonts/`へコピーし、`ibm-plex/plex.css`から読む。
- 生成物とライセンスをこのdirectoryに保持するため、GitHub Pages上で`node_modules`やbare module specifierは不要。

Carbon関連packageのversionを変更した場合は、lockfile更新後に`npm run build:carbon`を実行し、生成差分をVisual Regressionで承認する。

---
name: sync
description: "Switch to main branch and pull latest changes."
disable-model-invocation: true
allowed-tools: "Bash(git)"
---

# Sync: main に戻って最新を取得

1. 未コミットの変更がないか確認（あれば警告）
2. `git checkout main`
3. `git pull origin main`

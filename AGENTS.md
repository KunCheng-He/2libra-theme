# AGENTS.md

## 浏览器自动化规则（强制）

- 本项目进行浏览器自动化（调试 / 测试扩展）时，**只能通过 Playwright 以 CDP 方式连接用户已开启远程调试的 Brave 浏览器**（`playwright-cli attach --cdp=http://localhost:<端口>`，端口以用户实际暴露的为准）。
- **禁止下载 / 安装任何新浏览器**：不得执行 `playwright install`（chromium/firefox/webkit 等）、不得使用 `playwright-cli open` 启动 Playwright 自带浏览器、不得使用 `--browser=` / `--channel=` 启动本地其他浏览器。
- 需要浏览器环境时，一律先确认用户的 Brave CDP 端点可用；连接后使用 `tab-new` / `goto` 等在既有浏览器内操作，测试结束用 `detach` 断开（保留用户浏览器运行），不要 `close` 用户的浏览器。

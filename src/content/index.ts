import { engine } from "./engine/engine";

// document_start：documentElement 已存在，尽早启动（内部自行等待 storage）
if (document.documentElement) {
  void engine.boot();
} else {
  document.addEventListener("readystatechange", () => void engine.boot(), { once: true });
}

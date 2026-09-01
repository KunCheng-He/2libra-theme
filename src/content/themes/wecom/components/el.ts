type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | boolean | number | ((e: Event) => void) | undefined>;

/** 轻量 DOM 构建器 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue;
      if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      } else if (k === "class") {
        node.className = String(v);
      } else if (k === "style" && typeof v === "string") {
        node.setAttribute("style", v);
      } else if (v === true) {
        node.setAttribute(k, "");
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  append(node, ...children);
  return node;
}

export function append(parent: Element, ...children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(node: Element) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** 事件委托 */
export function on<K extends keyof HTMLElementEventMap>(
  node: Element,
  type: K,
  fn: (e: HTMLElementEventMap[K]) => void,
) {
  node.addEventListener(type, fn as EventListener);
}

import type { NodeGroup } from "../../../../shared/types";
import { el, clear, on } from "./el";
import { icon } from "./ui";

export interface NewChatCallbacks {
  onClose(): void;
  onSubmit(input: { title: string; content: string; node_id: string }): void;
}

export function renderNewChat(
  root: ShadowRoot,
  nodes: NodeGroup[],
  cb: NewChatCallbacks,
): { focus(): void } {
  let overlay = root.querySelector(".wc-overlay[data-newchat]");
  if (overlay) overlay.remove();

  overlay = el("div", { class: "wc-overlay", "data-newchat": "" });
  const dialog = el("div", { class: "wc-dialog" });

  // head
  const head = el("div", { class: "wc-dialog-head" }, "发起群聊");
  const closeBtn = el("button", { class: "wc-icon-btn", type: "button" });
  closeBtn.append(icon("close"));
  on(closeBtn, "click", cb.onClose);
  head.append(closeBtn);

  // body
  const body = el("div", { class: "wc-dialog-body" });

  // 左：节点树
  const left = el("div", { class: "wc-nc-left" });
  const search = el("div", { class: "wc-nc-search" });
  search.append(icon("search"));
  const filterInput = document.createElement("input");
  filterInput.placeholder = "搜索节点";
  search.append(filterInput);
  left.append(search);

  const tree = el("div", {});
  left.append(tree);

  let selected: { id: string; label: string } | null = null;
  const kwFilter = () => {
    renderTree(filterInput.value.trim().toLowerCase());
  };
  on(filterInput, "input", kwFilter);

  const childRows = new Map<string, HTMLElement>();
  const groupHeads = new Map<string, HTMLElement>();

  function renderTree(kw: string) {
    clear(tree);
    childRows.clear();
    groupHeads.clear();
    for (const g of nodes) {
      const children = g.children.filter(
        (c) =>
          !kw ||
          g.name.toLowerCase().includes(kw) ||
          c.name.toLowerCase().includes(kw) ||
          c.slug.includes(kw),
      );
      if (kw && !children.length) continue;
      const group = el("div", { class: `wc-nc-group${g.slug === selected?.id ? " is-open" : ""}` });
      const ghead = el("div", { class: "wc-nc-group-head" });
      const caret = el("span", { class: "wc-nc-caret" });
      caret.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>`;
      ghead.append(caret, el("span", null, g.name));
      if (kw) group.classList.add("is-open");
      on(ghead, "click", () => group.classList.toggle("is-open"));
      group.append(ghead);
      groupHeads.set(g.id, group);

      for (const c of children) {
        const row = el("div", {
          class: `wc-nc-child${selected?.id === c.id ? " is-selected" : ""}`,
          "data-node-id": c.id,
        });
        const check = el("span", { class: "wc-check" });
        check.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" class="wc-ic"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>`;
        row.append(check, el("span", { class: "wc-nc-child-name" }, c.name));
        if (typeof c.post_count === "number") {
          row.append(el("span", { class: "wc-nc-child-count" }, `${c.post_count}`));
        }
        on(row, "click", () => {
          selected = { id: c.id, label: `${g.name} / ${c.name}` };
          renderTree(filterInput.value.trim().toLowerCase());
          renderPicked();
        });
        childRows.set(c.id, row);
        group.append(row);
      }
      tree.append(group);
    }
  }

  // 右：选中 + 标题 + 正文
  const right = el("div", { class: "wc-nc-right" });
  const pickedWrap = el("div", {});
  right.append(el("div", { class: "wc-nc-label" }, "选择节点（约等于选择群聊对象）"), pickedWrap);

  const title = document.createElement("input");
  title.className = "wc-nc-title";
  title.placeholder = "群聊名称（帖子标题）";
  title.maxLength = 80;
  right.append(el("div", { class: "wc-nc-label" }, "群聊名称"), title);

  const content = document.createElement("textarea");
  content.className = "wc-nc-content";
  content.placeholder = "输入群聊公告（帖子正文，支持 Markdown）…";
  right.append(el("div", { class: "wc-nc-label" }, "群聊公告"), content);

  function renderPicked() {
    clear(pickedWrap);
    if (!selected) {
      pickedWrap.append(el("div", { class: "wc-nc-picked", style: "color:var(--wc-text-3);background:var(--wc-panel-bg);" }, "尚未选择节点"));
      return;
    }
    pickedWrap.append(el("div", { class: "wc-nc-picked" }, `# ${selected.label}`));
  }

  renderTree("");
  renderPicked();

  // foot
  const foot = el("div", { class: "wc-dialog-foot" });
  const cancel = el("button", { class: "wc-btn", type: "button", onClick: cb.onClose }, "取消");
  const submit = el("button", { class: "wc-btn is-primary", type: "button" }, "创建并发布");
  const doSubmit = () => {
    if (!selected || !title.value.trim() || !content.value.trim()) return;
    submit.disabled = true;
    cb.onSubmit({ title: title.value.trim(), content: content.value.trim(), node_id: selected.id });
  };
  on(submit, "click", doSubmit);
  foot.append(cancel, submit);

  body.append(left, right);
  dialog.append(head, body, foot);
  overlay.append(dialog);
  on(overlay as HTMLElement, "click", (e) => {
    if (e.target === overlay) cb.onClose();
  });

  root.append(overlay as HTMLElement);
  return { focus: () => title.focus() };
}

export function removeNewChat(root: ShadowRoot) {
  root.querySelector(".wc-overlay[data-newchat]")?.remove();
}

const template = document.createElement("template");
template.innerHTML = `
  <style>
    :host {
      --iw-bg: #111318;
      --iw-panel: #191c23;
      --iw-key: #252a34;
      --iw-key-active: #343c4b;
      --iw-text: #f5f7fb;
      --iw-muted: #929aab;
      --iw-accent: #a8ff78;
      --iw-border: #383f4c;
      color: var(--iw-text);
      display: block;
      font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      font-size: 16px;
    }
    * { box-sizing: border-box; }
    .shell {
      background: var(--iw-bg);
      border: 1px solid var(--iw-border);
      border-radius: 20px;
      overflow: hidden;
    }
    header {
      align-items: end;
      background: linear-gradient(135deg, #1c212b, #15171d);
      border-bottom: 1px solid var(--iw-border);
      display: flex;
      gap: 24px;
      justify-content: space-between;
      padding: 24px;
    }
    h2 { font-size: clamp(1.25rem, 2.6vw, 2rem); margin: 0 0 5px; }
    .eyebrow {
      color: var(--iw-accent);
      font-family: ui-monospace, monospace;
      font-size: .72rem;
      letter-spacing: .14em;
      margin: 0 0 8px;
      text-transform: uppercase;
    }
    .current { color: var(--iw-muted); font-size: .9rem; margin: 0; }
    .current strong { color: var(--iw-text); font-weight: 600; }
    .layers { display: flex; flex-wrap: wrap; gap: 7px; justify-content: flex-end; }
    .layer {
      appearance: none;
      background: transparent;
      border: 1px solid var(--iw-border);
      border-radius: 999px;
      color: var(--iw-muted);
      cursor: pointer;
      font: inherit;
      font-size: .78rem;
      padding: 7px 11px;
    }
    .layer:hover { border-color: var(--iw-muted); color: var(--iw-text); }
    .layer[aria-pressed="true"] {
      background: var(--iw-accent);
      border-color: var(--iw-accent);
      color: #11150f;
      font-weight: 700;
    }
    .keyboard-wrap { overflow-x: auto; padding: 28px 24px 20px; }
    .keyboard { display: grid; gap: 7px; min-width: 900px; }
    .row { display: flex; gap: 7px; }
    .key {
      align-items: center;
      appearance: none;
      background: linear-gradient(145deg, var(--iw-key-active), var(--iw-key));
      border: 1px solid #424957;
      border-bottom-color: #101217;
      border-radius: 8px;
      box-shadow: 0 3px 0 #0c0e12;
      display: flex;
      flex: var(--key-width, 1) 0 0;
      color: inherit;
      cursor: default;
      font: inherit;
      height: 58px;
      justify-content: center;
      min-width: 0;
      padding: 6px;
      position: relative;
    }
    .key.empty { color: #596170; }
    .symbol {
      font-size: clamp(.72rem, 1.4vw, 1.05rem);
      font-weight: 650;
      line-height: 1.05;
      max-width: 100%;
      text-align: center;
      overflow-wrap: anywhere;
    }
    .key[data-length="long"] .symbol { font-size: .7rem; }
    .key[data-length="extra-long"] .symbol { font-size: .6rem; }
    .code {
      bottom: 4px;
      color: var(--iw-muted);
      font-family: ui-monospace, monospace;
      font-size: .48rem;
      left: 5px;
      letter-spacing: .03em;
      position: absolute;
    }
    details { border-top: 1px solid var(--iw-border); padding: 14px 24px 24px; }
    summary { color: var(--iw-muted); cursor: pointer; font-size: .82rem; }
    .extras { display: grid; gap: 7px; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); padding-top: 16px; }
    .extras .key { height: 54px; }
    .hint { color: var(--iw-muted); font-size: .73rem; margin: 0; padding: 0 24px 22px; }
    .inspector {
      border-top: 1px solid var(--iw-border);
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      margin-top: 10px;
      padding: 18px 24px;
    }
    .inspector span { color: var(--iw-muted); display: block; font-size: .65rem; letter-spacing: .08em; margin-bottom: 4px; text-transform: uppercase; }
    .inspector strong { display: block; font-family: ui-monospace, monospace; font-size: .82rem; overflow-wrap: anywhere; }
    .error { color: #ff8e8e; padding: 24px; }
    @media (max-width: 760px) {
      header { align-items: start; flex-direction: column; }
      .layers { justify-content: flex-start; }
      .keyboard-wrap { padding-inline: 14px; }
      .inspector { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
  <div class="shell">
    <header>
      <div>
        <p class="eyebrow">inputwerk · XKB</p>
        <h2></h2>
        <p class="current">Layer <strong></strong></p>
      </div>
      <nav class="layers" aria-label="Keymap layers"></nav>
    </header>
    <div class="keyboard-wrap"><div class="keyboard"></div></div>
    <section class="inspector" aria-label="Selected key details" aria-live="polite">
      <div><span>Keycode</span><strong data-field="code">Hover or focus a key</strong></div>
      <div><span>Keysym</span><strong data-field="symbol">—</strong></div>
      <div><span>XKB type</span><strong data-field="type">—</strong></div>
      <div><span>Effective modifier</span><strong data-field="level">—</strong></div>
    </section>
    <p class="hint">Switch layers with the buttons, number keys, or ← → while this element is focused.</p>
    <details><summary></summary><div class="extras"></div></details>
  </div>
`;

export class InputwerkKeymapElement extends HTMLElement {
  static observedAttributes = ["src", "layer"];

  #data = null;
  #layer = 0;
  #loading = false;
  #selected = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" }).append(template.content.cloneNode(true));
    this.tabIndex = this.tabIndex < 0 ? 0 : this.tabIndex;
  }

  connectedCallback() {
    this.addEventListener("keydown", this.#onKeydown);
    if (this.hasAttribute("src") && !this.#data) this.#load();
    else this.#render();
  }

  disconnectedCallback() {
    this.removeEventListener("keydown", this.#onKeydown);
  }

  attributeChangedCallback(name, previous, value) {
    if (previous === value) return;
    if (name === "src" && this.isConnected) this.#load();
    if (name === "layer") this.layer = Number(value) - 1;
  }

  set data(value) {
    this.#data = value;
    const requested = this.hasAttribute("layer") ? Number(this.getAttribute("layer")) - 1 : this.#layer;
    this.#layer = Math.max(0, Math.min(requested, Math.max(0, (value?.levels?.length ?? 1) - 1)));
    this.#render();
  }

  get data() { return this.#data; }

  set layer(value) {
    const maximum = Math.max(0, (this.#data?.levels?.length ?? 1) - 1);
    this.#layer = Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0));
    this.#render();
  }

  get layer() { return this.#layer; }

  async #load() {
    if (this.#loading) return;
    this.#loading = true;
    try {
      const response = await fetch(this.getAttribute("src"));
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      this.data = await response.json();
    } catch (error) {
      const message = document.createElement("p");
      message.className = "error";
      message.textContent = String(error);
      this.shadowRoot.querySelector(".keyboard").replaceChildren(message);
    } finally {
      this.#loading = false;
    }
  }

  #onKeydown = (event) => {
    if (!this.#data) return;
    if (/^[1-9]$/.test(event.key)) this.layer = Number(event.key) - 1;
    else if (event.key === "ArrowRight") this.layer = (this.#layer + 1) % this.#data.levels.length;
    else if (event.key === "ArrowLeft") this.layer = (this.#layer - 1 + this.#data.levels.length) % this.#data.levels.length;
    else return;
    event.preventDefault();
  };

  #key(key) {
    const element = document.createElement("button");
    const label = key.labels[this.#layer] ?? "";
    const raw = key.symbols[this.#layer] ?? "NoSymbol";
    element.className = `key${label ? "" : " empty"}`;
    element.type = "button";
    element.style.setProperty("--key-width", key.width ?? 1);
    element.dataset.length = label.length > 16 ? "extra-long" : label.length > 9 ? "long" : "short";
    element.title = `${key.code} · ${key.type ?? "inferred"} · ${raw}`;
    element.setAttribute("aria-label", `${key.code}: ${label || "No symbol"}`);
    element.addEventListener("pointerenter", () => this.#inspect(key));
    element.addEventListener("focus", () => this.#inspect(key));
    element.addEventListener("click", () => this.#inspect(key));

    const symbol = document.createElement("span");
    symbol.className = "symbol";
    symbol.textContent = label || "·";
    const code = document.createElement("span");
    code.className = "code";
    code.textContent = key.code;
    element.append(symbol, code);
    return element;
  }

  #inspect(key) {
    this.#selected = key.code;
    const fields = this.shadowRoot.querySelector(".inspector");
    fields.querySelector('[data-field="code"]').textContent = key.code;
    fields.querySelector('[data-field="symbol"]').textContent = key.symbols[this.#layer] ?? "NoSymbol";
    fields.querySelector('[data-field="type"]').textContent = key.type ?? "inferred";
    fields.querySelector('[data-field="level"]').textContent = key.levelNames[this.#layer] ?? "Not defined for this type";
  }

  #render() {
    if (!this.#data || !this.isConnected) return;
    const root = this.shadowRoot;
    root.querySelector("h2").textContent = this.#data.name;
    root.querySelector(".current strong").textContent = `${this.#layer + 1} · ${this.#data.levels[this.#layer]?.name ?? "Unknown"}`;

    const layers = root.querySelector(".layers");
    layers.replaceChildren(...this.#data.levels.map((level, index) => {
      const button = document.createElement("button");
      button.className = "layer";
      button.type = "button";
      button.textContent = `${level.index} ${level.name}`;
      button.setAttribute("aria-pressed", String(index === this.#layer));
      button.addEventListener("click", () => { this.layer = index; });
      return button;
    }));

    const keyboard = root.querySelector(".keyboard");
    keyboard.replaceChildren(...this.#data.rows.map((row) => {
      const element = document.createElement("div");
      element.className = "row";
      element.append(...row.keys.map((key) => this.#key(key)));
      return element;
    }));

    const details = root.querySelector("details");
    details.hidden = this.#data.extras.length === 0;
    details.querySelector("summary").textContent = `${this.#data.extras.length} additional media, navigation, and keypad keys`;
    details.querySelector(".extras").replaceChildren(...this.#data.extras.map((key) => this.#key(key)));

    const allKeys = [...this.#data.rows.flatMap((row) => row.keys), ...this.#data.extras];
    const selected = allKeys.find((key) => key.code === this.#selected)
      ?? allKeys.find((key) => key.labels[this.#layer]);
    if (selected) this.#inspect(selected);
  }
}

if (!customElements.get("inputwerk-keymap")) {
  customElements.define("inputwerk-keymap", InputwerkKeymapElement);
}

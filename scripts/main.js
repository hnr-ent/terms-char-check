
// main.js

(function () {
  // --- Utilities ---
  const escapeHtml = (str) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const escapeForRegex = (str) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  // Given original text and pattern strings, we highlight on the ESCAPED text.
  // We also ESCAPE patterns so they match what the user sees (literal).
  function buildHighlightHtml(original, lists, options) {
    const escapedText = escapeHtml(original);

    const { caseSensitive, wholeWord } = options;

    // Build an array of regexes (escaped for HTML view).
    const regexes = [];

    // Words — by default whole-word
    for (const word of lists.words) {
      if (!word) continue;
      const pat = escapeForRegex(escapeHtml(word));
      const boundary = wholeWord ? "\\b" : "";
      const rx = new RegExp(`${boundary}${pat}${boundary}`,
        caseSensitive ? "g" : "gi"
      );
      regexes.push(rx);
    }

    // Phrases — substring match
    for (const phrase of lists.phrases) {
      if (!phrase) continue;
      const pat = escapeForRegex(escapeHtml(phrase));
      const rx = new RegExp(pat, caseSensitive ? "g" : "gi");
      regexes.push(rx);
    }

    // Specials — literal sequences (e.g., entities, symbols)
    for (const s of lists.specials) {
      if (!s) continue;
      const pat = escapeForRegex(escapeHtml(s));
      const rx = new RegExp(pat, caseSensitive ? "g" : "gi");
      regexes.push(rx);
    }

    // To avoid nested replacement issues, we run replacements sequentially
    // while tracking match count.
    let result = escapedText;
    let matchCount = 0;
    for (const rx of regexes) {
      result = result.replace(rx, (m) => {
        matchCount++;
        return `<mark class="hl">${m}</mark>`;
      });
    }
    return { html: result, count: matchCount };
  }

  // --- State ---
  const lists = {
    words: [...(window.ERROR_LISTS?.words || [])],
    phrases: [...(window.ERROR_LISTS?.phrases || [])],
    specials: [...(window.ERROR_LISTS?.specials || [])],
  };

  // --- DOM ---
  const htmlInput = document.getElementById("htmlInput");
  const output = document.getElementById("output");
  const stats = document.getElementById("stats");
  const caseSensitive = document.getElementById("caseSensitive");
  const wholeWord = document.getElementById("wholeWord");
  const clearBtn = document.getElementById("clearBtn");
  const sampleBtn = document.getElementById("sampleBtn");
  const copyHtmlBtn = document.getElementById("copyHtmlBtn");
  const copyHighlightedBtn = document.getElementById("copyHighlightedBtn");

  // List UI
  const wordsList = document.getElementById("wordsList");
  const phrasesList = document.getElementById("phrasesList");
  const specialsList = document.getElementById("specialsList");
  const addWordInput = document.getElementById("addWordInput");
  const addPhraseInput = document.getElementById("addPhraseInput");
  const addSpecialInput = document.getElementById("addSpecialInput");
  const addWordBtn = document.getElementById("addWordBtn");
  const addPhraseBtn = document.getElementById("addPhraseBtn");
  const addSpecialBtn = document.getElementById("addSpecialBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");

  // --- Rendering ---
  function renderLists() {
    const render = (el, arr, kind) => {
      el.innerHTML = "";
      arr.forEach((text, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerHTML = `
          <span title="${text}">${escapeHtml(text)}</span>
          <button aria-label="Remove">✕</button>
        `;
        chip.querySelector("button").addEventListener("click", () => {
          arr.splice(i, 1);
          renderLists();
          triggerHighlight();
        });
        el.appendChild(chip);
      });
    };
    render(wordsList, lists.words, "words");
    render(phrasesList, lists.phrases, "phrases");
    render(specialsList, lists.specials, "specials");
  }

  function highlight() {
    const { html, count } = buildHighlightHtml(
      htmlInput.value || "",
      lists,
      {
        caseSensitive: !!caseSensitive.checked,
        wholeWord: !!wholeWord.checked,
      }
    );
    output.innerHTML = html || "";
    stats.textContent = `${count} match${count === 1 ? "" : "es"}`;
  }
  const triggerHighlight = debounce(highlight, 120);

  // --- Events ---
  htmlInput.addEventListener("input", triggerHighlight);
  caseSensitive.addEventListener("change", triggerHighlight);
  wholeWord.addEventListener("change", triggerHighlight);

  clearBtn.addEventListener("click", () => {
    htmlInput.value = "";
    triggerHighlight();
  });

  sampleBtn.addEventListener("click", () => {
    htmlInput.value =
`<!-- Sample HTML -->
<div class="cta">
  #Click here</a>
  <p>Limited time offer — get a free bonus! &nbsp; Avoid &amp; where possible.</p>
  <p>Trademark symbols: ® and ™</p>
</div>`;
    triggerHighlight();
  });

  copyHtmlBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(htmlInput.value || "");
    toast("Original HTML copied.");
  });

  copyHighlightedBtn.addEventListener("click", async () => {
    // Copy the visible highlighted text exactly as shown (with escaped HTML + mark tags).
    const temp = document.createElement("div");
    temp.innerHTML = output.innerHTML;
    // Get textContent to copy as plain text with mark tags stripped or keep HTML?
    
    // Highlights the text while keeping the characters visible.
    const asText = temp.textContent;
    await navigator.clipboard.writeText(asText);
    toast("Highlighted text copied (plain).");
  });

  addWordBtn.addEventListener("click", () => {
    const v = addWordInput.value.trim();
    if (!v) return;
    lists.words.push(v);
    addWordInput.value = "";
    renderLists();
    triggerHighlight();
  });
  addPhraseBtn.addEventListener("click", () => {
    const v = addPhraseInput.value.trim();
    if (!v) return;
    lists.phrases.push(v);
    addPhraseInput.value = "";
    renderLists();
    triggerHighlight();
  });
  addSpecialBtn.addEventListener("click", () => {
    const v = addSpecialInput.value.trim();
    if (!v) return;
    lists.specials.push(v);
    addSpecialInput.value = "";
    renderLists();
    triggerHighlight();
  });

  exportBtn.addEventListener("click", () => {
    const payload = {
      words: lists.words,
      phrases: lists.phrases,
      specials: lists.specials,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "error-lists.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  importFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      lists.words = Array.isArray(json.words) ? json.words : lists.words;
      lists.phrases = Array.isArray(json.phrases) ? json.phrases : lists.phrases;
      lists.specials = Array.isArray(json.specials) ? json.specials : lists.specials;
      renderLists();
      triggerHighlight();
      toast("Lists imported.");
    } catch (err) {
      toast("Invalid JSON file.", true);
    } finally {
      e.target.value = "";
    }
  });

  // --- Toast (lightweight) ---
  function toast(msg, isError = false) {
    let t = document.getElementById("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.style.position = "fixed";
      t.style.bottom = "12px";
      t.style.right = "12px";
      t.style.padding = "8px 12px";
      t.style.borderRadius = "6px";
      t.style.zIndex = "9999";
      t.style.background = isError ? "#ef4444" : "#10b981";
      t.style.color = "#111827";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.background = isError ? "#ef4444" : "#10b981";
    t.style.opacity = "1";
    setTimeout(() => (t.style.opacity = "0"), 2000);
  }

  // Init
  renderLists();
  triggerHighlight();
})();
// =============================================================
// Discrete Math symbol palette — insert Unicode at cursor.
// =============================================================

export const MATH_SYMBOL_GROUPS = [
  {
    name: "Logic",
    symbols: ["¬", "∧", "∨", "→", "↔", "⊕", "∀", "∃"],
  },
  {
    name: "Sets",
    symbols: ["∈", "∉", "⊆", "⊇", "⊂", "⊃", "∪", "∩", "∅"],
  },
  {
    name: "Relations",
    symbols: ["≤", "≥", "≠", "≈", "≡", "≺", "≻"],
  },
  {
    name: "Numbers",
    symbols: ["ℕ", "ℤ", "ℚ", "ℝ", "ℂ"],
  },
];

/** Insert text at the caret of an input/textarea, then restore focus. */
export function insertAtCursor(el, value, symbol, onChange) {
  const current = value ?? "";
  if (!el || typeof el.selectionStart !== "number") {
    onChange(current + symbol);
    return;
  }
  const start = el.selectionStart;
  const end = el.selectionEnd ?? start;
  const next = current.slice(0, start) + symbol + current.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    const pos = start + symbol.length;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore for unsupported inputs */
    }
  });
}

function MathSymbolToolbar({
  inputRef,
  value,
  onChange,
  onInsert,
  disabled = false,
  className = "",
}) {
  function handleInsert(symbol) {
    if (disabled) return;
    if (typeof onInsert === "function") {
      onInsert(symbol);
      return;
    }
    insertAtCursor(inputRef?.current, value, symbol, onChange);
  }

  return (
    <div
      className={`rounded border border-indigo-100 bg-indigo-50/60 p-2 ${className}`}
      role="toolbar"
      aria-label="Discrete math symbols"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 mb-1.5">
        Math symbols — click to insert
      </p>
      <div className="space-y-1.5">
        {MATH_SYMBOL_GROUPS.map((group) => (
          <div key={group.name} className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-gray-500 w-14 shrink-0">
              {group.name}
            </span>
            {group.symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                disabled={disabled}
                title={`Insert ${sym}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleInsert(sym)}
                className="min-w-[1.75rem] h-7 px-1.5 rounded border border-indigo-200 bg-white text-base font-medium text-gray-800 hover:bg-indigo-100 hover:border-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sym}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default MathSymbolToolbar;

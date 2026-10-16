// =============================================================
// MCQ (radio) or short answer (textarea).
// =============================================================

import { useRef } from "react";
import MathSymbolToolbar from "./MathSymbolToolbar";

function QuestionCard({
  question,
  selected,
  onSelect,
  onShortChange,
  disabled,
  indexLabel,
}) {
  const answerRef = useRef(null);
  const qtype = question?.question_type || "mcq";
  const showMathToolbar =
    qtype === "short" && !!question?.allow_math_symbols;
  const options = Array.isArray(question?.options)
    ? question.options.map((o) =>
        typeof o === "string" ? o : o?.text ?? String(o)
      )
    : [];

  return (
    <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
      {indexLabel && (
        <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
          {indexLabel}
          {qtype === "short" ? " · Short answer" : ""}
          {showMathToolbar ? " · Math symbols" : ""}
        </p>
      )}
      <h2 className="text-lg font-semibold mb-3">{question?.question}</h2>

      {qtype === "short" ? (
        <div>
          {showMathToolbar && (
            <MathSymbolToolbar
              inputRef={answerRef}
              value={selected ?? ""}
              onChange={(text) =>
                onShortChange(String(question.id), text)
              }
              disabled={disabled}
              className="mb-2"
            />
          )}
          <textarea
            ref={answerRef}
            className="border p-3 w-full rounded min-h-[120px] text-base disabled:bg-gray-100"
            placeholder="Type your answer here…"
            value={selected ?? ""}
            onChange={(e) => onShortChange(String(question.id), e.target.value)}
            onBlur={(e) => onShortChange(String(question.id), e.target.value)}
            disabled={disabled}
            maxLength={4000}
          />
          {question.max_points != null && (
            <p className="text-xs text-gray-500 mt-1">
              Max marks: {question.max_points}
            </p>
          )}
        </div>
      ) : (
        <div>
          {options.map((option, index) => (
            <label
              key={index}
              className="flex items-center gap-2 mb-2 cursor-pointer"
            >
              <input
                type="radio"
                name={`question-${question.id}`}
                value={option}
                checked={selected === option}
                onChange={() => onSelect(question.id, option)}
                disabled={disabled}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuestionCard;

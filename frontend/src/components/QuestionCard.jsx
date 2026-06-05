// =============================================================
// src/components/QuestionCard.jsx
// Displays a single exam question with its multiple choice options.
// The parent (Exam page) handles tracking which option is selected.
// =============================================================

// Props:
//   question  - { id, question, options[] }
//   selected  - the currently selected option text (or undefined)
//   onSelect  - function to call when user picks an option
//   disabled  - true when exam is submitted (options become unclickable)
function QuestionCard({ question, selected, onSelect, disabled }) {
  return (
    <div className="mb-6 p-4 border rounded-lg bg-white shadow-sm">
      {/* Question text */}
      <h2 className="text-lg font-semibold mb-3">{question.question}</h2>

      {/* Loop through each option and display as a radio button */}
      <div>
        {question.options.map((option, index) => (
          <label
            key={index}
            className="flex items-center gap-2 mb-2 cursor-pointer"
          >
            <input
              type="radio"
              name={`question-${question.id}`}  // group radio buttons by question
              value={option}
              checked={selected === option}       // highlight if this option is selected
              onChange={() => onSelect(question.id, option)}  // tell parent what was picked
              disabled={disabled}                // lock after submission
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default QuestionCard;

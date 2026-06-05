// =============================================================
// src/components/Result.jsx
// Shown after the user submits the exam.
// Displays the score and review of each question.
// =============================================================

// Props:
//   questions      - list of all question objects
//   answers        - what the user answered { questionId: optionText }
//   correctAnswers - the correct answers from the backend { questionId: optionText }
//   score          - total number of correct answers
function Result({ questions, answers, correctAnswers, score }) {

  // Helper function: figures out what to display for each question's answer
  function renderAnswer(question) {
    const userAnswer = answers[question.id];
    const correctAnswer = correctAnswers[question.id];

    if (userAnswer === undefined) {
      // User didn't answer this question
      return (
        <span className="text-red-600">
          Not Attempted — Correct answer: {correctAnswer}
        </span>
      );
    }

    if (userAnswer === correctAnswer) {
      // User got it right
      return (
        <span className="text-green-600">
          {userAnswer} ✓ (Correct)
        </span>
      );
    }

    // User got it wrong
    return (
      <span className="text-red-600">
        {userAnswer} ✗ (Wrong — Correct: {correctAnswer})
      </span>
    );
  }

  return (
    <div className="mt-6">
      {/* Score display */}
      <h2 className="text-3xl font-bold mb-4">
        Your Score: {score} / {questions.length}
      </h2>

      <p className="text-xl font-semibold mb-4">Answer Review:</p>

      {/* Review each question */}
      {questions.map((q) => (
        <div key={q.id} className="mb-4 p-3 border rounded bg-gray-50">
          <p className="font-semibold">{q.id}. {q.question}</p>
          <p className="mt-1">{renderAnswer(q)}</p>
        </div>
      ))}
    </div>
  );
}

export default Result;

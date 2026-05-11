// Test the quiz judging logic
const API_BASE = 'http://127.0.0.1:8000';

async function testQuizJudging() {
  try {
    console.log('Testing quiz judging logic...\n');
    
    // Step 1: Get 4 questions
    console.log('1. Fetching 4 questions...');
    const quizResponse = await fetch(`${API_BASE}/api/quiz?count=4`);
    const quizJson = await quizResponse.json();
    
    if (!quizJson.success || quizJson.data.length === 0) {
      console.error('❌ Failed to get questions');
      return;
    }
    
    const questions = quizJson.data;
    console.log(`✅ Got ${questions.length} questions\n`);
    
    // Step 2: Test each question
    for (let i = 0; i < Math.min(2, questions.length); i++) {
      const q = questions[i];
      console.log(`\n--- Question ${i + 1} ---`);
      console.log(`Type: ${q.type}`);
      console.log(`Content: ${q.content}`);
      console.log(`Correct Answer: ${JSON.stringify(q.correct_answer)}`);
      
      // Prepare answer based on question type
      let answer;
      if (q.type === 'single') {
        // For single choice, use the correct answer
        answer = q.correct_answer;
      } else if (q.type === 'multiple') {
        // For multiple choice, use the correct answer array
        answer = Array.isArray(q.correct_answer) ? q.correct_answer : [q.correct_answer];
      } else if (q.type === 'fill_blank') {
        // For fill blank, use the correct answer
        answer = q.correct_answer;
      }
      
      console.log(`User Answer: ${JSON.stringify(answer)}`);
      
      // Step 3: Submit answer
      console.log('Submitting answer...');
      const submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: q.id,
          answer: answer
        })
      });
      
      const submitJson = await submitResponse.json();
      
      if (submitJson.success) {
        const result = submitJson.data;
        console.log(`✅ Result: ${result.correct ? 'CORRECT ✓' : 'WRONG ✗'}`);
        console.log(`Judge Mode: ${result.judge_mode}`);
        console.log(`Explanation: ${result.explanation}`);
      } else {
        console.error(`❌ Submit failed: ${submitJson.error}`);
      }
    }
    
    console.log('\n✅ Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testQuizJudging();

// Quick test of the quiz API
const API_BASE = 'http://127.0.0.1:8000';

async function testAPI() {
  console.log('Testing Quiz API...\n');
  
  try {
    // Test 1: Get 4 questions
    console.log('Test 1: Getting 4 questions...');
    const response = await fetch(`${API_BASE}/api/quiz?count=4`);
    const json = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Success: ${json.success}`);
    console.log(`Questions returned: ${json.data?.length || 0}`);
    
    if (json.data && json.data.length > 0) {
      const q = json.data[0];
      console.log(`\nFirst question:`);
      console.log(`  ID: ${q.id}`);
      console.log(`  Type: ${q.type}`);
      console.log(`  Content: ${q.content?.substring(0, 50)}...`);
      console.log(`  Options: ${q.options?.length || 0}`);
      console.log(`  Correct Answer: ${q.correct_answer}`);
      console.log(`  Explanation: ${q.explanation?.substring(0, 50)}...`);
      
      // Test 2: Submit answer
      console.log(`\n\nTest 2: Submitting answer...`);
      const submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quiz_id: q.id,
          answer: q.correct_answer,
        }),
      });
      
      const submitJson = await submitResponse.json();
      console.log(`Status: ${submitResponse.status}`);
      console.log(`Success: ${submitJson.success}`);
      console.log(`Correct: ${submitJson.data?.correct}`);
      console.log(`Judge Mode: ${submitJson.data?.judge_mode}`);
    }
    
    // Test 3: Get 10 questions to check variety
    console.log(`\n\nTest 3: Getting 10 questions to check variety...`);
    const response2 = await fetch(`${API_BASE}/api/quiz?count=10`);
    const json2 = await response2.json();
    
    const typeCount = { single: 0, multiple: 0, fill_blank: 0 };
    json2.data?.forEach(q => {
      if (q.type === 'single') typeCount.single++;
      else if (q.type === 'multiple') typeCount.multiple++;
      else if (q.type === 'fill_blank') typeCount.fill_blank++;
    });
    
    console.log(`Questions returned: ${json2.data?.length || 0}`);
    console.log(`Type distribution: Single=${typeCount.single}, Multiple=${typeCount.multiple}, Fill Blank=${typeCount.fill_blank}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAPI();

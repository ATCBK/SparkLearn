// Simple test to verify the practice page loads 8 questions
const API_BASE = 'http://127.0.0.1:8000';

async function testPracticePageInitialization() {
  try {
    console.log('Testing practice page initialization...');
    
    // Test 1: Verify API returns 8 questions
    console.log('\n1. Testing API endpoint with count=8...');
    const response = await fetch(`${API_BASE}/api/quiz?chapter=函数返回值&count=8`);
    const json = await response.json();
    
    if (!json.success) {
      console.error('❌ API returned error:', json.error);
      return;
    }
    
    const questions = json.data;
    console.log(`✅ API returned ${questions.length} questions`);
    
    if (questions.length !== 8) {
      console.error(`❌ Expected 8 questions, got ${questions.length}`);
      return;
    }
    
    // Test 2: Verify question structure
    console.log('\n2. Verifying question structure...');
    const firstQuestion = questions[0];
    const requiredFields = ['id', 'type', 'content', 'options', 'explanation'];
    
    for (const field of requiredFields) {
      if (!(field in firstQuestion)) {
        console.error(`❌ Missing field: ${field}`);
        return;
      }
    }
    console.log('✅ All required fields present');
    
    // Test 3: Display questions
    console.log('\n3. Questions loaded:');
    questions.forEach((q, idx) => {
      console.log(`   ${idx + 1}. [${q.type}] ${q.content.substring(0, 50)}...`);
    });
    
    console.log('\n✅ All tests passed! Practice page should load 8 questions correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPracticePageInitialization();

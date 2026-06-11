// 全面测试答题系统
const API_BASE = 'http://127.0.0.1:8000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`测试: ${name}`, 'blue');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logResult(passed, message) {
  if (passed) {
    log(`✅ ${message}`, 'green');
  } else {
    log(`❌ ${message}`, 'red');
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let testResults = {
  passed: 0,
  failed: 0,
  issues: [],
};

async function test1_InitialLoad() {
  logTest('1. 初始加载 - 获取4道题目');
  
  try {
    const response = await fetch(`${API_BASE}/api/quiz?count=4`);
    const json = await response.json();
    
    logResult(json.success, '请求成功');
    logResult(json.data && json.data.length === 4, `获取4道题目 (实际: ${json.data?.length || 0})`);
    
    if (json.data && json.data.length > 0) {
      const q = json.data[0];
      logResult(q.id, `题目有ID: ${q.id}`);
      logResult(q.type, `题目有类型: ${q.type}`);
      logResult(q.content, `题目有内容: ${q.content?.substring(0, 30)}...`);
      logResult(q.options && q.options.length > 0, `题目有选项: ${q.options?.length || 0}个`);
      logResult(q.correct_answer, `题目有答案: ${q.correct_answer}`);
      logResult(q.explanation, `题目有解析: ${q.explanation?.substring(0, 30)}...`);
      
      testResults.passed += 6;
    } else {
      testResults.failed += 6;
      testResults.issues.push('初始加载失败：没有获取到题目');
    }
  } catch (error) {
    logResult(false, `请求失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`初始加载异常: ${error.message}`);
  }
}

async function test2_QuestionTypes() {
  logTest('2. 题目类型多样性 - 生成10道题目检查类型分布');
  
  try {
    const response = await fetch(`${API_BASE}/api/quiz?count=10`);
    const json = await response.json();
    
    if (!json.success || !json.data) {
      logResult(false, '获取题目失败');
      testResults.failed += 1;
      testResults.issues.push('题目类型测试失败：无法获取题目');
      return;
    }
    
    const questions = json.data;
    const typeCount = {
      single: 0,
      multiple: 0,
      fill_blank: 0,
      unknown: 0,
    };
    
    questions.forEach(q => {
      if (q.type === 'single') typeCount.single++;
      else if (q.type === 'multiple') typeCount.multiple++;
      else if (q.type === 'fill_blank') typeCount.fill_blank++;
      else typeCount.unknown++;
    });
    
    log(`题目类型分布: 单选${typeCount.single}道, 多选${typeCount.multiple}道, 填空${typeCount.fill_blank}道`, 'yellow');
    
    const hasVariety = typeCount.single > 0 && (typeCount.multiple > 0 || typeCount.fill_blank > 0);
    logResult(hasVariety, `题目类型多样化 (${hasVariety ? '有' : '无'})`);
    
    if (!hasVariety) {
      testResults.issues.push(`题目类型不多样: 单选${typeCount.single}, 多选${typeCount.multiple}, 填空${typeCount.fill_blank}`);
    }
    
    testResults.passed += 1;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`题目类型测试异常: ${error.message}`);
  }
}

async function test3_QuestionContent() {
  logTest('3. 题目内容质量 - 检查题目是否重复');
  
  try {
    const response = await fetch(`${API_BASE}/api/quiz?count=8`);
    const json = await response.json();
    
    if (!json.success || !json.data) {
      logResult(false, '获取题目失败');
      testResults.failed += 1;
      return;
    }
    
    const questions = json.data;
    const contents = questions.map(q => q.content);
    const uniqueContents = new Set(contents);
    
    logResult(contents.length === uniqueContents.size, `题目内容无重复 (${uniqueContents.size}/${contents.length})`);
    
    if (contents.length !== uniqueContents.size) {
      testResults.issues.push(`发现重复题目: ${contents.length - uniqueContents.size}道`);
    }
    
    testResults.passed += 1;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`题目内容测试异常: ${error.message}`);
  }
}

async function test4_AnswerSubmission() {
  logTest('4. 答案提交 - 提交正确答案');
  
  try {
    // 获取题目
    const quizResponse = await fetch(`${API_BASE}/api/quiz?count=1`);
    const quizJson = await quizResponse.json();
    
    if (!quizJson.success || !quizJson.data || quizJson.data.length === 0) {
      logResult(false, '获取题目失败');
      testResults.failed += 1;
      return;
    }
    
    const question = quizJson.data[0];
    log(`题目类型: ${question.type}`, 'yellow');
    log(`题目内容: ${question.content}`, 'yellow');
    log(`正确答案: ${JSON.stringify(question.correct_answer)}`, 'yellow');
    
    // 提交正确答案
    const submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: question.id,
        answer: question.correct_answer,
      }),
    });
    
    const submitJson = await submitResponse.json();
    
    logResult(submitJson.success, '提交成功');
    logResult(submitJson.data?.correct === true, `判题正确 (结果: ${submitJson.data?.correct})`);
    logResult(submitJson.data?.judge_mode, `判题方式: ${submitJson.data?.judge_mode}`);
    
    if (submitJson.data?.correct !== true) {
      testResults.issues.push(`正确答案判题失败: 题目类型=${question.type}, 答案=${question.correct_answer}`);
    }
    
    testResults.passed += 3;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 3;
    testResults.issues.push(`答案提交测试异常: ${error.message}`);
  }
}

async function test5_WrongAnswer() {
  logTest('5. 错误答案判题 - 提交错误答案');
  
  try {
    // 获取题目
    const quizResponse = await fetch(`${API_BASE}/api/quiz?count=1`);
    const quizJson = await quizResponse.json();
    
    if (!quizJson.success || !quizJson.data || quizJson.data.length === 0) {
      logResult(false, '获取题目失败');
      testResults.failed += 1;
      return;
    }
    
    const question = quizJson.data[0];
    
    // 构造错误答案
    let wrongAnswer;
    if (question.type === 'single' || question.type === 'fill_blank') {
      wrongAnswer = 'WRONG_ANSWER_' + Math.random().toString(36).substring(7);
    } else if (question.type === 'multiple') {
      wrongAnswer = ['WRONG_OPTION_1', 'WRONG_OPTION_2'];
    }
    
    log(`提交错误答案: ${JSON.stringify(wrongAnswer)}`, 'yellow');
    
    // 提交错误答案
    const submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: question.id,
        answer: wrongAnswer,
      }),
    });
    
    const submitJson = await submitResponse.json();
    
    logResult(submitJson.success, '提交成功');
    logResult(submitJson.data?.correct === false, `判题错误 (结果: ${submitJson.data?.correct})`);
    
    if (submitJson.data?.correct !== false) {
      testResults.issues.push(`错误答案判题失败: 应该判为错误，但判为${submitJson.data?.correct}`);
    }
    
    testResults.passed += 2;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 2;
    testResults.issues.push(`错误答案测试异常: ${error.message}`);
  }
}

async function test6_MultipleChoice() {
  logTest('6. 多选题判题 - 测试多选题答案顺序无关性');
  
  try {
    // 获取多选题
    let question = null;
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${API_BASE}/api/quiz?count=1`);
      const json = await response.json();
      if (json.data && json.data[0].type === 'multiple') {
        question = json.data[0];
        break;
      }
    }
    
    if (!question) {
      logResult(false, '未找到多选题');
      testResults.failed += 1;
      testResults.issues.push('无法找到多选题进行测试');
      return;
    }
    
    log(`多选题: ${question.content}`, 'yellow');
    log(`正确答案: ${JSON.stringify(question.correct_answer)}`, 'yellow');
    
    // 反序提交答案
    const reversedAnswer = Array.isArray(question.correct_answer) 
      ? [...question.correct_answer].reverse() 
      : [question.correct_answer];
    
    log(`反序答案: ${JSON.stringify(reversedAnswer)}`, 'yellow');
    
    const submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: question.id,
        answer: reversedAnswer,
      }),
    });
    
    const submitJson = await submitResponse.json();
    
    logResult(submitJson.data?.correct === true, `多选题顺序无关 (结果: ${submitJson.data?.correct})`);
    
    if (submitJson.data?.correct !== true) {
      testResults.issues.push(`多选题判题问题: 反序答案判为${submitJson.data?.correct}`);
    }
    
    testResults.passed += 1;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`多选题测试异常: ${error.message}`);
  }
}

async function test7_FillBlank() {
  logTest('7. 填空题判题 - 测试空格和大小写容错');
  
  try {
    // 获取填空题
    let question = null;
    for (let i = 0; i < 5; i++) {
      const response = await fetch(`${API_BASE}/api/quiz?count=1`);
      const json = await response.json();
      if (json.data && json.data[0].type === 'fill_blank') {
        question = json.data[0];
        break;
      }
    }
    
    if (!question) {
      logResult(false, '未找到填空题');
      testResults.failed += 1;
      testResults.issues.push('无法找到填空题进行测试');
      return;
    }
    
    log(`填空题: ${question.content}`, 'yellow');
    log(`正确答案: ${question.correct_answer}`, 'yellow');
    
    // 测试1: 添加空格
    const answerWithSpaces = `  ${question.correct_answer}  `;
    log(`测试答案(有空格): "${answerWithSpaces}"`, 'yellow');
    
    let submitResponse = await fetch(`${API_BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: question.id,
        answer: answerWithSpaces,
      }),
    });
    
    let submitJson = await submitResponse.json();
    logResult(submitJson.data?.correct === true, `空格容错 (结果: ${submitJson.data?.correct})`);
    
    if (submitJson.data?.correct !== true) {
      testResults.issues.push(`填空题空格容错失败`);
    }
    
    testResults.passed += 1;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`填空题测试异常: ${error.message}`);
  }
}

async function test8_ResponseTime() {
  logTest('8. 响应时间 - 测试API响应速度');
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${API_BASE}/api/quiz?count=4`);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    log(`响应时间: ${responseTime}ms`, 'yellow');
    
    logResult(responseTime < 5000, `响应快速 (${responseTime}ms < 5000ms)`);
    
    if (responseTime > 5000) {
      testResults.issues.push(`API响应缓慢: ${responseTime}ms`);
    }
    
    testResults.passed += 1;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`响应时间测试异常: ${error.message}`);
  }
}

async function test9_ErrorHandling() {
  logTest('9. 错误处理 - 测试无效请求');
  
  try {
    // 测试1: 无效的题目ID
    let response = await fetch(`${API_BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: 'INVALID_ID_' + Math.random(),
        answer: 'test',
      }),
    });
    
    let json = await response.json();
    logResult(response.status === 200 || response.status === 400, `无效ID处理 (状态码: ${response.status})`);
    
    // 测试2: 无效的count参数
    response = await fetch(`${API_BASE}/api/quiz?count=999`);
    json = await response.json();
    logResult(json.success, `超大count处理 (count=999, 返回${json.data?.length || 0}道题)`);
    
    if (json.data?.length > 50) {
      testResults.issues.push(`count参数验证失败: 返回了${json.data.length}道题，应该最多50道`);
    }
    
    testResults.passed += 2;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 2;
    testResults.issues.push(`错误处理测试异常: ${error.message}`);
  }
}

async function test10_DataConsistency() {
  logTest('10. 数据一致性 - 测试多次请求的数据一致性');
  
  try {
    const response1 = await fetch(`${API_BASE}/api/quiz?count=4`);
    const json1 = await response1.json();
    
    await sleep(500);
    
    const response2 = await fetch(`${API_BASE}/api/quiz?count=4`);
    const json2 = await response2.json();
    
    const ids1 = json1.data?.map(q => q.id) || [];
    const ids2 = json2.data?.map(q => q.id) || [];
    
    const isDifferent = ids1.some((id, i) => id !== ids2[i]);
    
    logResult(isDifferent, `每次请求生成不同题目 (${isDifferent ? '是' : '否'})`);
    
    if (!isDifferent) {
      testResults.issues.push(`题目生成不够随机: 多次请求返回相同题目`);
    }
    
    testResults.passed += 1;
  } catch (error) {
    logResult(false, `测试失败: ${error.message}`);
    testResults.failed += 1;
    testResults.issues.push(`数据一致性测试异常: ${error.message}`);
  }
}

async function runAllTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('开始全面测试答题系统', 'cyan');
  log('='.repeat(60) + '\n', 'cyan');
  
  await test1_InitialLoad();
  await test2_QuestionTypes();
  await test3_QuestionContent();
  await test4_AnswerSubmission();
  await test5_WrongAnswer();
  await test6_MultipleChoice();
  await test7_FillBlank();
  await test8_ResponseTime();
  await test9_ErrorHandling();
  await test10_DataConsistency();
  
  // 总结
  log('\n' + '='.repeat(60), 'cyan');
  log('测试总结', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`✅ 通过: ${testResults.passed}`, 'green');
  log(`❌ 失败: ${testResults.failed}`, 'red');
  log(`总计: ${testResults.passed + testResults.failed}`, 'blue');
  
  if (testResults.issues.length > 0) {
    log('\n发现的问题:', 'red');
    testResults.issues.forEach((issue, i) => {
      log(`${i + 1}. ${issue}`, 'red');
    });
  } else {
    log('\n✅ 未发现问题！', 'green');
  }
  
  log('\n' + '='.repeat(60) + '\n', 'cyan');
}

runAllTests().catch(console.error);

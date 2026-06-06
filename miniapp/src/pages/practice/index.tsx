import { Component, PropsWithChildren } from 'react';
import { View, Text, Radio, Checkbox, Input } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { Question, PracticeConfig, QuestionType } from '@/types';
import { getDifficultyText, getDifficultyColor, formatDuration } from '@/utils';
import api from '@/services/api';
import usePracticeStore from '@/stores/usePracticeStore';
import './index.scss';

interface PracticeState {
  isStarted: boolean;
  config: PracticeConfig;
  questions: Question[];
  currentIndex: number;
  answers: Record<number, string | string[]>;
  showAnswer: boolean;
  timeCost: Record<number, number>;
  startTime: number;
  isLoading: boolean;
}

export default class Practice extends Component<PropsWithChildren, PracticeState> {
  private timer: any;

  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      isStarted: false,
      config: {
        questionCount: 10,
        questionTypes: ['single', 'multiple', 'judge']
      },
      questions: [],
      currentIndex: 0,
      answers: {},
      showAnswer: false,
      timeCost: {},
      startTime: 0,
      isLoading: false
    };
  }

  componentDidMount() {
    const instance = getCurrentInstance();
    const params = instance?.router?.params || {};

    // 从 URL 参数获取配置
    if (params.knowledgePointId) {
      this.setState(prev => ({
        config: {
          ...prev.config,
          knowledgePointId: params.knowledgePointId
        }
      }));
    }

    if (params.difficulty) {
      this.setState(prev => ({
        config: {
          ...prev.config,
          difficulty: params.difficulty as any
        }
      }));
    }

    // 从本地存储读取 mode 参数（从首页 tabBar 跳转时传递）
    const practiceMode = Taro.getStorageSync('practiceMode');
    if (practiceMode) {
      Taro.removeStorageSync('practiceMode'); // 读取后清除
      if (practiceMode === 'wrong') {
        this.loadWrongQuestions();
      } else if (practiceMode === 'random') {
        this.handleStartPractice();
      }
    } else if (params.mode === 'wrong') {
      this.loadWrongQuestions();
    }
  }

  componentWillUnmount() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  loadWrongQuestions = async () => {
    try {
      this.setState({ isLoading: true });
      const res = await api.getWrongQuestions(1, 20);

      if (res.code === 200) {
        const questions = res.data.list.map((item: any) => item.question);
        this.setState({
          questions,
          isStarted: true,
          startTime: Date.now()
        });
        this.startTimer();
      }
    } catch (error) {
      console.error('加载错题失败:', error);
      Taro.showToast({ title: '加载错题失败', icon: 'error' });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handleConfigChange = (key: keyof PracticeConfig, value: any) => {
    this.setState(prev => ({
      config: { ...prev.config, [key]: value }
    }));
  };

  handleTypeToggle = (type: QuestionType) => {
    this.setState(prev => {
      const types = prev.config.questionTypes.includes(type)
        ? prev.config.questionTypes.filter(t => t !== type)
        : [...prev.config.questionTypes, type];
      return {
        config: { ...prev.config, questionTypes: types }
      };
    });
  };

  handleStartPractice = async () => {
    const { config } = this.state;

    try {
      this.setState({ isLoading: true });
      const res = await api.getQuestions({
        knowledgePointId: config.knowledgePointId,
        difficulty: config.difficulty,
        count: config.questionCount,
        types: config.questionTypes
      });

      if (res.code === 200 && res.data.length > 0) {
        this.setState({
          questions: res.data,
          isStarted: true,
          currentIndex: 0,
          answers: {},
          showAnswer: false,
          timeCost: {},
          startTime: Date.now()
        });
        this.startTimer();
      } else {
        Taro.showToast({ title: '暂无题目', icon: 'none' });
      }
    } catch (error) {
      console.error('加载题目失败:', error);
      Taro.showToast({ title: '加载题目失败', icon: 'error' });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  startTimer = () => {
    this.timer = setInterval(() => {
      this.setState(prev => {
        const { currentIndex, timeCost, startTime } = prev;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        return {
          timeCost: { ...timeCost, [currentIndex]: elapsed }
        };
      });
    }, 1000);
  };

  handleAnswer = (answer: string | string[]) => {
    const { currentIndex } = this.state;
    this.setState(prev => ({
      answers: { ...prev.answers, [currentIndex]: answer }
    }));
  };

  handleSingleChoice = (value: string) => {
    this.handleAnswer(value);
  };

  handleMultipleChoice = (value: string) => {
    const { currentIndex, answers } = this.state;
    const currentAnswer = (answers[currentIndex] as string[]) || [];
    const newAnswer = currentAnswer.includes(value)
      ? currentAnswer.filter(v => v !== value)
      : [...currentAnswer, value];
    this.handleAnswer(newAnswer);
  };

  handleJudgeChoice = (value: string) => {
    this.handleAnswer(value);
  };

  handleFillInput = (e: any) => {
    this.handleAnswer(e.detail.value);
  };

  handleSubmitAnswer = () => {
    const { currentIndex, answers } = this.state;
    const answer = answers[currentIndex];

    if (!answer || (Array.isArray(answer) && answer.length === 0)) {
      Taro.showToast({ title: '请选择答案', icon: 'none' });
      return;
    }

    this.setState({ showAnswer: true });
  };

  handleNextQuestion = () => {
    const { currentIndex, questions } = this.state;
    if (currentIndex < questions.length - 1) {
      this.setState({
        currentIndex: currentIndex + 1,
        showAnswer: false
      });
    }
  };

  handlePrevQuestion = () => {
    const { currentIndex } = this.state;
    if (currentIndex > 0) {
      this.setState({
        currentIndex: currentIndex - 1,
        showAnswer: false
      });
    }
  };

  handleEndPractice = () => {
    if (this.timer) {
      clearInterval(this.timer);
    }

    const { questions, answers, timeCost } = this.state;
    let correctCount = 0;

    questions.forEach((q, index) => {
      const userAnswer = answers[index];
      if (this.checkAnswer(q, userAnswer)) {
        correctCount++;
      }
    });

    const totalTime = Object.values(timeCost).reduce((sum, t) => sum + t, 0);

    Taro.redirectTo({
      url: `/pages/practice-result/index?total=${questions.length}&correct=${correctCount}&time=${totalTime}`
    });
  };

  checkAnswer = (question: Question, userAnswer: string | string[] | undefined): boolean => {
    if (!userAnswer) return false;

    if (Array.isArray(question.answer)) {
      if (!Array.isArray(userAnswer)) return false;
      return (
        userAnswer.sort().join(',') === question.answer.sort().join(',')
      );
    }

    return userAnswer === question.answer;
  };

  renderConfigPanel = () => {
    const { config } = this.state;

    return (
      <View className='config-panel'>
        <View className='config-title'>练习配置</View>

        <View className='config-section'>
          <Text className='config-label'>题目数量</Text>
          <View className='count-options'>
            {[5, 10, 15, 20].map(count => (
              <View
                key={count}
                className={`count-option ${config.questionCount === count ? 'active' : ''}`}
                onClick={() => this.handleConfigChange('questionCount', count)}
              >
                <Text className='count-text'>{count}题</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='config-section'>
          <Text className='config-label'>题目难度</Text>
          <View className='difficulty-options'>
            {(['easy', 'medium', 'hard'] as const).map(difficulty => (
              <View
                key={difficulty}
                className={`difficulty-option ${config.difficulty === difficulty ? 'active' : ''}`}
                style={{
                  backgroundColor: config.difficulty === difficulty
                    ? getDifficultyColor(difficulty)
                    : '#F5F5F5'
                }}
                onClick={() => this.handleConfigChange('difficulty', difficulty)}
              >
                <Text
                  className='difficulty-text'
                  style={{
                    color: config.difficulty === difficulty ? '#FFFFFF' : '#666666'
                  }}
                >
                  {getDifficultyText(difficulty)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View className='config-section'>
          <Text className='config-label'>题目类型</Text>
          <View className='type-options'>
            {([
              { value: 'single', label: '单选题' },
              { value: 'multiple', label: '多选题' },
              { value: 'judge', label: '判断题' },
              { value: 'fill', label: '填空题' }
            ] as const).map(type => (
              <View
                key={type.value}
                className={`type-option ${config.questionTypes.includes(type.value) ? 'active' : ''}`}
                onClick={() => this.handleTypeToggle(type.value)}
              >
                <Text className='type-text'>{type.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='start-btn' onClick={this.handleStartPractice}>
          <Text className='start-btn-text'>开始练习</Text>
        </View>
      </View>
    );
  };

  renderQuestion = () => {
    const { questions, currentIndex, answers, showAnswer } = this.state;
    const question = questions[currentIndex];
    const answer = answers[currentIndex];
    const isCorrect = this.checkAnswer(question, answer);

    return (
      <View className='question-panel'>
        {/* 进度条 */}
        <View className='progress-bar'>
          <View
            className='progress-fill'
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </View>
        <View className='progress-text'>
          <Text>{currentIndex + 1} / {questions.length}</Text>
        </View>

        {/* 题目信息 */}
        <View className='question-header'>
          <View
            className='type-tag'
            style={{ backgroundColor: this.getQuestionTypeColor(question.type) }}
          >
            <Text className='type-tag-text'>{this.getQuestionTypeText(question.type)}</Text>
          </View>
          <View
            className='difficulty-tag'
            style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
          >
            <Text className='difficulty-tag-text'>{getDifficultyText(question.difficulty)}</Text>
          </View>
          <Text className='knowledge-point'>{question.knowledgePointName}</Text>
        </View>

        {/* 题目内容 */}
        <View className='question-content'>
          <Text className='question-text'>{question.content}</Text>
        </View>

        {/* 选项 */}
        <View className='options-section'>
          {this.renderOptions(question, answer)}
        </View>

        {/* 答案解析 */}
        {showAnswer && (
          <View className={`answer-section ${isCorrect ? 'correct' : 'wrong'}`}>
            <View className='answer-header'>
              <Text className='answer-result'>
                {isCorrect ? '✓ 回答正确' : '✗ 回答错误'}
              </Text>
              <Text className='correct-answer'>
                正确答案：{Array.isArray(question.answer) ? question.answer.join(', ') : question.answer}
              </Text>
            </View>
            <View className='explanation'>
              <Text className='explanation-title'>解析：</Text>
              <Text className='explanation-content'>{question.explanation}</Text>
            </View>
          </View>
        )}

        {/* 操作按钮 */}
        <View className='action-buttons'>
          {!showAnswer ? (
            <View className='submit-btn' onClick={this.handleSubmitAnswer}>
              <Text className='submit-btn-text'>提交答案</Text>
            </View>
          ) : (
            <View className='next-btn' onClick={
              currentIndex === questions.length - 1
                ? this.handleEndPractice
                : this.handleNextQuestion
            }>
              <Text className='next-btn-text'>
                {currentIndex === questions.length - 1 ? '查看结果' : '下一题'}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  renderOptions = (question: Question, answer: string | string[] | undefined) => {
    switch (question.type) {
      case 'single':
        return this.renderSingleOptions(question, answer as string);
      case 'multiple':
        return this.renderMultipleOptions(question, answer as string[]);
      case 'judge':
        return this.renderJudgeOptions(question, answer as string);
      case 'fill':
        return this.renderFillInput(answer as string);
      default:
        return null;
    }
  };

  renderSingleOptions = (question: Question, answer: string | undefined) => {
    return (
      <View className='options-list'>
        {question.options?.map((option) => (
          <View
            key={option.key}
            className={`option-item ${answer === option.key ? 'selected' : ''}`}
            onClick={() => this.handleSingleChoice(option.key)}
          >
            <View className='option-radio'>
              <View className={`radio-dot ${answer === option.key ? 'checked' : ''}`} />
            </View>
            <Text className='option-text'>{option.key}. {option.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  renderMultipleOptions = (question: Question, answer: string[] | undefined) => {
    const selected = answer || [];
    return (
      <View className='options-list'>
        {question.options?.map((option) => (
          <View
            key={option.key}
            className={`option-item ${selected.includes(option.key) ? 'selected' : ''}`}
            onClick={() => this.handleMultipleChoice(option.key)}
          >
            <View className='option-checkbox'>
              <View className={`checkbox-dot ${selected.includes(option.key) ? 'checked' : ''}`} />
            </View>
            <Text className='option-text'>{option.key}. {option.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  renderJudgeOptions = (question: Question, answer: string | undefined) => {
    return (
      <View className='judge-options'>
        <View
          className={`judge-option ${answer === 'true' ? 'selected' : ''}`}
          onClick={() => this.handleJudgeChoice('true')}
        >
          <Text className='judge-text'>✓ 正确</Text>
        </View>
        <View
          className={`judge-option ${answer === 'false' ? 'selected' : ''}`}
          onClick={() => this.handleJudgeChoice('false')}
        >
          <Text className='judge-text'>✗ 错误</Text>
        </View>
      </View>
    );
  };

  renderFillInput = (answer: string | undefined) => {
    return (
      <View className='fill-input'>
        <Input
          className='input-field'
          placeholder='请输入答案'
          value={answer || ''}
          onInput={this.handleFillInput}
        />
      </View>
    );
  };

  render() {
    const { isStarted, isLoading } = this.state;

    return (
      <View className='practice-page'>
        {isLoading ? (
          <View className='loading'>加载中...</View>
        ) : isStarted ? (
          this.renderQuestion()
        ) : (
          this.renderConfigPanel()
        )}
      </View>
    );
  }

  private getQuestionTypeText(type: string): string {
    const map: Record<string, string> = {
      single: '单选',
      multiple: '多选',
      judge: '判断',
      fill: '填空'
    };
    return map[type] || type;
  }

  private getQuestionTypeColor(type: string): string {
    const map: Record<string, string> = {
      single: '#1890FF',
      multiple: '#722ED1',
      judge: '#13C2C2',
      fill: '#EB2F96'
    };
    return map[type] || '#999999';
  }
}

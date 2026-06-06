import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { getCurrentInstance } from '@tarojs/taro';
import { Question } from '@/types';
import { getDifficultyText, getDifficultyColor } from '@/utils';
import api from '@/services/api';
import './index.scss';

interface DetailState {
  question: Question | null;
  isLoading: boolean;
}

export default class QuestionDetail extends Component<PropsWithChildren, DetailState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      question: null,
      isLoading: true
    };
  }

  componentDidMount() {
    const instance = getCurrentInstance();
    const params = instance?.router?.params || {};

    if (params.id) {
      this.loadQuestion(params.id);
    }
  }

  loadQuestion = async (id: string) => {
    try {
      this.setState({ isLoading: true });
      const res = await api.getQuestionDetail(id);

      if (res.code === 200) {
        this.setState({ question: res.data });
      }
    } catch (error) {
      console.error('加载题目详情失败:', error);
      Taro.showToast({ title: '加载失败', icon: 'error' });
    } finally {
      this.setState({ isLoading: false });
    }
  };

  handlePractice = () => {
    const { question } = this.state;
    if (question) {
      Taro.navigateTo({
        url: `/pages/practice/index?knowledgePointId=${question.knowledgePointId}&knowledgePointName=${encodeURIComponent(question.knowledgePointName)}`
      });
    }
  };

  render() {
    const { question, isLoading } = this.state;

    if (isLoading) {
      return (
        <View className='detail-page'>
          <View className='loading'>加载中...</View>
        </View>
      );
    }

    if (!question) {
      return (
        <View className='detail-page'>
          <View className='empty'>题目不存在</View>
        </View>
      );
    }

    return (
      <View className='detail-page'>
        {/* 题目信息 */}
        <View className='question-info'>
          <View className='info-header'>
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
          </View>
          <Text className='knowledge-name'>{question.knowledgePointName}</Text>
        </View>

        {/* 题目内容 */}
        <View className='question-content'>
          <Text className='question-text'>{question.content}</Text>
        </View>

        {/* 选项 */}
        {question.options && question.options.length > 0 && (
          <View className='options-section'>
            <Text className='section-title'>选项</Text>
            <View className='options-list'>
              {question.options.map((option) => (
                <View key={option.key} className='option-item'>
                  <Text className='option-key'>{option.key}.</Text>
                  <Text className='option-value'>{option.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 正确答案 */}
        <View className='answer-section'>
          <Text className='section-title'>正确答案</Text>
          <View className='answer-content'>
            <Text className='answer-text'>
              {Array.isArray(question.answer) ? question.answer.join(', ') : question.answer}
            </Text>
          </View>
        </View>

        {/* 解析 */}
        <View className='explanation-section'>
          <Text className='section-title'>解析</Text>
          <View className='explanation-content'>
            <Text className='explanation-text'>{question.explanation}</Text>
          </View>
        </View>

        {/* 操作按钮 */}
        <View className='action-buttons'>
          <View className='action-btn practice-btn' onClick={this.handlePractice}>
            <Text className='action-btn-text'>练习同类题目</Text>
          </View>
        </View>
      </View>
    );
  }

  private getQuestionTypeText(type: string): string {
    const map: Record<string, string> = {
      single: '单选题',
      multiple: '多选题',
      judge: '判断题',
      fill: '填空题'
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

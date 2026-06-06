import { Component, PropsWithChildren } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { ChatMessage } from '@/types';
import { formatTime, generateId } from '@/utils';
import api from '@/services/api';
import './index.scss';

interface ChatState {
  messages: ChatMessage[];
  inputText: string;
  isLoading: boolean;
  scrollToView: string;
  sessionId: string;
}

export default class AiChat extends Component<PropsWithChildren, ChatState> {
  constructor(props: PropsWithChildren) {
    super(props);
    this.state = {
      messages: [],
      inputText: '',
      isLoading: false,
      scrollToView: '',
      sessionId: `session_${Date.now()}`
    };
  }

  componentDidMount() {
    this.loadHistory();
  }

  loadHistory = async () => {
    try {
      const res = await api.getChatHistory();
      if (res.code === 200 && res.data.list.length > 0) {
        this.setState({ messages: res.data.list });
        this.scrollToBottom();
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
  };

  handleInputChange = (e: any) => {
    this.setState({ inputText: e.detail.value });
  };

  handleSendMessage = async () => {
    const { inputText, messages, sessionId } = this.state;

    if (!inputText.trim()) {
      Taro.showToast({ title: '请输入消息', icon: 'none' });
      return;
    }

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: inputText.trim(),
      timestamp: new Date().toISOString()
    };

    this.setState({
      messages: [...messages, userMessage],
      inputText: '',
      isLoading: true
    });

    this.scrollToBottom();

    try {
      const res = await api.sendMessage(inputText.trim(), sessionId);

      if (res.code === 200) {
        const assistantMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: res.data.reply,
          timestamp: new Date().toISOString()
        };

        this.setState(prev => ({
          messages: [...prev.messages, assistantMessage]
        }));
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      Taro.showToast({ title: '发送失败', icon: 'error' });
    } finally {
      this.setState({ isLoading: false });
      this.scrollToBottom();
    }
  };

  handleKeyDown = (e: any) => {
    if (e.keyCode === 13 && !e.shiftKey) {
      e.preventDefault();
      this.handleSendMessage();
    }
  };

  scrollToBottom = () => {
    const { messages } = this.state;
    if (messages.length > 0) {
      this.setState({
        scrollToView: `msg-${messages[messages.length - 1].id}`
      });
    }
  };

  renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';

    return (
      <View
        key={message.id}
        id={`msg-${message.id}`}
        className={`message-item ${isUser ? 'user' : 'assistant'}`}
      >
        {!isUser && (
          <View className='avatar assistant-avatar'>
            <Text className='avatar-text'>AI</Text>
          </View>
        )}
        <View className={`message-content ${isUser ? 'user-content' : 'assistant-content'}`}>
          <Text className='message-text'>{message.content}</Text>
          <Text className='message-time'>{formatTime(message.timestamp)}</Text>
        </View>
        {isUser && (
          <View className='avatar user-avatar'>
            <Text className='avatar-text'>我</Text>
          </View>
        )}
      </View>
    );
  };

  render() {
    const { messages, inputText, isLoading, scrollToView } = this.state;

    return (
      <View className='chat-page'>
        {/* 消息列表 */}
        <ScrollView
          className='message-list'
          scrollY
          scrollIntoView={scrollToView}
          scrollWithAnimation
        >
          {messages.length === 0 ? (
            <View className='welcome-section'>
              <View className='welcome-icon'>
                <Text className='welcome-icon-text'>AI</Text>
              </View>
              <Text className='welcome-title'>你好！我是 AI 学习助手</Text>
              <Text className='welcome-desc'>
                我可以帮你解答学习问题、提供学习建议、分析知识点等。有什么我可以帮你的吗？
              </Text>
              <View className='quick-questions'>
                <View
                  className='quick-question'
                  onClick={() => this.setState({ inputText: '请介绍一下数据结构与算法的学习路径' })}
                >
                  <Text className='quick-question-text'>学习路径建议</Text>
                </View>
                <View
                  className='quick-question'
                  onClick={() => this.setState({ inputText: '请解释一下什么是二叉树' })}
                >
                  <Text className='quick-question-text'>概念解释</Text>
                </View>
                <View
                  className='quick-question'
                  onClick={() => this.setState({ inputText: '请分析我的学习薄弱点' })}
                >
                  <Text className='quick-question-text'>学习分析</Text>
                </View>
              </View>
            </View>
          ) : (
            messages.map(this.renderMessage)
          )}

          {isLoading && (
            <View className='message-item assistant'>
              <View className='avatar assistant-avatar'>
                <Text className='avatar-text'>AI</Text>
              </View>
              <View className='message-content assistant-content'>
                <View className='typing-indicator'>
                  <View className='typing-dot' />
                  <View className='typing-dot' />
                  <View className='typing-dot' />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* 输入区域 */}
        <View className='input-section'>
          <View className='input-wrapper'>
            <Input
              className='input-field'
              placeholder='输入你的问题...'
              value={inputText}
              onInput={this.handleInputChange}
              onConfirm={this.handleSendMessage}
              confirmType='send'
              disabled={isLoading}
            />
            <View
              className={`send-btn ${inputText.trim() && !isLoading ? 'active' : ''}`}
              onClick={this.handleSendMessage}
            >
              <Text className='send-btn-text'>发送</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }
}

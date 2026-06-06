import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface QuestionOptionProps {
  optionKey: string;
  content: string;
  selected?: boolean;
  correct?: boolean;
  showResult?: boolean;
  onClick?: (key: string) => void;
}

export default class QuestionOption extends Component<PropsWithChildren<QuestionOptionProps>> {
  static defaultProps = {
    selected: false,
    correct: false,
    showResult: false
  };

  handleClick = () => {
    const { optionKey, onClick } = this.props;
    if (onClick) {
      onClick(optionKey);
    }
  };

  render() {
    const { optionKey, content, selected, correct, showResult } = this.props;

    let statusClass = '';
    if (showResult) {
      statusClass = correct ? 'correct' : (selected && !correct ? 'wrong' : '');
    } else if (selected) {
      statusClass = 'selected';
    }

    return (
      <View
        className={`question-option ${statusClass}`}
        onClick={this.handleClick}
      >
        <View className='option-key'>
          <Text className='key-text'>{optionKey}</Text>
        </View>
        <View className='option-content'>
          <Text className='content-text'>{content}</Text>
        </View>
        {showResult && (
          <View className='option-result'>
            <Text className='result-icon'>{correct ? '✓' : (selected ? '✗' : '')}</Text>
          </View>
        )}
      </View>
    );
  }
}

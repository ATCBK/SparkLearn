import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface EmptyProps {
  icon?: string;
  text?: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

export default class Empty extends Component<PropsWithChildren<EmptyProps>> {
  static defaultProps = {
    icon: '📭',
    text: '暂无数据',
  };

  render() {
    const { icon, text, buttonText, onButtonClick } = this.props;

    return (
      <View className='empty-component'>
        <View className='empty-icon'>
          <Text className='icon-text'>{icon}</Text>
        </View>
        <Text className='empty-text'>{text}</Text>
        {buttonText && onButtonClick && (
          <View className='empty-button' onClick={onButtonClick}>
            <Text className='button-text'>{buttonText}</Text>
          </View>
        )}
      </View>
    );
  }
}

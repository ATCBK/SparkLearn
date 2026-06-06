import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface LoadingProps {
  text?: string;
  size?: 'small' | 'medium' | 'large';
}

export default class Loading extends Component<PropsWithChildren<LoadingProps>> {
  static defaultProps = {
    text: '加载中...',
    size: 'medium'
  };

  render() {
    const { text, size } = this.props;

    return (
      <View className={`loading-component ${size}`}>
        <View className='loading-spinner'>
          <View className='spinner-dot' />
          <View className='spinner-dot' />
          <View className='spinner-dot' />
        </View>
        {text && <Text className='loading-text'>{text}</Text>}
      </View>
    );
  }
}

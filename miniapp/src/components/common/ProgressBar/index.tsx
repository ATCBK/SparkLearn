import { Component, PropsWithChildren } from 'react';
import { View, Text } from '@tarojs/components';
import './index.scss';

interface ProgressBarProps {
  percent: number;
  color?: string;
  showText?: boolean;
  height?: number;
}

export default class ProgressBar extends Component<PropsWithChildren<ProgressBarProps>> {
  static defaultProps = {
    color: '#1890FF',
    showText: true,
    height: 12
  };

  render() {
    const { percent, color, showText, height } = this.props;
    const validPercent = Math.min(100, Math.max(0, percent));

    return (
      <View className='progress-bar-component'>
        <View className='progress-track' style={{ height: `${height}px` }}>
          <View
            className='progress-fill'
            style={{
              width: `${validPercent}%`,
              backgroundColor: color,
              height: `${height}px`
            }}
          />
        </View>
        {showText && (
          <Text className='progress-text' style={{ color }}>
            {validPercent}%
          </Text>
        )}
      </View>
    );
  }
}

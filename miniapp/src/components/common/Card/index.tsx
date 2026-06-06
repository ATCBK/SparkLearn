import { Component, PropsWithChildren } from 'react';
import { View } from '@tarojs/components';
import './index.scss';

interface CardProps {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default class Card extends Component<PropsWithChildren<CardProps>> {
  render() {
    const { className, style, onClick, children } = this.props;

    return (
      <View
        className={`card-component ${className || ''}`}
        style={style}
        onClick={onClick}
      >
        {children}
      </View>
    );
  }
}

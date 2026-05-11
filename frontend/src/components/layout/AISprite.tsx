'use client'

import styled from 'styled-components'

interface AISpriteProps {
  onClick: () => void
}

export function AISprite({ onClick }: AISpriteProps) {
  return (
    <StyledWrapper>
      <div className="container-ai-input">
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <div className="area" />
        <label className="container-wrap" onClick={onClick}>
          <input type="checkbox" readOnly checked={false} />
          <div className="card">
            <div className="background-blur-balls">
              <div className="balls">
                <span className="ball rosa" />
                <span className="ball violet" />
                <span className="ball green" />
                <span className="ball cyan" />
              </div>
            </div>
            <div className="content-card">
              <div className="background-blur-card">
                <div className="eyes">
                  <span className="eye" />
                  <span className="eye" />
                </div>
                <div className="eyes happy">
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z"
                    />
                  </svg>
                  <svg fill="none" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M8.28386 16.2843C8.9917 15.7665 9.8765 14.731 12 14.731C14.1235 14.731 15.0083 15.7665 15.7161 16.2843C17.8397 17.8376 18.7542 16.4845 18.9014 15.7665C19.4323 13.1777 17.6627 11.1066 17.3088 10.5888C16.3844 9.23666 14.1235 8 12 8C9.87648 8 7.61556 9.23666 6.69122 10.5888C6.33728 11.1066 4.56771 13.1777 5.09858 15.7665C5.24582 16.4845 6.16034 17.8376 8.28386 16.2843Z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </label>
      </div>
    </StyledWrapper>
  )
}

const StyledWrapper = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
  width: 80px;
  height: 80px;

  .container-ai-input {
    --perspective: 1000px;
    --translateY: 10px;
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(3, 1fr);
    transform-style: preserve-3d;
  }

  .container-wrap {
    display: flex;
    align-items: center;
    justify-items: center;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    z-index: 9;
    transform-style: preserve-3d;
    cursor: pointer;
    padding: 4px;
    transition: all 0.3s ease;
  }

  .container-wrap:hover {
    padding: 0;
  }

  .container-wrap:active {
    transform: translateX(-50%) translateY(-50%) scale(0.95);
  }

  .container-wrap:after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-55%);
    width: 5rem;
    height: 4.6rem;
    background-color: #dedfe0;
    border-radius: 1.6rem;
    transition: all 0.3s ease;
  }

  .container-wrap:hover:after {
    transform: translateX(-50%) translateY(-50%);
    height: 5rem;
  }

  .container-wrap input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .card {
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    will-change: transform;
    transition: all 0.6s ease;
    border-radius: 1.5rem;
    display: flex;
    align-items: center;
    transform: translateZ(20px);
    justify-content: center;
  }

  .card:hover {
    box-shadow:
      0 10px 40px rgba(0, 0, 60, 0.25),
      inset 0 0 10px rgba(255, 255, 255, 0.5);
  }

  .background-blur-balls {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    width: 100%;
    height: 100%;
    z-index: -10;
    border-radius: 1.5rem;
    transition: all 0.3s ease;
    background-color: rgba(255, 255, 255, 0.8);
    overflow: hidden;
  }

  .balls {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateX(-50%) translateY(-50%);
    animation: rotate-background-balls 10s linear infinite;
  }

  .container-wrap:hover .balls {
    animation-play-state: paused;
  }

  .background-blur-balls .ball {
    width: 3rem;
    height: 3rem;
    position: absolute;
    border-radius: 50%;
    filter: blur(14px);
  }

  .background-blur-balls .ball.violet {
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: #9147ff;
  }

  .background-blur-balls .ball.green {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background-color: #34d399;
  }

  .background-blur-balls .ball.rosa {
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    background-color: #ec4899;
  }

  .background-blur-balls .ball.cyan {
    top: 50%;
    right: 0;
    transform: translateY(-50%);
    background-color: #05e0f5;
  }

  .content-card {
    width: 5rem;
    height: 5rem;
    display: flex;
    border-radius: 1.5rem;
    transition: all 0.3s ease;
    overflow: hidden;
  }

  .background-blur-card {
    width: 100%;
    height: 100%;
    backdrop-filter: blur(50px);
  }

  .eyes {
    position: absolute;
    left: 50%;
    bottom: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    gap: 0.8rem;
    transition: all 0.3s ease;

    & .eye {
      width: 13px;
      height: 26px;
      background-color: #fff;
      border-radius: 8px;
      animation: animate-eyes 10s infinite linear;
      transition: all 0.3s ease;
    }
  }

  .eyes.happy {
    display: none;
    color: #fff;
    gap: 0;

    & svg {
      width: 30px;
    }
  }

  .container-wrap:hover .eyes .eye {
    display: none;
  }

  .container-wrap:hover .eyes.happy {
    display: flex;
  }

  /* 3D tilt areas */
  .area:nth-child(15):hover ~ .container-wrap .card,
  .area:nth-child(15):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(14):hover ~ .container-wrap .card,
  .area:nth-child(14):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(13):hover ~ .container-wrap .card,
  .area:nth-child(13):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(0)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(12):hover ~ .container-wrap .card,
  .area:nth-child(12):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(-7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(11):hover ~ .container-wrap .card,
  .area:nth-child(11):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(-15deg) rotateY(-15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(10):hover ~ .container-wrap .card,
  .area:nth-child(10):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(9):hover ~ .container-wrap .card,
  .area:nth-child(9):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(8):hover ~ .container-wrap .card,
  .area:nth-child(8):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(0)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(7):hover ~ .container-wrap .card,
  .area:nth-child(7):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(-7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(6):hover ~ .container-wrap .card,
  .area:nth-child(6):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(0) rotateY(-15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(5):hover ~ .container-wrap .card,
  .area:nth-child(5):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(4):hover ~ .container-wrap .card,
  .area:nth-child(4):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(3):hover ~ .container-wrap .card,
  .area:nth-child(3):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(0)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(2):hover ~ .container-wrap .card,
  .area:nth-child(2):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(-7deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  .area:nth-child(1):hover ~ .container-wrap .card,
  .area:nth-child(1):hover ~ .container-wrap .eyes .eye {
    transform: perspective(var(--perspective)) rotateX(15deg) rotateY(-15deg)
      translateZ(var(--translateY)) scale3d(1, 1, 1);
  }

  @keyframes rotate-background-balls {
    from {
      transform: translateX(-50%) translateY(-50%) rotate(360deg);
    }
    to {
      transform: translateX(-50%) translateY(-50%) rotate(0);
    }
  }

  @keyframes animate-eyes {
    46% { height: 26px; }
    48% { height: 10px; }
    50% { height: 26px; }
    96% { height: 26px; }
    98% { height: 10px; }
    100% { height: 26px; }
  }
`

export default AISprite

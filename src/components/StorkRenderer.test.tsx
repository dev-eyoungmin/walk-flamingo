import React from 'react';
import { render } from '@testing-library/react-native';
import { StorkRenderer } from './StorkRenderer';
import { useSharedValue } from 'react-native-reanimated';

// Mock Skia
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  const View = require('react-native').View;
  return {
    Group: (props) => <View {...props} testID="Group" />,
    Circle: (props) => <View {...props} testID="Circle" />,
    Rect: (props) => <View {...props} testID="Rect" />,
    Path: (props) => <View {...props} testID="Path" />,
    vec: (x, y) => ({ x, y }),
    Skia: {
      Path: {
        Make: () => ({
          moveTo: jest.fn(),
          lineTo: jest.fn(),
          quadTo: jest.fn(),
          cubicTo: jest.fn(),
          addRRect: jest.fn(),
          close: jest.fn(),
        }),
        MakeFromSVGString: () => ({}),
      },
    },
  };
});

describe('StorkRenderer', () => {
  it('renders without crashing', () => {
    const TestComponent = () => {
      const angle = useSharedValue(0);
      const animFrame = useSharedValue(0);
      const elapsedTime = useSharedValue(0);

      return (
        <StorkRenderer
          width={800}
          height={400}
          angle={angle}
          animFrame={animFrame}
          elapsedTime={elapsedTime}
        />
      );
    };

    const { toJSON } = render(<TestComponent />);
    expect(toJSON()).toMatchSnapshot();
  });
});

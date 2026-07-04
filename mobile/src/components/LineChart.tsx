import React from 'react';
import { View, Dimensions } from 'react-native';
import Svg, { Circle, Text as SvgText, Path } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

interface ChartPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: ChartPoint[];
  height?: number;
}

export const LineChart: React.FC<LineChartProps> = ({ data, height = 180 }) => {
  const theme = useTheme();
  const screenWidth = Dimensions.get('window').width - 32;

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => d.value), 100);
  const minVal = 0;
  
  const paddingLeft = 40;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = screenWidth - paddingLeft - paddingRight;
  const graphHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1)) * graphWidth;
    const y = paddingTop + graphHeight - ((d.value - minVal) / (maxVal - minVal)) * graphHeight;
    return { x, y, label: d.label, value: d.value };
  });

  // Build SVG path
  let pathD = '';
  points.forEach((p, idx) => {
    if (idx === 0) {
      pathD = `M ${p.x} ${p.y}`;
    } else {
      pathD += ` L ${p.x} ${p.y}`;
    }
  });

  return (
    <View style={{ marginVertical: 8, padding: 8, backgroundColor: '#1E1E1E', borderRadius: 12 }}>
      <Svg width={screenWidth} height={height}>
        {/* Draw path */}
        {pathD && (
          <Path
            d={pathD}
            fill="none"
            stroke={theme.colors.primary || '#FF6B6B'}
            strokeWidth="3"
          />
        )}

        {/* Draw grid lines and markers */}
        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Circle cx={p.x} cy={p.y} r="4" fill="#FFFFFF" />
            <SvgText
              x={p.x}
              y={height - 10}
              fill="#A0A0A0"
              fontSize="10"
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
            <SvgText
              x={p.x}
              y={p.y - 8}
              fill="#FFFFFF"
              fontSize="8"
              fontWeight="bold"
              textAnchor="middle"
            >
              {p.value > 1000 ? `${(p.value / 1000).toFixed(1)}k` : Math.round(p.value)}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

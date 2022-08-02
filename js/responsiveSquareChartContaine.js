import { min, select } from 'd3';
import { states } from './main';

export function responsiveSquareChartContainer(parentElement) {
  const squareDim = min([states.chart2.width, states.chart2.height]);
  return select(parentElement)
    .append('div')
    .attr('style', `width: ${squareDim}px; height: ${squareDim}px`)
    .on('mousemove', (event, d) => {
      const windowWidth = min([window.innerWidth, window.innerHeight]);
      select(event.target).attr('style', `width: ${windowWidth}px; height: ${windowWidth}px`);
    })
    .on('mouseleave', (event, d) => {
      select(event.target).attr('style', `width: ${squareDim}px; height: ${squareDim}px`);
    });
}

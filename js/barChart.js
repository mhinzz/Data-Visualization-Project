import { max, scaleLinear, select, stack, axisBottom, axisLeft, scaleBand } from 'd3';
import { filteredStates, filters, states, updateCharts } from './main';
import {
  areaAggregationBreakpoints,
  areaBreakpointsLabelMap,
  areaColorScale,
  getFarmCountByUserCountGroup,
  getFarmPercentageByUserCountAreaBucket,
  getFarmPercentageByUserCountGroup,
  getFarmsByUserCountAreaBucket,
} from './utils';

const buttonTextMap = {
  '%': { group: getFarmPercentageByUserCountGroup, getMax: () => 100, format: (d) => d + '%' },
  count: {
    group: getFarmCountByUserCountGroup,
    getMax: (data) =>
      max(data, (d) => areaAggregationBreakpoints.reduce((sum, key) => sum + (d[key] || 0), 0)),
    format: (d) => d,
  },
};

export class Barchart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _state) {
    // Configuration object with defaults
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || states.chart1.width,
      containerHeight: _config.containerHeight || states.chart1.height,
      margin: _config.margin || { top: 32, right: 130, bottom: 40, left: 40 },
      reverseOrder: _config.reverseOrder || false,
      tooltipPadding: _config.tooltipPadding || 15,
    };
    this.state = _state;

    this.initVis();
  }

  /**
   * Initialize scales/axes and append static elements, such as axis titles
   */
  initVis() {
    let vis = this;

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Initialize scales and axes
    // Important: we flip array elements in the y output range to position the rectangles correctly
    vis.yScale = scaleLinear().range([vis.height, 0]);

    vis.xScale = scaleBand()
      .range([12, vis.width - 12])
      .paddingInner(0.2);

    // Define size of SVG drawing area
    vis.svg = select(vis.config.parentElement)
      .append('svg')
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight);

    // SVG Group containing the actual chart; D3 margin convention
    vis.chart = vis.svg
      .append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Append empty x-axis group and move it to the bottom of the chart
    vis.xAxisG = vis.chart
      .append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.height})`);

    // Append y-axis group
    vis.yAxisG = vis.chart.append('g').attr('class', 'axis y-axis');

    vis.chart
      .append('text')
      .attr('class', 'axis-title')
      .attr('y', vis.height + 8)
      .attr('x', vis.width + 40)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('members/farm');

    vis.svg
      .append('text')
      .attr('class', 'axis-title')
      .attr('x', 5)
      .attr('y', 0)
      .attr('dy', 20)
      .text('farms by');

    const barFilters = vis.svg
      .append('g')
      .attr('class', 'bar-filter')
      .attr('transform', `translate(${vis.width + 46}, 0)`);

    barFilters
      .append('text')
      .attr('class', 'axis-title')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', 20)
      .text('farm size');

    for (const index in areaAggregationBreakpoints) {
      const breakpoint = areaAggregationBreakpoints[index];
      const label = barFilters
        .append('g')
        .attr('id', `bar-area-label${index}`)
        .attr('class', `bar-label non-selectable clickable`)
        .attr('transform', `translate(0, ${28 + 20 * index})`)
        .attr('opacity', filters.barchart.area[breakpoint] ? 1 : 0.2)
        .on('click', () => {
          filters.barchart.area[breakpoint] = !filters.barchart.area[breakpoint];
          select(`#bar-area-label${index}`).attr(
            'opacity',
            filters.barchart.area[breakpoint] ? 1 : 0.2,
          );
          updateCharts();
        });

      label
        .append('rect')
        .attr('width', 16)
        .attr('height', 16)
        .attr('fill', areaColorScale(breakpoint));

      label.append('text').text(areaBreakpointsLabelMap[breakpoint]).attr('x', 24).attr('y', 12);
    }

    barFilters
      .append('text')
      .attr('class', 'axis-title')
      .attr('x', 0)
      .attr('y', 20 * areaAggregationBreakpoints.length + 20)
      .attr('dy', 20)
      .text('number of users/farm');

    const userCounts = Object.keys(filters.barchart.userCount).sort();
    for (const index in userCounts) {
      const number_of_users = userCounts[index];
      const label = barFilters
        .append('g')
        .attr('id', `bar-user-label${index}`)
        .attr('class', `bar-label non-selectable clickable`)
        .attr(
          'transform',
          `translate(0, ${48 + 20 * (+index + areaAggregationBreakpoints.length)})`,
        )
        .attr('opacity', filters.barchart.userCount[number_of_users] ? 1 : 0.2)
        .on('click', () => {
          filters.barchart.userCount[number_of_users] = !filters.barchart.userCount[
            number_of_users
          ];
          select(`#bar-user-label${index}`).attr(
            'opacity',
            filters.barchart.userCount[number_of_users] ? 1 : 0.2,
          );
          updateCharts();
        });

      label.append('rect').attr('width', 80).attr('height', 16).attr('fill', 'lightgray');

      label.append('text').text(number_of_users).attr('x', 32).attr('y', 12);
    }

    const button = vis.svg.append('g').attr('transform', `translate(60,20)`);

    vis.buttonContainer = button
      .append('rect')
      .attr('x', -4)
      .attr('y', -14)
      .attr('width', 60)
      .attr('height', 20)
      .attr('fill', 'lightgrey')
      .attr('class', 'clickable')
      .on('click', () => {
        vis.buttonText.text(vis.buttonText.text() === '%' ? 'count' : '%');
        vis.updateVis();
      });
    vis.buttonText = button.append('text').attr('class', 'axis-title non-clickable').text('%');
  }

  /**
   * Prepare data and scales before we render it
   */
  updateVis() {
    let vis = this;
    filteredStates.farmsByUserCountAreaBucket = getFarmsByUserCountAreaBucket(
      filteredStates.selectedFarms,
    );
    // FIXME: this is unnecessary when percentage is selected
    filteredStates.farmPercentageByUserCountAreaBucket = getFarmPercentageByUserCountAreaBucket(
      filteredStates.farmsByUserCountAreaBucket,
    );
    const buttonText = vis.buttonText.text();
    vis.data = buttonTextMap[buttonText].group(filteredStates.farmsByUserCountAreaBucket);
    vis.stackedData = stack().keys([...areaAggregationBreakpoints].reverse())(vis.data);

    vis.xScale.domain(Object.keys(filteredStates.farmsByUserCountAreaBucket).sort());
    vis.yScale.domain([0, buttonTextMap[buttonText].getMax(vis.data)]);
    vis.yAxis = axisLeft(vis.yScale)
      .tickSize(-vis.width)
      .tickPadding(10)
      .ticks(5)
      .tickSizeOuter(0)
      .tickFormat(buttonTextMap[buttonText].format);
    vis.xAxis = axisBottom(vis.xScale).tickSizeOuter(0);
    vis.renderVis();
  }

  /**
   * Bind data to visual elements
   */
  renderVis() {
    let vis = this;
    let bars = vis.chart
      .selectAll('.bar')
      .data(vis.stackedData)
      .join('g')
      .attr('class', 'bar')
      .attr('fill', (d) => areaColorScale(d.key))
      .selectAll('rect')
      .data((d) => d)
      .join('rect')
      .transition()
      .style('opacity', 1)
      .attr('class', (d) => `rect${d.gender === states.gender ? ' bar-selected' : ''}`)
      .attr('x', (d) => vis.xScale(d.data.number_of_users))
      .attr('width', vis.xScale.bandwidth())
      .attr('height', (d) => vis.yScale(d[0]) - vis.yScale(d[1]))
      .attr('y', (d) => vis.yScale(d[1]));

    vis.chart
      .selectAll('rect')
      .on('mousemove', (event, d) => {
        select('#tooltip')
          .style('display', 'block')
          .style('left', event.pageX + vis.config.tooltipPadding + 'px')
          .style('top', event.pageY - 2 * vis.config.tooltipPadding + 'px')
          .html(getFarmCountTooltipContent(d));
      })
      .on('mouseleave', () => {
        select('#tooltip').style('display', 'none');
      });

    vis.xAxisG.transition().call(vis.xAxis);

    vis.yAxisG.transition().call(vis.yAxis);
  }
}

function getFarmCountTooltipContent(d) {
  let sum = d[1];
  const bracket = Object.keys(d.data)
    .sort()
    .find((bracket) => {
      if (bracket === 'number_of_users') return false;
      sum -= +d.data[bracket];
      return Math.abs(sum) < 0.0001;
    });
  return `
              <div class="tooltip-title">farms</div>
              <ul>
                <li>number of farms: ${
                  filteredStates.farmsByUserCountAreaBucket[d.data.number_of_users][bracket].length
                }</li>
                <li>pecentage: ${
                  Math.round(
                    filteredStates.farmPercentageByUserCountAreaBucket[d.data.number_of_users][
                      bracket
                    ] * 100,
                  ) / 100
                }%</li>
                <li>number of users: ${d.data.number_of_users}</li>
                <li>farm size: ${areaBreakpointsLabelMap[bracket]}</li>
              </ul>
            `;
}

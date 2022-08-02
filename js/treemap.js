import { group, hierarchy, scaleOrdinal, select, treemap, treemapBinary } from 'd3';
import { filteredStates, filters, states, updateCharts } from './main';
import { getFarmTooltipContentTreeMap, getLocationAreaByFarmIdLocationType } from './utils';

export class Treemap {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _state) {
    // Configuration object with defaults
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 1000,
      containerHeight: _config.containerHeight || 500,
      margin: _config.margin || { top: 20, right: 20, bottom: 20, left: 0 },
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

    // Define size of SVG drawing area
    vis.svg = select(vis.config.parentElement)
      .append('svg')
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight);

    // SVG Group containing the actual chart; D3 margin convention
    vis.chart = vis.svg
      .append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // colour scale
    vis.colourScale = scaleOrdinal()
      .domain([
        'greenhouse',
        'field',
        'ceremonial_area',
        'garden',
        'farm_site_boundary',
        'residence',
        'natural_area',
        'barn',
        'surface_water',
      ])
      .range([
        '#2176AE',
        '#66A182',
        '#B66D0D',
        '#FBB13C',
        '#FE6847',
        '#EBA6A9',
        '#51344D',
        '#C14B0B',
        '#2176AE',
      ]);

    // add legend labels
    vis.svg
      .append('text')
      .attr('x', 28)
      .attr('y', 8)
      .text('field')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 90)
      .attr('y', 8)
      .text('greenhouse')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 200)
      .attr('y', 8)
      .text('garden')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 280)
      .attr('y', 8)
      .text('barn')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 340)
      .attr('y', 8)
      .text('boundary')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 435)
      .attr('y', 8)
      .text('ceremonial area')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 570)
      .attr('y', 8)
      .text('residence')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 660)
      .attr('y', 8)
      .text('natural area')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 770)
      .attr('y', 8)
      .text('surface water')
      .style('font-size', '15px')
      .attr('alignment-baseline', 'middle');

    vis.svg
      .append('text')
      .attr('x', 900)
      .attr('y', 8)
      .text('unit: \u33A1')
      .style('font-size', '10px')
      .attr('alignment-baseline', 'middle');

    vis.updateVis();
  }

  /**
   * Prepare data before render
   */
  updateVis() {
    let vis = this;

    vis.data = getLocationAreaByFarmIdLocationType(
      filteredStates.selectedFarms,
      states.locationsByFarmId,
    );
    const groups = group(Object.values(vis.data), (d) => d.type);

    vis.root = hierarchy(groups).sum((d) => d.area);
    vis.root.sort(function (a, b) {
      return b.height - a.height || b.value - a.value;
    });

    vis.renderVis();
  }

  /**
   * Bind data to visual elements
   */
  renderVis() {
    let vis = this;

    // create treemap structure
    treemap()
      .tile(treemapBinary)
      .size([vis.width, vis.height])
      .paddingInner(5)
      .paddingTop(5)
      .paddingRight(5)
      .paddingBottom(5)
      .paddingLeft(5)
      .round(true)(vis.root);

    // add rectangles
    vis.chart
      .selectAll('rect')
      .data(vis.root.leaves())
      .join('rect')
      .attr('x', (d) => d.x0)
      .attr('y', (d) => d.y0)
      .attr('class', (d) => d.data.type)
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .style('stroke', 'black')
      .style('fill', (d) => vis.colourScale(d.data.type));

    // add legend circles with filtering
    vis.svg
      .append('circle')
      .attr('cx', 18)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'field')
      .style('fill', '#66A182')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 80)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'greenhouse')
      .style('fill', '#2176AE')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 190)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'garden')
      .style('fill', '#FBB13C')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 270)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'barn')
      .style('fill', '#C14B0B')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 330)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'farm_site_boundary')
      .style('fill', '#FE6847')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 425)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'ceremonial_area')
      .style('fill', '#B66D0D')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 560)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'residence')
      .style('fill', '#EBA6A9')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 650)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'natural_area')
      .style('fill', '#51344D')
      .style('stroke', 'black')
      .style('stroke-width', 0);
    vis.svg
      .append('circle')
      .attr('cx', 760)
      .attr('cy', 8)
      .attr('r', 6)
      .attr('class', 'legend clickable')
      .attr('id', 'surface_water')
      .style('fill', '2176AE')
      .style('stroke', 'black')
      .style('stroke-width', 0);

    vis.svg.selectAll('.legend').on('click', (event, d) => {
      if (filters.treemap.types.has(event.path[0].id)) {
        filters.treemap.types.delete(event.path[0].id);
        select('#' + event.path[0].id).style('stroke-width', 0);
      } else {
        filters.treemap.types.add(event.path[0].id);
        select('#' + event.path[0].id).style('stroke-width', 4);
      }
      updateCharts();
    });

    // tool tips
    vis.chart
      .selectAll('rect')
      .on('mousemove', (event, d) => {
        select('#tooltip')
          .style('display', 'block')
          .style('left', event.pageX - 100 + 'px')
          .style('top', event.pageY + 'px')
          .html(getFarmTooltipContentTreeMap(filteredStates.farms, d));
      })
      .on('mouseleave', () => {
        select('#tooltip').style('display', 'none');
      })
      .on('click', (event, d) => {
        if (filters.geoMap.selectedFarmIdSet.size !== 1) {
          filters.geoMap.selectedFarmIdSet.clear();
          filters.geoMap.selectedFarmIdSet.add(d.data.farm_id);
          states.geoMap.selectFarm(d.data.farm_id);
          updateCharts();
        } else {
          filters.geoMap.selectedFarmIdSet.clear();
          states.geoMap.centerMap();
          updateCharts();
        }
      });

    // add area labels
    vis.chart
      .selectAll('text')
      .data(vis.root.leaves())
      .join('text')
      .attr('x', (d) => d.x0 + 5)
      .attr('y', (d) => d.y0 + 10)
      .text((d) => {
        if (d.x1 - d.x0 > 40 && d.y1 - d.y0 > 10) {
          return d.data.area;
        }
      })
      .attr('font-size', '10px')
      .attr('fill', 'white');
  }
}

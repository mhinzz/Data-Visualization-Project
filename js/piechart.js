import {
  arc,
  hierarchy,
  interpolate,
  interpolateRainbow,
  partition,
  quantize,
  scaleOrdinal,
  select,
} from 'd3';
import { getCropGroupData } from './utils';
import { filteredStates, filters, states, updateFilteredStates } from './main';

export class PieChart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: _config.containerWidth || 932,
      margin: _config.margin || { top: 20, right: 20, bottom: 20, left: 20 },
      tooltipPadding: _config.tooltipPadding || 15,
    };
    this.initVis();
  }

  initVis() {
    let vis = this;

    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;

    vis.radius = vis.width / 6;

    vis.arcGenerator = arc()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(vis.radius * 1.5)
      .innerRadius((d) => d.y0 * vis.radius)
      .outerRadius((d) => Math.max(d.y0 * vis.radius, d.y1 * vis.radius - 1));

    vis.svg = select(vis.config.parentElement)
      .append('svg')
      .attr('viewBox', [0, 0, vis.width, vis.width])
      .style('font', '11px sans-serif');

    vis.chart = vis.svg
      .append('g')
      .attr('transform', `translate(${vis.width / 2},${vis.width / 2})`);
    vis.pathG = vis.chart.append('g');

    vis.labelG = vis.chart.append('g').attr('pointer-events', 'none').attr('text-anchor', 'middle');
    vis.data = getCropGroupData(filteredStates.farms);
    vis.colorScale = scaleOrdinal(quantize(interpolateRainbow, vis.data.children.length + 1));

    vis.parent = vis.chart
      .append('circle')
      .datum(vis.root)
      .attr('r', vis.radius)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('click', (event, p) => {
        if (!p) return;
        vis.parent.datum(vis.root);
        vis.root.each(
          (d) =>
            (d.target = {
              x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
              x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
              y0: Math.max(0, d.y0 - p.depth),
              y1: Math.max(0, d.y1 - p.depth),
            }),
        );

        const t = vis.chart.transition().duration(500);

        vis.path
          .transition(t)
          .tween('data', (d) => {
            const i = interpolate(d.current, d.target);
            return (t) => (d.current = i(t));
          })
          .filter(function (d) {
            return +this.getAttribute('fill-opacity') || vis.arcVisible(d.target);
          })
          .attr('fill-opacity', (d) => (vis.arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0))
          .attrTween('d', (d) => () => vis.arcGenerator(d.current));

        vis.label
          .filter(function (d) {
            return +this.getAttribute('fill-opacity') || vis.labelVisible(d.target);
          })
          .transition(t)
          .attr('fill-opacity', (d) => +vis.labelVisible(d.target))
          .attrTween('transform', (d) => () => vis.labelTransform(d.current));
        if (p.depth === 0) {
          setTitleName();
          if (!filters.bubbleChart.certification && !filters.bubbleChart.certifier) {
            filters.pieChart.crop_group = undefined;
            filters.pieChart.crop_id = undefined;
            onFilter();
          }
        } else if (p.depth === 1) {
          setTitleName(p.data.name);
          if (!filters.bubbleChart.certification && !filters.bubbleChart.certifier) {
            filters.pieChart.crop_group = p.data.name;
            filters.pieChart.crop_id = undefined;
            onFilter();
          }
        }
      });
    vis.updateVis();
  }

  updateVis() {
    let vis = this;
    vis.data = getCropGroupData(filteredStates.selectedFarms);
    const root = hierarchy(vis.data)
      .sum((d) => d.value)
      .sort((a, b) => b.value - a.value);
    vis.root = partition().size([2 * Math.PI, root.height + 1])(root);
    vis.root.each((d) => (d.current = d));
    vis.renderVis();
  }

  renderVis() {
    let vis = this;
    setTitleName();

    vis.path = vis.pathG
      .selectAll('path')
      .data(vis.root.descendants().slice(1))
      .join('path')
      .attr('fill', (d) => {
        while (d.depth > 1) d = d.parent;
        return vis.colorScale(d.data.name);
      })
      .attr('fill-opacity', (d) => (vis.arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0))
      .attr('d', (d) => vis.arcGenerator(d.current))
      .on('mousemove', (event, d) => {
        select('#tooltip')
          .style('display', 'block')
          .style('left', event.pageX - 5 * vis.config.tooltipPadding + 'px')
          .style('top', event.pageY + vis.config.tooltipPadding + 'px')
          .html(getCropTooltipContent(d));
      })
      .on('mouseleave', () => {
        select('#tooltip').style('display', 'none');
      });

    vis.path
      .filter((d) => d.children)
      .style('cursor', 'pointer')
      .on('click', (event, p) => {
        if (p.depth === 3) return;
        vis.parent.datum(p.parent);

        vis.root.each(
          (d) =>
            (d.target = {
              x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
              x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
              y0: Math.max(0, d.y0 - p.depth),
              y1: Math.max(0, d.y1 - p.depth),
            }),
        );

        const t = vis.chart.transition().duration(500);

        vis.path
          .transition(t)
          .tween('data', (d) => {
            const i = interpolate(d.current, d.target);
            return (t) => (d.current = i(t));
          })
          .filter(function (d) {
            return +this.getAttribute('fill-opacity') || vis.arcVisible(d.target);
          })
          .attr('fill-opacity', (d) => (vis.arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0))
          .attrTween('d', (d) => () => vis.arcGenerator(d.current));

        vis.label
          .filter(function (d) {
            return +this.getAttribute('fill-opacity') || vis.labelVisible(d.target);
          })
          .transition(t)
          .attr('fill-opacity', (d) => +vis.labelVisible(d.target))
          .attrTween('transform', (d) => () => vis.labelTransform(d.current));
        if (p.depth === 1) {
          setTitleName(p.data.name);

          if (!filters.bubbleChart.certification && !filters.bubbleChart.certifier) {
            filters.pieChart.crop_group = p.data.name;
            filters.pieChart.crop_id = undefined;
            onFilter();
          }
        } else if (p.depth === 2) {
          setTitleName(p.data.name);

          if (!filters.bubbleChart.certification && !filters.bubbleChart.certifier) {
            filters.pieChart.crop_group = p.parent.data.name;
            filters.pieChart.crop_id = p.data.crop_id;
            onFilter();
          }
        }
      });

    const truncate = (str, max) =>
      str.length < max ? str : `${str.substr(0, str.substr(0, max).lastIndexOf(' '))}${'...'}`;
    vis.label = vis.labelG
      .selectAll('text')
      .data(vis.root.descendants().slice(1))
      .join('text')
      .attr('fill-opacity', (d) => +vis.labelVisible(d.current))
      .attr('transform', (d) => vis.labelTransform(d.current))
      .text((d) => truncate(d.data.name, 30));
  }

  arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  labelTransform(d) {
    let vis = this;
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * vis.radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
}

function onFilter() {
  updateFilteredStates();
  states.barChart.updateVis();
  states.geoMap.updateVis();
  states.treemap.updateVis();
  setTimeout(() => {
    states.bubbleChart.updateVis();
  }, 1000);
}

export function setTitleName(name = 'crop') {
  document.getElementById('crop-title').innerText = name;
}

function getCropTooltipContent(d) {
  if (d.depth === 1) {
    return `
              <div class="tooltip-title">crop group</div>
              <ul>
                <li>crop group: ${d.data.name}</li>
                <li>number of crops: ${d.children.length}</li>
                <li>number of varieties: ${d.value}</li>
              </ul>
            `;
  }
  if (d.depth === 2) {
    return `
              <div class="tooltip-title">crop</div>
              <ul>
                <li>crop group: ${d.parent.data.name}</li>
                <li>crop: ${d.data.name}</li>
                <li>number of varieties: ${d.value}</li>
              </ul>
            `;
  }
  return `
              <div class="tooltip-title">variety</div>
              <ul>
                <li>crop group: ${d.parent.parent.data.name}</li>
                <li>crop: ${d.parent.data.name}</li>
                <li>variety: ${d.data.name}</li>
              </ul>
            `;
}

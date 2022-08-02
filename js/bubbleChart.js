import { scaleOrdinal, schemeCategory10, select, pack, hierarchy, hsl, interpolateZoom } from 'd3';
import { filteredStates, filters, states, updateFilteredStates } from './main';
import { getCertifierGroups } from './utils';

const height = 927;
const width = 927;

export class BubbleChart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _state) {
    // Configuration object with defaults
    this.config = {
      parentElement: _config.parentElement,
      tooltipPadding: _config.tooltipPadding || 15,
    };
    this.initVis();
  }

  /**
   * Initialize scales/axes and append static elements, such as axis titles
   */
  initVis() {
    const vis = this;
    vis.colorScale = scaleOrdinal().range(schemeCategory10);

    vis.svg = select(vis.config.parentElement)
      .append('svg')
      .attr('viewBox', `-${width / 2} -${height / 2} ${width} ${height}`)
      .style('display', 'block')
      .style('margin', '0 -14px')
      .style('cursor', 'pointer');

    vis.chart = vis.svg.append('g');

    vis.label = vis.svg
      .append('g')
      .style('font-family', 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle');
  }

  /**
   * Prepare data and scales before we render it
   */
  updateVis() {
    const vis = this;
    const certificationGroup = getCertifierGroups(filteredStates.selectedFarms);

    vis.root = pack()
      .size([width - 300, height])
      .padding(7)(
      hierarchy(certificationGroup)
        .sum((d) => d.value)
        .sort((a, b) => b.value - a.value),
    );
    vis.focus = vis.root;
    vis.renderVis();
  }

  /**
   * Bind data to visual elements
   */
  renderVis() {
    const vis = this;
    setTitleName();

    vis.svg.on('click', () => zoom(vis.root));
    const node = vis.chart
      .selectAll('circle')
      .data(vis.root.descendants().slice(1))
      .join('circle')
      .attr('fill', setCircleColor)
      .attr('pointer-events', (d) => (!d.children ? 'none' : null))
      .attr('opacity', (d) => (d.height === 0 ? 0.3 : 1))
      .on('mousemove', function (event, d) {
        select(this).attr('stroke', '#000');
        select('#tooltip')
          .style('display', 'block')
          .style('left', event.pageX - 5 * vis.config.tooltipPadding + 'px')
          .style('top', event.pageY + vis.config.tooltipPadding + 'px')
          .html(getCertificationTooltipContent(d));
      })
      .on('mouseout', function () {
        select(this).attr('stroke', null);
        select('#tooltip').style('display', 'none');
      })
      .on('click', (event, d) => vis.focus !== d && (zoom(d), event.stopPropagation()));
    const label = vis.label
      .selectAll('text')
      .data(vis.root.descendants())
      .join('text')
      .style('fill-opacity', (d) => (d.parent === vis.root ? 1 : 0))
      .style('display', (d) => (d.parent === vis.root ? 'inline' : 'none'))
      .text((d) => d.data.name);

    if (!vis.root.r) {
      setTitleName('No Certifications Found');
      return;
    }
    zoomTo([vis.root.x, vis.root.y, vis.root.r * 2]);

    function setCircleColor(obj) {
      if (obj.height === 0) {
        return states.locationColorScale(obj.data.name);
      }
      let depth = obj.depth;
      while (obj.depth > 1) {
        obj = obj.parent;
      }
      let newcolor = hsl(vis.colorScale(obj.data.name));
      newcolor.l += depth == 1 ? 0 : depth * 0.1;
      return newcolor;
    }

    function zoomTo(v) {
      vis.view = v;
      const k = width / v[2];
      label.attr('transform', (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
      node.attr('transform', (d) => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
      node.attr('r', (d) => d.r * k);
    }

    function zoom(d) {
      vis.focus = d;

      const transition = vis.svg
        .transition()
        .duration(750)
        .tween('zoom', (d) => {
          const i = interpolateZoom(vis.view, [vis.focus.x, vis.focus.y, vis.focus.r * 2]);
          return (t) => zoomTo(i(t));
        });

      label
        .filter(function (d) {
          return d.parent === vis.focus || this.style.display === 'inline';
        })
        .transition(transition)
        .style('fill-opacity', (d) => (d.parent === vis.focus ? 1 : 0))
        .on('start', function (d) {
          if (d.parent === vis.focus) this.style.display = 'inline';
        })
        .on('end', function (d) {
          if (d.parent !== vis.focus) this.style.display = 'none';
        });

      setTitleName(d.data.name);
      if (!filters.pieChart.crop_group && !filters.pieChart.crop_id) {
        const prevCertification = filters.bubbleChart.certification;
        const prevCertifier = filters.bubbleChart.certifier;
        switch (d.depth) {
          case 0:
            filters.bubbleChart.certification = undefined;
            filters.bubbleChart.certifier = undefined;
            break;
          case 1:
            filters.bubbleChart.certification = d.data.name;
            filters.bubbleChart.certifier = undefined;
            break;
          case 2:
            filters.bubbleChart.certifier = d.data.name;
            filters.bubbleChart.certification = d.parent.data.name;
            break;
          case 3:
            filters.bubbleChart.certifier = d.parent.data.name;
            filters.bubbleChart.certification = d.parent.parent.data.name;
            break;
        }
        if (
          filters.bubbleChart.certifier !== prevCertifier ||
          filters.bubbleChart.certification !== prevCertification
        ) {
          updateFilteredStates();
          states.barChart.updateVis();
          states.geoMap.updateVis();
          states.treemap.updateVis();
          setTimeout(() => states.piechart.updateVis(), 1000);
        }
      }
    }
  }
}

function setTitleName(name = 'certification') {
  document.getElementById('certification-title').innerText = name;
}

function getCertificationTooltipContent(d) {
  if (d.depth === 1) {
    return `
              <div class="tooltip-title">certification</div>
              <ul>
                <li>certification: ${d.data.name}</li>
                <li>number of certifiers: ${d.children.length}</li>
                <li>number of farms: ${d.children.reduce(
                  (sum, certifier) => sum + certifier.children.length,
                  0,
                )}</li>
              </ul>
            `;
  }
  if (d.depth === 2) {
    return `
              <div class="tooltip-title">certifier</div>
              <ul>
                <li>certification: ${d.parent.data.name}</li>
                <li>certifier: ${d.data.name}</li>
                <li>number of farms: ${d.children.length}</li>
              </ul>
            `;
  }

  if (d.depth === 3) {
    return `
              <div class="tooltip-title">farm</div>
              <ul>
                <li>certification: ${d.parent.parent.data.name}</li>
                <li>certifier: ${d.parent.data.name}</li>
              </ul>
            `;
  }
  return `
              <div class="tooltip-title">location</div>
              <ul>
                <li>certification: ${d.parent.parent.parent.data.name}</li>
                <li>certifier: ${d.parent.parent.data.name}</li>
              </ul>
            `;
}

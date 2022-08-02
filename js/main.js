import '../css/style.css';
import { extent, json, scaleOrdinal, schemeSet1 } from 'd3';
import { GeoMap } from './geoMap';
import {
  areaAggregationBreakpoints,
  farmNumberByCountryIdCenter,
  farmNumberByCountryIdZoom,
  getfarmWithAreaByFarmId,
} from './utils';
import { PieChart } from './piechart';
import produce from 'immer';
import { Barchart } from './barChart';
import { BubbleChart } from './bubbleChart';
import { Treemap } from './treemap';

let URI;
const VITE_ENV = import.meta.env.VITE_ENV || 'development';
if (import.meta.env.VITE_API_URL?.length) {
  URI = import.meta.env.VITE_API_URL;
} else {
  if (VITE_ENV === 'development') {
    URI = window.location.href.replace(/3000.*/, '5000');
  } else if (VITE_ENV === 'production') {
    URI = 'https://api.app.litefarm.org';
  } else if (VITE_ENV === 'integration') {
    URI = 'https://api.beta.litefarm.org';
  }
}

export const states = {
  farms: {},
  countryNameIdMap: {},
  farmsByCountryName: {},
  crops: {},
  locations: {},
  cropVarietiesByFarmId: {},
  cropVarietiesByCropId: {},
  locationsByFarmId: {},
  farmIdSetByCropId: {},
  farmIdSetByCropGroup: {},
  locationTypes: [],
  locationColorScale: undefined,
  country_id: undefined,
  geoMap: undefined,
  barChart: undefined,
  chart1: {
    height: 0,
    width: 0,
  },
  chart2: {
    height: 0,
    width: 0,
  },
};

export const filters = {
  barchart: {
    area: areaAggregationBreakpoints.reduce((filter, breakpoint) => {
      filter[breakpoint] = true;
      return filter;
    }, {}),
    userCount: {},
  },
  geoMap: {
    selectedFarmIdSet: new Set(),
  },
  bubbleChart: {
    certification: undefined,
    certifier: undefined,
  },
  pieChart: {
    crop_group: undefined,
    crop_id: undefined,
  },
  treemap: {
    types: new Set(),
  },
};

export const filteredStates = {
  farms: {},
  farmIdSet: new Set(),
  farmWithAreaByFarmId: {},
  // barchart
  farmsByUserCountAreaBucket: {},
};

Promise.all([
  json('data/world_countries.json'),
  // original source
  // d3.csv(
  //   'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world_population.csv',
  // ),

  json(`data/farm.json`),
  json(`data/variety.json`),
  json(`data/crop.json`),
  json(`data/location.json`),
  // db endpoints:
  // d3.json(`${URI}/visualization/farm`),
  // d3.json(`${URI}/visualization/variety`),
  // d3.json(`${URI}/visualization/crop`),
  // d3.json(`${URI}/visualization/location`),
])
  .then((data) => {
    fillCache(data);
    fillChartDivWidth();
    //does not need filter when location chart is not implemented

    filteredStates.farmWithAreaByFarmId = produce({}, (_) =>
      getfarmWithAreaByFarmId(states.farms, states.locationsByFarmId),
    );
    updateFilteredStates();

    states.geoMap = new GeoMap(
      {
        parentElement: '#map',
      },
      data[0],
      {
        choropleth: {
          zoom: farmNumberByCountryIdZoom,
          center: farmNumberByCountryIdCenter,
        },
        farmWithAreaByFarmId: filteredStates.farmWithAreaByFarmId,
        // pieChart: getCountryCropGroupData()
      },
      { onCountryChange },
    );

    states.geoMap.updateVis();

    states.piechart = new PieChart({
      parentElement: '#chart3',
    });

    states.treemap = new Treemap({
      parentElement: '#chart4',
    });

    states.treemap.updateVis();

    states.barChart = new Barchart({
      parentElement: '#chart1',
    });
    states.barChart.updateVis();
    states.bubbleChart = new BubbleChart({
      parentElement: '#chart2',
    });
    states.bubbleChart.updateVis();
  })
  .catch((error) => console.error(error));

function fillCache(data) {
  for (const crop of data[3]) {
    states.crops = produce(states.crops, (crops) => {
      crops[crop.crop_id] = crop;
    });
  }
  for (const farm of data[1]) {
    states.farms = produce(states.farms, (farms) => {
      farms[farm.farm_id] = farm;
    });
    filters.barchart.userCount[farm.number_of_users] = true;
    states.farmsByCountryName = produce(states.farmsByCountryName, (farmsByCountryName) => {
      farmsByCountryName[farm.country_name] = farmsByCountryName[farm.country_name] || [];
      farmsByCountryName[farm.country_name].push(farm);
    });
  }

  const locationTypes = new Set();
  for (const location of data[4]) {
    states.locations = produce(states.locations, (locations) => {
      locations[location.location_id] = location;
    });
    states.locationsByFarmId = produce(states.locationsByFarmId, (locationsByFarmId) => {
      locationsByFarmId[location.farm_id] = locationsByFarmId[location.farm_id] || [];
      locationsByFarmId[location.farm_id].push(location);
    });
    locationTypes.add(location.type);
  }
  states.locationTypes = produce(states.locationTypes, (_) => Array.from(locationTypes));
  states.locationColorScale = scaleOrdinal().domain(states.locationTypes).range(schemeSet1);
  for (const country of data[0].features) {
    states.countryNameIdMap = produce(states.countryNameIdMap, (countryNameIdMap) => {
      countryNameIdMap[country.properties.name] = country.id;
    });
  }
  for (const cropVariety of data[2]) {
    states.cropVarietiesByFarmId = produce(
      states.cropVarietiesByFarmId,
      (cropVarietiesByFarmId) => {
        cropVarietiesByFarmId[cropVariety.farm_id] =
          cropVarietiesByFarmId[cropVariety.farm_id] || [];
        cropVarietiesByFarmId[cropVariety.farm_id].push(cropVariety);
      },
    );
    states.cropVarietiesByCropId = produce(
      states.cropVarietiesByCropId,
      (cropVarietiesByCropId) => {
        cropVarietiesByCropId[cropVariety.crop_id] =
          cropVarietiesByCropId[cropVariety.crop_id] || [];
        cropVarietiesByCropId[cropVariety.crop_id].push(cropVariety);
      },
    );
    const crop_group = states.crops[cropVariety.crop_id].crop_group;
    states.farmIdSetByCropGroup[crop_group] = states.farmIdSetByCropGroup[crop_group] || new Set();
    states.farmIdSetByCropGroup[crop_group].add(cropVariety.farm_id);
    states.farmIdSetByCropId[cropVariety.crop_id] =
      states.farmIdSetByCropId[cropVariety.crop_id] || new Set();
    states.farmIdSetByCropId[cropVariety.crop_id].add(cropVariety.farm_id);
  }
}

function onCountryChange(country_id) {
  states.country_id = country_id;
  states.geoMap.updateCountry(country_id);
}

function fillChartDivWidth() {
  const chartDiv1 = document.getElementById('chart1');
  states.chart1.width = chartDiv1.offsetWidth;
  states.chart1.height = chartDiv1.offsetHeight;
  const chartDiv2 = document.getElementById('chart2');
  states.chart2.width = chartDiv2.offsetWidth;
  states.chart2.height = chartDiv2.offsetHeight;
}

export function updateFilteredStates() {
  filteredStates.farms = produce([], () =>
    Object.values(filteredStates.farmWithAreaByFarmId).filter((farm) => {
      const areaBucket = areaAggregationBreakpoints.find((area) => area <= farm.total_area);
      return (
        filters.barchart.area[areaBucket] &&
        filters.barchart.userCount[farm.number_of_users] &&
        (!filters.bubbleChart.certification ||
          filters.bubbleChart.certification === farm.certification) &&
        (!filters.bubbleChart.certifier || filters.bubbleChart.certifier === farm.certifier) &&
        (!filters.pieChart.crop_id ||
          states.farmIdSetByCropId[filters.pieChart.crop_id].has(farm.farm_id)) &&
        (!filters.pieChart.crop_group ||
          states.farmIdSetByCropGroup[filters.pieChart.crop_group].has(farm.farm_id)) &&
        Array.from(filters.treemap.types).reduce(
          (hasSelectedLocationTypes, locationType) =>
            hasSelectedLocationTypes &&
            states.locationsByFarmId[farm.farm_id].find(({ type }) => type === locationType),
          true,
        )
      );
    }),
  );

  filteredStates.selectedFarms = produce(filteredStates.farms, (farms) => {
    let hasSelectedFarm = false;
    const selectedFarms = farms.filter(({ farm_id }) => {
      if (filters.geoMap.selectedFarmIdSet.has(farm_id)) {
        hasSelectedFarm = true;
        return true;
      } else {
        return false;
      }
    });
    return hasSelectedFarm ? selectedFarms : farms;
  });
  filteredStates.farmIdSet = new Set(filteredStates.farms.map((farm) => farm.farm_id));
}

export function updateCharts() {
  filters.bubbleChart.certifier = undefined;
  filters.bubbleChart.certification = undefined;
  filters.pieChart.crop_id = undefined;
  filters.pieChart.crop_group = undefined;
  updateFilteredStates();
  states.barChart.updateVis();
  states.geoMap.updateVis();
  states.treemap.updateVis();
  setTimeout(() => {
    states.bubbleChart.updateVis();
    states.piechart.updateVis();
  }, 500);
}

function logStates(data) {
  console.log(new Set(data[1].map((farm) => farm.certifier)).size);
  console.log(new Set(data[1].map((farm) => farm.certification)).size);
  console.log(new Set(data[1].map((farm) => farm.country_name)).size);
  console.log(extent(data[1].map((farm) => farm.number_of_users)));
  console.log(extent(data[1].map((farm) => farm.grid_points.lat)));
  console.log(extent(data[1].map((farm) => farm.grid_points.lng)));
  console.log(new Set(data[2].map((variety) => variety.crop_id)).size);
  console.log(new Set(data[2].map((variety) => variety.crop_variety_name)).size);

  console.log(new Set(data[2].map((variety) => states.crops[variety.crop_id])).size);
  console.log(new Set(data[2].map((variety) => variety.farm_id)).size);
  console.log(new Set(data[1].map((farm) => farm.farm_id)).size);

  console.log(extent(data[4].map((location) => location.total_area)));
}

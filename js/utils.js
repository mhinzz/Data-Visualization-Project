import produce from 'immer';
import { states } from './main';
import { scaleOrdinal, schemeYlGn } from 'd3';

export const getFarmsCountryIdMap = (farms, countryNameIdMap) => {
  return Object.values(farms).reduce((farmsByISO, farm) => {
    const country_id = countryNameIdMap[farm.country_name];
    if (country_id) {
      farmsByISO[country_id] = farmsByISO[country_id] ?? [];
      farmsByISO[country_id].push({ ...farm, country_id });
    }
    return farmsByISO;
  }, {});
};

export const getFarmNumberByCountryId = (farms, countryNameIdMap) => {
  return Object.entries(getFarmsCountryIdMap(farms, countryNameIdMap)).reduce(
    (farmNumberByCountryId, [country_id, farms]) => {
      farmNumberByCountryId[country_id] = farms.length;
      return farmNumberByCountryId;
    },
    {},
  );
};

export const getTotalAreaByCountryId = (farms, countryNameIdMap, locationsByFarmId) => {
  return Object.entries(getFarmsCountryIdMap(farms, countryNameIdMap)).reduce(
    (farmNumberByCountryId, [country_id, farms]) => {
      farmNumberByCountryId[country_id] = farms.reduce((total_area, { farm_id }) => {
        total_area += (locationsByFarmId[farm_id] || []).reduce((total_area, location) => {
          total_area += ['field', 'garden', 'greenhouse'].includes(location.type)
            ? location.total_area
            : 0;
          return total_area;
        }, 0);
        return total_area;
      }, 0);
      return farmNumberByCountryId;
    },
    {},
  );
};

export const getfarmWithAreaByFarmId = (farms, locationsByFarmId) => {
  return Object.entries(locationsByFarmId).reduce((farmWithAreaByFarmId, [farm_id, locations]) => {
    const total_area = locations.reduce((total_area, location) => {
      total_area += ['field', 'garden', 'greenhouse'].includes(location.type)
        ? location.total_area
        : 0;
      return total_area;
    }, 0);
    const farm = farms[farm_id];
    locationsByFarmId = produce(locationsByFarmId, (locationsByFarmId) => {
      locationsByFarmId[farm_id] = { ...farm, total_area };
    });
    return locationsByFarmId;
  }, {});
};

export const farmNumberByCountryIdDomain = [1, 5, 10, 50, 100];
export const farmNumberByCountryIdCenter = [0, 10.444547];
export const farmNumberByCountryIdZoom = 3;

export const getPopulationById = (countries) =>
  countries.reduce((populationById, country) => {
    country.pop = +country.pop || 0;
    populationById[country.code] = country.pop;
    return populationById;
  }, {});

//PieChart
export function getCropGroups(farms) {
  const cropsByCropGroup = {};
  for (const { farm_id } of farms) {
    const cropVarieties = states.cropVarietiesByFarmId[farm_id];
    if (cropVarieties) {
      for (const cropVariety of cropVarieties) {
        const crop = states.crops[cropVariety.crop_id];
        cropsByCropGroup[crop.crop_group] = cropsByCropGroup[crop.crop_group] || {};
        cropsByCropGroup[crop.crop_group][crop.crop_id] = cropsByCropGroup[crop.crop_group][
          crop.crop_id
        ] || {
          crop_id: crop.crop_id,
          name: crop.crop_common_name,
          children: [],
        };
        cropsByCropGroup[crop.crop_group][crop.crop_id].children.push({
          name: cropVariety.crop_variety_name,
          value: 1,
        });
      }
    }
  }
  return (
    Object.entries(cropsByCropGroup).map(([crop_group, crops]) => ({
      name: crop_group,
      children: Object.values(crops).map((crop) => crop),
    })) || []
  );
}

export function getCropGroupData(farms) {
  return { name: 'crop_group', children: getCropGroups(farms) };
}

// Treemap
export const getLocationAreaByFarmIdLocationType = (farms, locationsByFarmId) => {
  return farms.reduce((farmWithAreaByFarmId, farm) => {
    const locations = locationsByFarmId[farm.farm_id];
    return locations.reduce((farmWithAreaByFarmId, location) => {
      const key = farm.farm_id + location.type;
      if (farmWithAreaByFarmId[key]) {
        farmWithAreaByFarmId[key].area += location.total_area;
      } else {
        farmWithAreaByFarmId[key] = {
          area: location.total_area,
          type: location.type,
          farm_id: farm.farm_id,
          key,
        };
      }
      return farmWithAreaByFarmId;
    }, farmWithAreaByFarmId);
  }, {});
};

export function getFarmTooltipContentTreeMap(farms, location_farm) {
  const farm = farms.find((d) => d.farm_id === location_farm.data.farm_id);
  const certification = farm.certification
    ? `
                <li>certification: ${farm.certification}</li>
                <li>certifier: ${farm.certifier}</li>
    `
    : '';
  const locations = Array.from(
    new Set(states.locationsByFarmId[farm.farm_id].map((location) => location.type)),
  ).join(', ');
  const crops = Array.from(
    new Set(
      states.cropVarietiesByFarmId[farm.farm_id].map(
        ({ crop_id }) => states.crops[crop_id].crop_common_name,
      ),
    ),
  ).join(', ');
  return `
                <div class="tooltip-title">${location_farm.data.type}</div>
              <ul>
                <li>${location_farm.data.type} area: ${location_farm.data.area} \u33A1</li>
                <li>number of users: ${farm.number_of_users}</li>
                <li>farm area: ${farm.total_area} \u33A1</li>
                ${certification}
                <li>locations: ${locations}</li>
                <li>crops: ${crops}</li>
              </ul>
  `;
}

//Percent stacked bar chart
export const areaAggregationBreakpoints = produce([], (_) => [0, 10000, 100000].reverse());
export const areaBreakpointsLabelMap = areaAggregationBreakpoints.reduce(
  (areaBreakpointsLabelMap, area, index) => {
    areaBreakpointsLabelMap[area] =
      index === 0
        ? `>${areaAggregationBreakpoints[index]} \u33A1`
        : `${areaAggregationBreakpoints[index]}-${areaAggregationBreakpoints[index - 1]} \u33A1`;
    return areaBreakpointsLabelMap;
  },
  {},
);
export const areaColorScale = scaleOrdinal()
  .domain(
    produce(areaAggregationBreakpoints, (areaAggregationBreakpoints) =>
      areaAggregationBreakpoints.reverse(),
    ),
  )
  .range(schemeYlGn[areaAggregationBreakpoints.length]);

export function getFarmsByUserCount(farmsWithArea) {
  return farmsWithArea.reduce((farmsByUserCount, farm) => {
    farmsByUserCount[farm.number_of_users] = farmsByUserCount[farm.number_of_users] || [];
    farmsByUserCount[farm.number_of_users].push(farm);
    return farmsByUserCount;
  }, {});
}

export function getFarmAreaBucket(farm) {
  return areaAggregationBreakpoints.find((area) => area <= farm.total_area);
}

export function getFarmsByAreaBucket(farmsWithArea) {
  return farmsWithArea.reduce((farmsByArea, farm) => {
    const areaBucket = areaAggregationBreakpoints.find((area) => area <= farm.total_area);
    farmsByArea[areaBucket] = farmsByArea[areaBucket] || [];
    farmsByArea[areaBucket].push(farm);
    return farmsByArea;
  }, {});
}

export function getFarmsByUserCountAreaBucket(farmsWithArea) {
  const farmsByUserCount = getFarmsByUserCount(farmsWithArea);
  return produce(farmsByUserCount, (farmsByUserCountAreaBucket) => {
    for (const number_of_users in farmsByUserCountAreaBucket) {
      farmsByUserCountAreaBucket[number_of_users] = getFarmsByAreaBucket(
        farmsByUserCountAreaBucket[number_of_users],
      );
    }
  });
}

export function getFarmPercentageByUserCountAreaBucket(farmsByUserCountAreaBucket) {
  return Object.entries(farmsByUserCountAreaBucket).reduce(
    (farmPercentageByUserCountAreaBucket, [number_of_users, farmsByAreaBucket]) => {
      const sum = Object.values(farmsByUserCountAreaBucket[number_of_users]).reduce(
        (sum, farms) => sum + farms.length,
        0,
      );
      farmPercentageByUserCountAreaBucket[number_of_users] = areaAggregationBreakpoints.reduce(
        (group, areaBucket) => {
          group[areaBucket] =
            ((farmsByUserCountAreaBucket[number_of_users]?.[areaBucket]?.length || 0) / sum) * 100;
          return group;
        },
        {},
      );
      return farmPercentageByUserCountAreaBucket;
    },
    {},
  );
}

export function getFarmCountByUserCountGroup(farmsByUserCountAreaBucket) {
  return Object.entries(farmsByUserCountAreaBucket).map(([number_of_users, farmsByAreaBucket]) => {
    const group = { number_of_users: number_of_users };
    for (const areaBucket of areaAggregationBreakpoints) {
      group[areaBucket] = farmsByUserCountAreaBucket[number_of_users]?.[areaBucket]?.length || 0;
    }
    return group;
  }, {});
}

export function getFarmPercentageByUserCountGroup(farmsByUserCountAreaBucket) {
  return Object.entries(farmsByUserCountAreaBucket).map(([number_of_users, farmsByAreaBucket]) => {
    const group = { number_of_users: number_of_users };
    const sum = Object.values(farmsByUserCountAreaBucket[number_of_users]).reduce(
      (sum, farms) => sum + farms.length,
      0,
    );
    for (const areaBucket of areaAggregationBreakpoints) {
      group[areaBucket] =
        ((farmsByUserCountAreaBucket[number_of_users]?.[areaBucket]?.length || 0) / sum) * 100;
    }
    return group;
  }, {});
}

//Bubble chart
export function getFarmsByCertificationCertifier(farms) {
  return farms.reduce((farmsByCertificationCertifier, farm) => {
    if (farm.certification && farm.certifier) {
      const { certification, certifier } = farm;
      farmsByCertificationCertifier[certification] =
        farmsByCertificationCertifier[certification] || {};
      farmsByCertificationCertifier[certification][certifier] =
        farmsByCertificationCertifier[certification][certifier] || [];
      farmsByCertificationCertifier[certification][certifier].push(farm);
    }
    return farmsByCertificationCertifier;
  }, {});
}

export function getCertifierGroups(farms) {
  const farmsByCertification = getFarmsByCertificationCertifier(farms);
  return {
    name: 'certification',
    children: Object.entries(farmsByCertification).map(([certification, certifierGroups]) => {
      return {
        name: certification,
        children: Object.entries(certifierGroups).map(([certifier, farms]) => {
          return {
            name: certifier,
            children: farms.map((farm) => ({
              name: 'farm',
              farm_id: farm.farm_id,
              children: states.locationsByFarmId[farm.farm_id].map((location) => ({
                name: location.type,
                value: 1,
              })),
            })),
          };
        }),
      };
    }),
  };
}

//geoMap:
export function getFarmTooltipContent(farmWithArea) {
  const certification = farmWithArea.certification
    ? `
                <li>certification: ${farmWithArea.certification}</li>
                <li>certifier: ${farmWithArea.certifier}</li>
    `
    : '';
  const locations = Array.from(
    new Set(states.locationsByFarmId[farmWithArea.farm_id].map((location) => location.type)),
  ).join(', ');
  const crops = Array.from(
    new Set(
      states.cropVarietiesByFarmId[farmWithArea.farm_id].map(
        ({ crop_id }) => states.crops[crop_id].crop_common_name,
      ),
    ),
  ).join(', ');
  return `
                <div class="tooltip-title">farm</div>
              <ul>
                <li>number of users: ${farmWithArea.number_of_users}</li>
                <li>area: ${farmWithArea.total_area} \u33A1</li>
                ${certification}
                <li>locations: ${locations}</li>
                <li>crops: ${crops}</li>
              </ul>
  `;
}

const comparedData = require('./cfRowDataCompared.json');
const fs = require('fs');

const attributeOrder = ['education', 'hours_per_week', 'age', 'occupation', 'workclass', 'marital_status', 'gender', 'race'];

const buildTree = (data, attributes, level = 0) => {
  if (level >= attributes.length) {
    return null;
  }

  const attribute = attributes[level];
  const grouped = {};

  data.forEach((row, index) => {
    if (row[attribute] !== 0) {
      if (!grouped[attribute]) {
        grouped[attribute] = {
          count: 0,
          indices: [],
          data: []
        };
      }
      grouped[attribute].count++;
      grouped[attribute].indices.push(index);
      grouped[attribute].data.push(row);
    }
  });

  const children = Object.keys(grouped).map(() => {
    const childNodes = buildTree(data, attributes, level + 1); 
    return {
      attribute: attribute,
      count: grouped[attribute].count,
      indices: grouped[attribute].indices,
      children: childNodes ? childNodes.children : []
    };
  });

  return {
    attribute: attribute,
    count: data.length,
    children: children
  };
};

const treeData = {
  attribute: "Root", 
  count: comparedData.length,
  children: buildTree(comparedData, attributeOrder).children
};

fs.writeFileSync('treeData.json', JSON.stringify(treeData, null, 2));

console.log('Tree data has been saved as treeData.json');

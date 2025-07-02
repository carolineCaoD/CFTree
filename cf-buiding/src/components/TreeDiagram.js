import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { datasets } from '../cfRowData'; 
import "./TreeDiagram.css"

const TreeDiagram = ({ 
  treeData, 
  selectedAttributes, 
  selectedDatasetKey = 'income',
  selectedDataIndices,
  cfRowData,
  thresholds, 
  currentThreshold, 
  onThresholdChange,
  currentDescriptionThreshold,
  setTreeDataState,
  originalTreeData,
  getClusterColor,
  clusterLegend, 
  selectedClusterId, 
  isCompactLayout 
}) => { 
  const originalDataset = datasets[selectedDatasetKey]?.originalDataset;
  selectedDataIndices = selectedDataIndices?.length > 0 ? selectedDataIndices : [0]; 
  const svgRef = useRef();
  
  

  useEffect(() => {
    d3.select(svgRef.current).selectAll("*").remove();
    if (!treeData || !selectedAttributes || selectedAttributes.length === 0) {
      console.log('No treeData or selected attributes. Nothing to display.');
      return;
    }
    else{
        console.log("selectedAttributes",selectedAttributes)
        console.log("treeData",treeData)
    }

    const tickPositionsMap = {}; 
    const yScalesMap = {}; 
    const attributeIndexMap = {};
    selectedAttributes.forEach((attr, index) => {
      attributeIndexMap[attr] = index;
    });

    const compactScale = isCompactLayout ? 0.8 : 1;
    const margin = {
        top: 20 * compactScale,
        right: 120 * compactScale,
        bottom: 200 * compactScale,
        left: 120 * compactScale
    };
    const width = (isCompactLayout ? 1700 : 1900) - margin.left - margin.right; 
    const height = (isCompactLayout ? 650 : 800) - margin.top - margin.bottom; 

    d3.select(svgRef.current).selectAll("*").remove();

    const headerCells = d3.selectAll('.filter-header-cell');
    if (headerCells.empty()) {
      console.error('No header cells found. Ensure headers are rendered before TreeDiagram runs.');
      return;
    }

    function getAxisTickPositions(y, values,yOffset) {
      const tickPositions = {};
      values.forEach(value => {
        tickPositions[value] = y(value)+yOffset;
      });
      return tickPositions;
    }

    const getNullChildIndices = (node) => {
      let nullChildIndices = [];
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          if (child.data.attribute === 'null') {
            nullChildIndices = nullChildIndices.concat(child.data.indices);  
          }
        });
      }
      return nullChildIndices;  
    };

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const headerPositions = {};
    headerCells.each(function(_, i) {
      const headerCell = d3.select(this);
      const attribute = headerCell.text().trim();
      console.log("selectedAttributes before assigning position",selectedAttributes)
      if (selectedAttributes.includes(attribute)) {
        const xPosition = this.getBoundingClientRect().left + (this.getBoundingClientRect().width / 2);
        headerPositions[attribute] = xPosition;
        const label = headerCell.select("label");
        if (label.empty()) return; 

        const existingCheckbox = label.select("input[type='checkbox']"); 

        label.html(""); 
        label.node().appendChild(existingCheckbox.node()); 

        label.append("span")
            .attr("class", `attribute-text ${isCompactLayout ? 'compact-label' : ''}`) 
            .text(attribute)
            .style("display", "inline-block")
            .style("margin-right", "6px");

        let barContainer = label.append("span")
            .attr("class", "attribute-bar-container")
            .style("display", "inline-flex")
            .style("align-items", "center")
            .style("margin-left", "6px") 
            .style("height", `${12 * compactScale}px`); 

        const clustersWithAttribute = clusterLegend.filter(cluster => 
            cluster.common_attributes.includes(attribute)
        );

        barContainer.selectAll("span")
            .data(clustersWithAttribute)
            .enter()
            .append("span")
            .attr("class", `attribute-bar ${isCompactLayout ? 'compact-bar' : ''}`) 
            .style("display", "inline-block")
            .style("width", `${8 * compactScale}px`) 
            .style("height", `${12 * compactScale}px`) 
            .style("background-color", d => getClusterColor(d.cluster_id))
            .style("margin-right", "2px")
            .style("border", "1px solid #333");
      }
    });

    const svgLeft = svgRef.current.getBoundingClientRect().left;
    Object.keys(headerPositions).forEach(attr => {
      headerPositions[attr] -= svgLeft;
    });

    const filterNodes = (node) => {
        if (!node || !node.attribute) return null;
  
        const isRoot = node.attribute === "Root";
        if (isRoot && node.children) {
          const filteredChildren = node.children
            .map(filterNodes)
            .filter(n => n !== null);
          return { ...node, children: filteredChildren };
        }
  
        if (node.attribute === 'null' ||selectedAttributes.includes(node.attribute)) {
          if (node.children) {
            const filteredChildren = node.children
              .map(filterNodes)
              .filter(n => n !== null);
            return { ...node, children: filteredChildren };
          }
          return node;
        }
        return null;
      };

    const filteredRoot = filterNodes(treeData);
    
    if (!filteredRoot || !filteredRoot.children || filteredRoot.children.length === 0) {
        console.log('No valid children to visualize after filtering.');
        return;
    }

    const root = d3.hierarchy(filteredRoot);

    const treeLayout = d3.tree().size([height, width]);
    treeLayout(root);
    const links = root.links()
    const filteredLinks=links.filter(d=>d.source.depth > 0 &&  d.source.data.attribute !== 'null' && d.target.data.attribute !== 'null');


    const drawParallelCoordinates = (originalDataset, filteredData, parallelGroup, attribute,node) => {

      if (selectedClusterId !== null) {
        filteredData = filteredData.filter(d => d.cluster === selectedClusterId || d.cluster_id === selectedClusterId);
        console.log("filteredData (cluster filtered)", filteredData);
      }

         console.log("originalData",originalDataset)
          parallelGroup.selectAll("*").remove();

        const nullChildIndices = getNullChildIndices(node);
        console.log("nullChildIndices",nullChildIndices);

        const pcMargin = { top: 10 * compactScale, right: -10 * compactScale, bottom: 10 * compactScale, left: 10 * compactScale };
        const pcWidth = boxWidth - pcMargin.left - pcMargin.right;
        const pcHeight = (isCompactLayout ? 100 : 150) - pcMargin.top - pcMargin.bottom; 

        const isCategorical = (attribute) => {
            const firstValue = originalDataset.find(d => d && d[attribute] !== null)?.[attribute];
            console.log(`Checking if ${attribute} is categorical:`, {
                firstValue,
                type: typeof firstValue
            });
            return typeof firstValue === 'string';
        };

        const x = d3.scalePoint()
            .range([0, pcWidth])
            .domain(['Original', 'New Value']);  

        let y;
        if (isCategorical(attribute)) {
            const categories = Array.from(
              new Set(
                originalDataset
                  .filter((d) => d && typeof d === "object" && d.hasOwnProperty(attribute) && d[attribute] !== undefined && d[attribute] !== null&&d[attribute] !== 0 )
                  .map((d) => d[attribute])
                  .concat(
                    filteredData
                      .filter((d) => d && typeof d === "object" && d.hasOwnProperty(attribute) && d[attribute] !== undefined && d[attribute] !== null&&d[attribute] !== 0 )
                      .map((d) => d[attribute])
                  )
              )
            );
            console.log("Filtered Data:", filteredData);
            console.log("Attribute:", attribute);
            console.log(
              "Filtered Original Data:",
              originalDataset.filter((d) => d && typeof d === "object")
            );
            console.log(
              "Filtered Filtered Data:",
              filteredData.filter((d) => d && typeof d === "object")
            );
            y = d3.scalePoint()
                .range([pcHeight, 0]) 
                .domain(categories);  
        } else {
            const allValues = originalDataset.map((d) => d[attribute]).concat(filteredData.map((d) => +d[attribute]));
            const extent = d3.extent(allValues);
            y = d3.scaleLinear()
                .range([pcHeight, 0]) 
                .domain(extent);  
            console.log("Initial extent for y domain:", extent);

            y.domain([
              Math.min(...allValues, y.domain ? y.domain()[0] : Infinity),
              Math.max(...allValues, y.domain ? y.domain()[1] : -Infinity),
            ]);

            console.log("Adjusted y domain:", y.domain(), "y range:", y.range());
        }
        yScalesMap[attribute] = y;

        const svg = parallelGroup.append('g')
        const originalIndices = node.data.original_indices || [];

      const nullCountMap = {};

      nullChildIndices.forEach(nullIndex => {
        const dataPoint = cfRowData[nullIndex];
        
        if (dataPoint && attribute in dataPoint) {
          const value = dataPoint[attribute];
          const valueKey = String(value);
          nullCountMap[valueKey] = (nullCountMap[valueKey] || 0) + 1;
        }
      });


      console.log("Final nullCountMap:", nullCountMap);

      const isAttributeCategorical = isCategorical(attribute);
      console.log(`Axis type for ${attribute}:`, {
          isCategorical: isAttributeCategorical,
          firstValue: originalDataset[0][attribute],
          valueType: typeof originalDataset[0][attribute]
      });

      svg.append('g')
      .attr('transform', `translate(${x('Original')}, 0)`)  
      .call(isAttributeCategorical ? 
          d3.axisLeft(y) : 
          d3.axisLeft(y)
              .ticks(isCompactLayout ? 3 : 5) 
      )
      .selectAll("text") 
      .attr("class", isCompactLayout ? 'compact-axis-label' : ''); 

      svg.append('g')
        .attr('transform', `translate(${x('New Value') }, 0)`) 
        .call(isAttributeCategorical ? 
            d3.axisRight(y) : 
            d3.axisRight(y)
                .ticks(isCompactLayout ? 3 : 5) 
        )
        .selectAll("text") 
        .attr("class", isCompactLayout ? 'compact-axis-label' : ''); 
        console.log("filteredData",filteredData)
        filteredData.forEach((innerArray,outerindex) => {
            const originalIndex = originalIndices[outerindex];
            const originalDatum=originalDataset[originalIndex];
            
            if (!originalDatum) {
              console.warn(`originalDatum not found for Original_Index ${originalIndex}`);
              return;
            }
              const value = innerArray[attribute];
              const originalValue = originalDatum[attribute];
              console.log("nullCountMap",nullCountMap);
              const nullChildCount = nullCountMap[value] || 0;
              console.log("nullChildCount",nullChildCount);
          

          const isCategorical = typeof originalValue === 'string' || typeof value === 'string';
          if (!isCategorical && (originalValue === undefined || value === undefined || isNaN(originalValue) || isNaN(value))) {
            console.warn(`Skipping invalid values for attribute '${attribute}':`, { originalValue, value });
            return;
          }

          const validData = [originalValue, value].filter(value => value !== undefined && value !== null);
          if (validData.length === 2) {
            console.log("Original Value:", originalValue, "New Value:", value);
            
            let strokeColor = 'steelblue'; 
            let opacity = 0.5;
            
            const clusterValue = innerArray.cluster !== undefined ? 
                                innerArray.cluster : 
                                (innerArray.cluster_id !== undefined ? innerArray.cluster_id : undefined);
            
            if (clusterValue !== undefined) {
              if (selectedClusterId !== null) {
                if (clusterValue === selectedClusterId) {
                  strokeColor = getClusterColor(clusterValue);
                  opacity = 0.8; 
                } else {
                  opacity = 0.1; 
                }
              } else {
                strokeColor = getClusterColor(clusterValue);
                opacity = 0.6; 
              }
              console.log(`Using cluster ${clusterValue} color:`, strokeColor, "opacity:", opacity);
            }
            
            svg.append('path')
              .datum(validData)
              .attr('fill', 'none')
              .attr('stroke', strokeColor)
              .attr('opacity', opacity)
              .attr('stroke-width', 1.5)
              .attr('d', d3.line()
                .x((d, i) => x(i === 0 ? 'Original' : 'New Value'))
                .y(d => y(d))
              );
          }
          if (nullChildCount > 0) {
              const newValueY = y(value);
              const octagonPath = () => {
                const radius = (isCompactLayout ? 7 : 10);  
                const angle = (Math.PI * 2) / 8;  
                const path = d3.path();
                for (let i = 0; i < 8; i++) {
                  const x = radius * Math.cos(angle * i);
                  const y = radius * Math.sin(angle * i);
                  if (i === 0) {
                    path.moveTo(x, y);
                  } else {
                    path.lineTo(x, y);
                  }
                }
                path.closePath();
                return path.toString();
              };
            svg.append('path')
                .attr('d', octagonPath())
                .attr('transform', `translate(${x('New Value')},${newValueY})rotate(22.5)`)
                .attr('fill', 'orange')  
                .attr('stroke', 'black')
                .attr('stroke-width', 1.5);
            
            svg.append('text')
              .attr('x', x('New Value'))
              .attr('y', newValueY)  
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')  
              .attr('fill', 'white')
              .attr('font-size', isCompactLayout ? '8px' : '10px') 
              .text(nullChildCount);  
          }
      });

};


const getInterpolatedPosition = (value, tickPositions) => {
  const numValue = Number(value);
  if (isNaN(numValue)) {
    console.warn(`Invalid value for interpolation: ${value}`);
    return undefined;
  }
  
  if (tickPositions[numValue] !== undefined) {
    return tickPositions[numValue];
  }
  
  const tickValues = Object.keys(tickPositions)
    .map(Number)
    .filter(val => !isNaN(val))
    .sort((a, b) => a - b);
  
  if (tickValues.length === 0) {
    console.warn('No valid tick values found for interpolation');
    return undefined;
  }
  
  if (numValue < tickValues[0]) {
    return tickPositions[tickValues[0]];
  }
  
  if (numValue > tickValues[tickValues.length - 1]) {
    return tickPositions[tickValues[tickValues.length - 1]];
  }
  
  let lowerTick = tickValues[0];
  let upperTick = tickValues[tickValues.length - 1];
  
  for (let i = 0; i < tickValues.length - 1; i++) {
    if (numValue >= tickValues[i] && numValue <= tickValues[i + 1]) {
      lowerTick = tickValues[i];
      upperTick = tickValues[i + 1];
      break;
  }
  }
  
  const lowerY = tickPositions[lowerTick];
  const upperY = tickPositions[upperTick];
  
  if (typeof lowerY !== 'number' || typeof upperY !== 'number' || 
      isNaN(lowerY) || isNaN(upperY) || upperTick === lowerTick) {
    console.warn(`Cannot interpolate with invalid values: lower=${lowerTick}(${lowerY}), upper=${upperTick}(${upperY})`);
    return !isNaN(lowerY) ? lowerY : (!isNaN(upperY) ? upperY : undefined);
  }
  
  const percentage = (numValue - lowerTick) / (upperTick - lowerTick);
  
  const interpolatedY = lowerY + percentage * (upperY - lowerY);
  
  console.log(`Interpolated position for ${numValue}: ${interpolatedY} (${percentage * 100}% between ${lowerTick} and ${upperTick})`);
  
  return interpolatedY;
};

const lookupCategoricalPosition = (value, tickPositions) => {
  if (value in tickPositions) {
    return tickPositions[value];
  }
  
  const lowerValue = String(value).toLowerCase();
  const keys = Object.keys(tickPositions);
  const lowerCaseKey = keys.find(k => String(k).toLowerCase() === lowerValue);
  if (lowerCaseKey) {
    return tickPositions[lowerCaseKey];
  }
  
  const trimmedValue = String(value).trim();
  const trimmedKey = keys.find(k => String(k).trim() === trimmedValue);
  if (trimmedKey) {
    return tickPositions[trimmedKey];
  }
  
  console.warn(`No match for "${value}" in tick positions. Available keys:`, keys);
  
  const positions = Object.values(tickPositions);
  return positions.length > 0 ? positions[0] : undefined;
};

function drawParallelLines(expandedNodes) {
  const expandedArray = Array.from(expandedNodes);
  if (expandedArray.length < 2) {
    svg.selectAll(".parallel-line").remove();
    return;
  }

  svg.selectAll(".parallel-line").remove();

  expandedArray.sort((a, b) => selectedAttributes.indexOf(a.data.attribute) - selectedAttributes.indexOf(b.data.attribute));

  expandedArray.forEach((sourceNode, i) => {
    const targetNode = expandedArray[i + 1];
    if (!targetNode) return;

    const sourceXRight = headerPositions[sourceNode.data.attribute] ?? 0;

    if (sourceNode.children) {
      sourceNode.children.forEach(childNode => {
        if (!expandedNodes.has(childNode)) return;

        const targetNode = childNode;
        const targetXLeft = headerPositions[targetNode.data.attribute] ?? 0;

        if (targetNode.parent.id !== sourceNode.id) return;  

        const sourceTickPositions = tickPositionsMap[`${sourceNode.data.attribute}-${sourceNode.id}`];
        const targetTickPositions = tickPositionsMap[`${targetNode.data.attribute}-${targetNode.id}`];
        console.log("sourceNode.data.indices",sourceNode.data.indices);
        
        const nullChildIndices = getNullChildIndices(sourceNode);
        console.log("nullChildIndices",nullChildIndices);
        
        sourceNode.data.indices.forEach((sourceIndex, j) => {
          if (nullChildIndices.includes(sourceIndex)) return;
          
          const sourceYValue = cfRowData[sourceIndex]?.[sourceNode.data.attribute];
          console.log("sourceYValue", sourceYValue);
          
          const targetIndexPos = targetNode.data.indices.indexOf(sourceIndex);
          
          let targetIndex;
          if (targetIndexPos !== -1) {
            targetIndex = sourceIndex; 
          } else if (j < targetNode.data.indices.length) {
            targetIndex = targetNode.data.indices[j]; 
          } else {
            console.log(`No matching index found for source index ${sourceIndex} in target node`);
            return; 
          }
          
          const originalIndex = sourceNode.data.original_indices[j];
          
          const targetYValue = originalDataset[originalIndex]?.[targetNode.data.attribute];
          
          let sourceY, targetY;

          if (typeof sourceYValue === 'string') {
            sourceY = lookupCategoricalPosition(sourceYValue, sourceTickPositions);
          } else {
            sourceY = sourceYValue in sourceTickPositions 
              ? sourceTickPositions[sourceYValue] 
              : getInterpolatedPosition(sourceYValue, sourceTickPositions);
          }
          
          if (typeof targetYValue === 'string') {
            targetY = lookupCategoricalPosition(targetYValue, targetTickPositions);
          } else {
            console.log("targetTickPositions",targetTickPositions);
            console.log(`Target scale info for value ${targetYValue}:`, {
              scaleInfo: yScalesMap[targetNode.data.attribute] ? {
                domain: yScalesMap[targetNode.data.attribute].domain(),
                range: yScalesMap[targetNode.data.attribute].range()
              } : 'Scale not found',
              directLookup: targetYValue in targetTickPositions,
              interpolatedValue: getInterpolatedPosition(targetYValue, targetTickPositions)
            });
            
            targetY = targetYValue in targetTickPositions 
              ? targetTickPositions[targetYValue] 
              : getInterpolatedPosition(targetYValue, targetTickPositions);
          }
          
          console.log("Debug available positions:", {
            sourceValue: sourceYValue,
            tickKeys: Object.keys(sourceTickPositions)
          });

          if (sourceY === undefined ) {
            console.warn(`Could not determine positions for values: ${sourceYValue}`);
            return; 
          }
          if (targetY === undefined) {
            console.warn(`Could not determine positions for values: ${targetYValue}`);
            return; 
          }
    
          const sourceNewValueX = sourceXRight - boxWidth / (isCompactLayout ? 6 : 6);  
          const targetOriginalX = targetXLeft - boxWidth / (isCompactLayout ? 0.9 : 0.86); 
    

          svg.append("path")
            .attr("class", "parallel-line")
            .attr("d", `M${sourceNewValueX},${sourceY} L${targetOriginalX},${targetY}`)
            .attr("stroke", "#4682B4") 
            .attr("stroke-width", isCompactLayout ? 2 : 3) 
            .attr("stroke-opacity", 0.2) 
            .attr("fill", "none");
        });
        
      });

    }


  });
}


function adjustNodeAndLinkPositions(expandedNodes, isExpanding,yOffset) {
  let newY;
  let sourceY;
  let targetY;
  
  nodes.each(function(d) {
    
      if (!d.originalY) {
            d.originalY = d.x;  
          }
      let totalYOffset = 0;
      const processedYPositions = new Set();
      expandedNodes.forEach(expandedNode => {
        const expandedNodeY = expandedNode.originalY || expandedNode.x;
        if (d.x > expandedNodeY && !processedYPositions.has(expandedNodeY)) {  
          totalYOffset += yOffset;
          processedYPositions.add(expandedNodeY); 
        }
      });
        const nodeGroup = d3.select(this);
        const attribute = d.data.attribute;
        const xPos = headerPositions[attribute] - (isCompactLayout ? 60 : 100) ?? 0;  
        newY = d.x + totalYOffset;
        nodeGroup.transition()
        .duration(500)
        .attr('transform', `translate(${xPos}, ${newY})`);
        if (expandedNodes.has(d)) {
          const attribute = d.data.attribute;
  
          const isCategorical = typeof originalDataset.find(d => d && d[attribute] !== null)?.[attribute] === 'string';
          
          let attributeValues;
          if (isCategorical) {
            const allPossibleValues = new Set();
            
            if (originalDataset[d.data.Original_Index]?.[attribute] !== undefined &&
                originalDataset[d.data.Original_Index]?.[attribute] !== null) {
              allPossibleValues.add(originalDataset[d.data.Original_Index][attribute]);
            }
            
            d.data.indices.forEach(index => {
              if (cfRowData[index]?.[attribute] !== undefined && cfRowData[index]?.[attribute] !== null) {
                allPossibleValues.add(cfRowData[index][attribute]);
              }
            });
            
            originalDataset.forEach(item => {
              if (item && item[attribute] !== undefined && item[attribute] !== null) {
                allPossibleValues.add(item[attribute]);
              }
            });
            
            attributeValues = Array.from(allPossibleValues).filter(value => 
              value !== undefined && value !== null
            );
          } else {
            const allNumericValues = new Set();
            
            const originalValue = originalDataset[d.data.Original_Index]?.[attribute];
            if (originalValue !== undefined && originalValue !== null && !isNaN(originalValue)) {
              allNumericValues.add(Number(originalValue));
            }
            
            d.data.indices.forEach(index => {
              const val = cfRowData[index]?.[attribute];
              if (val !== undefined && val !== null && !isNaN(val)) {
                allNumericValues.add(Number(val));
              }
            });
            
            originalDataset.forEach(item => {
              if (item && item[attribute] !== undefined && item[attribute] !== null && !isNaN(item[attribute])) {
                allNumericValues.add(Number(item[attribute]));
              }
            });
            
            const numValues = Array.from(allNumericValues).sort((a, b) => a - b);
            if (numValues.length >= 2) {
              const min = Math.min(...numValues);
              const max = Math.max(...numValues);
              
              const step = (max - min) / 10; 
              const extendedValues = [];
              for (let val = min; val <= max; val += step) {
                extendedValues.push(val);
              }
              if (!extendedValues.includes(max)) {
                extendedValues.push(max);
              }
              attributeValues = extendedValues;
            } else {
              attributeValues = numValues;
            }
          }
          
          console.log(`Complete attribute values for ${attribute}:`, attributeValues);
          tickPositionsMap[`${attribute}-${d.id}`] = getAxisTickPositions(yScalesMap[attribute], attributeValues, newY + (isCompactLayout ? 10 : 13)); 
        }

    }
      
  );

    svg.selectAll('.link').each(function(d) {
        const link = d3.select(this);

        const sourceX = headerPositions[d.source.data.attribute] - (isCompactLayout ? 20 : 25); 
        const targetX = headerPositions[d.target.data.attribute] - (isCompactLayout ? 20 : 25); 
        sourceY = d.source.originalY;
        targetY = d.target.originalY;
        
        const processedSourcePositions = new Set();
        const processedTargetPositions = new Set();
        
        expandedNodes.forEach(expandedNode => {
          const expandedNodeY = expandedNode.originalY || expandedNode.x;
          
          if (d.source.x > expandedNodeY && !processedSourcePositions.has(expandedNodeY)) {
            sourceY += yOffset;
            processedSourcePositions.add(expandedNodeY);
          }
          
          if (d.target.x > expandedNodeY && !processedTargetPositions.has(expandedNodeY)) {
            targetY += yOffset;
            processedTargetPositions.add(expandedNodeY);
          }
        });

        const controlX1 = sourceX + (targetX - sourceX) * 0.01;
        const controlY1 = sourceY;
        
        const indexOfSource = selectedAttributes.indexOf(d.source.data.attribute);
        const indexOfTarget = selectedAttributes.indexOf(d.target.data.attribute);

        let path;
        if (indexOfTarget == indexOfSource + 1) {
          path = `M${sourceX},${sourceY} C${controlX1},${controlY1} ${controlX1},${targetY} ${targetX},${targetY}`;
        } else {
          const nextStartAttributeIndex = indexOfSource + 1;
          const nextStartPositionX = headerPositions[selectedAttributes[nextStartAttributeIndex]];

          path = `M${sourceX},${sourceY} C${controlX1},${controlY1} ${controlX1},${targetY} ${nextStartPositionX},${targetY} L ${targetX},${targetY}`;
        }

        link.transition()
          .duration(500)
          .attr('d', path);
    });
      
}

    svg.selectAll('.link')
        .data(filteredLinks)
        .enter().append('path')
        .attr('class', 'link')
        .attr('d', d => {
            if (!d.source || !d.target) {
              console.error('Invalid link data:', d);
              return null;
            }
          
            const sourceX = headerPositions[d.source.data.attribute]-25;
            const targetX = headerPositions[d.target.data.attribute]-25;
          
            if (sourceX === undefined || targetX === undefined) {
              console.warn('Header position undefined for source or target:', d);
              return null;
            }
          
            const sourceY = d.source.x;
            const targetY = d.target.x;
            const controlX1 = sourceX + (targetX - sourceX) * 0.01;
            const controlY1 = sourceY;
            const indexOfSource=selectedAttributes.indexOf(d.source.data.attribute);
            const indexOfTarget=selectedAttributes.indexOf(d.target.data.attribute)
            console.log('Drawing link from:', d.source.data.attribute, 'to:', d.target.data.attribute);
            if (indexOfTarget==indexOfSource+1)
              {return `M${sourceX},${sourceY} C${controlX1},${controlY1} ${controlX1},${targetY} ${targetX},${targetY}`;}
            else
              {
                const nextStartAttributeIndex=indexOfSource+1
                const nextStartPositionX = headerPositions[selectedAttributes[nextStartAttributeIndex]]
                console.log(nextStartAttributeIndex)
                console.log(nextStartPositionX)

                return `M${sourceX},${sourceY} C${controlX1},${controlY1} ${controlX1},${targetY} ${nextStartPositionX},${targetY} L ${targetX},${targetY}`;
              }

          })
        .attr('fill', 'none')
        .attr('stroke', '#555');

    
    let nodeIdCounter = 0;
    const nodes = svg.selectAll('.node')
      .data(root.descendants().filter(d => d.depth > 0&& d.data.attribute !== 'null'))
      .enter().append('g')
      .attr('class', `node ${isCompactLayout ? 'compact-node' : ''}`) 
      .attr('id', d => {
        const uniqueId = `node-${nodeIdCounter++}`;
        d.id = uniqueId; 
        return uniqueId;
      })
      .attr('transform', d => {
        if (!d || !d.data) {
          console.error('Invalid node data:', d);
          return `translate(0, ${d.x})`; 
        }
        const attribute = d.data.attribute;
        if (attribute === 'null') {
                  return `translate(0, 0)`;  
                }
        const xPos = headerPositions[attribute] - (isCompactLayout ? 60 : 100) ?? 0; 
        return `translate(${xPos},${d.x})`;
      });


    const boxWidth = isCompactLayout ? 80 : 150; 
    const boxHeight = isCompactLayout ? 16 : 28; 
    let expandedNodes = new Set();
    
    nodes.append('rect')
    .attr('width', boxWidth)  
    .attr('height', boxHeight)  
    .attr('x', -boxWidth / 2)  
    .attr('y', -boxHeight / 2)  
    .attr('rx', 6)  
    .attr('ry', 6)
    .attr('fill', '#69b3a2')  
    .attr('stroke', '#555')  
    .attr('stroke-width', 1)  
    .on('click', function(event, node) {
        console.log('Node clicked:', node);
        const nodeGroup = d3.select(this.parentNode);
        const isExpanded = expandedNodes.has(node); 
        const expandedHeight = (isCompactLayout ? 100 : 169);  
        const collapsedHeight = boxHeight;  
        const yOffset = expandedHeight - collapsedHeight;  
        let newY;
        if (isExpanded) {
          nodeGroup.select('rect')
              .transition()
              .duration(500)
              .attr('height', collapsedHeight);  
  
          nodeGroup.selectAll('.parallel-coordinates').remove();
          
          svg.selectAll(".parallel-line").filter(function() {
            const line = d3.select(this);
            const sourcePath = line.attr("d");
            const nodePosition = nodeGroup.attr('transform');
            return sourcePath && sourcePath.includes(nodePosition);
          }).remove();
          
          nodeGroup.select('.octagon-indicator')
              .style('display', 'block');
          
          nodeGroup.select('.toggle-button').text('+');
          expandedNodes.delete(node); 
          adjustNodeAndLinkPositions(expandedNodes, false,yOffset);  
          
      } else {
          nodeGroup.select('rect')
              .transition()
              .duration(300)
              .attr('height', expandedHeight) 
              .on('start', function() {
                nodeGroup.raise()
                .style('overflow', 'visible');  
            });
          
          nodeGroup.select('.octagon-indicator')
              .style('display', 'none');
              
          nodeGroup.selectAll('.parallel-coordinates').remove();

          console.log("indices:"+node.data.indices)
          let filteredData;

           filteredData = node.data.indices.map(index => cfRowData[index]).filter(datum => datum !== undefined);
           console.log("filteredData before drawing",filteredData,"cfRowData",cfRowData)
          
          const attribute = node.data.attribute; 

          const parallelGroup = nodeGroup.append('g')
              .attr('class', 'parallel-coordinates')
              .attr('transform', `translate(${-boxWidth / 2}, ${boxHeight / 2})`);  

          drawParallelCoordinates(originalDataset, filteredData, parallelGroup,attribute,node);  
          nodeGroup.select('.toggle-button').text('-');
          expandedNodes.add(node); 
          adjustNodeAndLinkPositions(expandedNodes, true,yOffset);  
          
          
      }
      drawParallelLines(expandedNodes);
      nodeGroup.select('.toggle-button').text(isExpanded ? '+' : '-');
      nodeGroup.attr('data-expanded', !isExpanded);
    });


    const radius = isCompactLayout ? 7 : 10;  
    nodes.filter(d => {
        console.log("Node being checked for null children:", d);
        if (d.children) {
            const hasNullChild = d.children.some(child => child.data.attribute === 'null');
            if (hasNullChild) {
                console.log("Found parent with 'null' child:", d);
            }
            return hasNullChild;
        }
        return false;
    })
    .each(function(d) {
      const nullChild = d.children.find(child => child.data.attribute === 'null');
      const nullCount = nullChild ? nullChild.data.count : 0;
      console.log("nullCount",nullCount)
      
      const octagonGroup = d3.select(this)
        .append('g')
        .attr('class', 'octagon-indicator');
      
      octagonGroup.append('polygon')
        .attr('points', () => {
            console.log("Appending octagon for node...");
            
            let angle = Math.PI / 4;  
            const points = [];
            for (let i = 0; i < 8; i++) {
                points.push([
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                ]);
                angle += Math.PI / 4;
            }
            return points.map(p => p.join(',')).join(' ');
        })
        .attr('transform', `translate(${boxWidth / 2 - (isCompactLayout ? 1.5 : 3)}, ${boxHeight / 2 - (isCompactLayout ? 1.5 : 3)})rotate(22.5)`)  
        .attr('fill', 'orange')  
        .attr('stroke', '#555')
        .attr('stroke-width', 1);
        
      octagonGroup.append('text')
        .attr('x', boxWidth / 2 - (isCompactLayout ? 1.5 : 3))  
        .attr('y', boxHeight / 2 - (isCompactLayout ? 1 : 1))  
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', 'white')
        .attr('font-size', isCompactLayout ? 9 : 12) 
        .text(nullCount);
    });

    nodes.append('text')
        .attr('dy', isCompactLayout ? '.25em' : '.35em') 
        .attr('x', 0) 
        .attr('text-anchor', 'middle') 
        .attr('fill', '#fff') 
        .attr('class', isCompactLayout ? 'compact-node-label' : '') 
        .text(d => {
            if (isCompactLayout && d.data?.attribute) {
                const attribute = d.data.attribute;
                const count = d.data.count;
                const displayAttr = attribute.length > 10 ? 
                    attribute.substring(0, 8) + '...' : attribute;
                return `${displayAttr} (${count})`;
            }
            return d.data?.attribute ? `${d.data.attribute} (${d.data.count})` : 'undefined';
        });

    nodes.append('text')
        .attr('class', `toggle-button ${isCompactLayout ? 'compact-button-label' : ''}`) 
        .attr('x', boxWidth / 2 - (isCompactLayout ? 5 : 10))  
        .attr('y', -boxHeight / 2 + (isCompactLayout ? 9 : 15)) 
        .attr('text-anchor', 'middle')
        .style('cursor', 'pointer')
        .text('+')
        .on('click', function(event, node) {
            event.stopPropagation();
            
            d3.select(this.parentNode).select('rect').dispatch('click');
        });
      if (clusterLegend.length > 0) {
        const validClusterIds = clusterLegend.map(cluster => cluster.cluster_id);
      }
  }, [treeData, selectedAttributes, clusterLegend, isCompactLayout, selectedClusterId]); 


    
    



        

    
    
    



    

   return (    <div className="tree-container">
      <svg ref={svgRef}></svg>
    </div>
  );
};

export default TreeDiagram;
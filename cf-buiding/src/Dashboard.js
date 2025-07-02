import React, { useState, useEffect,useCallback } from 'react';
import FilterableHeader from './components/FilterableHeader';
import TreeDiagram from './components/TreeDiagram';
import treeData from './treeResult.js';
import './App.css'; 
import CounterfactualCard from './components/CounterfactualCard';
import NavBar from './components/NavBar';
import totoroImage from './assets/totoro.png'; 
import groupImage from './assets/group.png'; 
import { datasets } from './cfRowData'; 
import { debounce } from 'lodash';
import ThresholdSlider from "./components/ThresholdSlider";
import * as d3 from 'd3';



const Dashboard = () => {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState("income");
  const selectedDataset = datasets[selectedDatasetKey];

  const attributeOrder = selectedDataset.originalDataset
  ? Object.keys(selectedDataset.originalDataset[0]).filter(attr => attr !== "target")
  : [];

  const attributeOrderWithTarget = [...attributeOrder, "target"];

  const [selectedAttributes, setSelectedAttributes] = useState(attributeOrder);
  const [headersLoaded, setHeadersLoaded] = useState(false);
  const [treeDataState, setTreeDataState] = useState(treeData["income"]);
  const [cfRowDataState, setCfRowDataState] = useState(selectedDataset.cfRowData);
  const [originalCfRowData, setOriginalCfRowData] = useState(null);
  console.log("cfRowDataState",cfRowDataState);
  const [viewMode, setViewMode] = useState("individual");
  const [selectedDataIndices, setSelectedDataIndices] = useState([]);
  const [thresholds, setThresholds] = useState({ min_threshold: 0, max_threshold: 1, default: 0.5 });
  const [currentThreshold, setCurrentThreshold] = useState(0.5);
  const [descriptionThreshold, setDescriptionThreshold] = useState(0.7); 
  const [originalTreeData, setOriginalTreeData] = useState(treeData["income"]);
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const [clusteringThreshold, setClusteringThreshold] = useState(0.5);
  const [clusterLegend, setClusterLegend] = useState([]);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, content: "" });
  const [originalData, setOriginalData] = useState(datasets[selectedDatasetKey].originalDataset[1]);

  const [selectedValues, setSelectedValues] = useState({});

  const isCompactLayout = attributeOrder.length > 18;

  const toggleCard = () => {
    setIsCardExpanded(prevState => !prevState);
    
    if (viewMode === "group" && !isCardExpanded) {
      const dataToUse = originalCfRowData || datasets[selectedDatasetKey].cfRowData;
      setCfRowDataState(dataToUse);
    }
  };

  const handleShowAllAttributes = () => {
    console.log("Show All Attributes clicked!");  
    console.log("originalTreeData", originalTreeData);
    setSelectedAttributes(attributeOrder);
    
    if (viewMode === "group") {
      setSelectedClusterId(null);
      d3.selectAll(".filter-header-cell").style("background-color", "");
      
      if (originalCfRowData) {
        setCfRowDataState(originalCfRowData);
      } else {
        setCfRowDataState(datasets[selectedDatasetKey].cfRowData);
      }
    }
    
    setTreeDataState(null);
    setTimeout(() => {
      setTreeDataState(originalTreeData);
    }, 200);
  };

  const handleDatasetChange = (event) => {
    const newDatasetKey = event.target.value;
    setSelectedDatasetKey(newDatasetKey);
    
    const newAttributeOrder = Object.keys(datasets[newDatasetKey].originalDataset[0])
      .filter(attr => attr !== "target");
      
    setSelectedAttributes(newAttributeOrder);
    
    setSelectedValues({});
    
    if (viewMode === "individual") {
      setSelectedDataIndices([0]);
      
      if (datasets[newDatasetKey]?.originalDataset?.length > 0) {
        setOriginalData(datasets[newDatasetKey].originalDataset[1]);
      }
    } else {
      const allIndices = Array.from(
        { length: datasets[newDatasetKey].originalDataset.length }, 
        (_, i) => i
      );
      setSelectedDataIndices(allIndices);
      
      if (datasets[newDatasetKey]?.originalDataset?.length > 0) {
        setOriginalData(datasets[newDatasetKey].originalDataset);
      }
    }
    
    setCfRowDataState(datasets[newDatasetKey].cfRowData);
    setOriginalCfRowData(null);
    
    setSelectedClusterId(null);
    setClusterLegend([]);
    
    if (treeData[newDatasetKey]) {
      setTreeDataState(null);
      setOriginalTreeData(null);
      setTimeout(() => {
        setTreeDataState(treeData[newDatasetKey]);
        setOriginalTreeData(treeData[newDatasetKey]);
              }, 200);
    } else {
      console.warn(`No tree data found for dataset: ${newDatasetKey}`);
      const emptyTree = {
        "attribute": "Root",
        "indices": [],
        "children": []
      };
      setTreeDataState(emptyTree);
      setOriginalTreeData(emptyTree);
    }
  };
  
  const handleAttributeValueChange = (attribute, values) => {
    console.log(`Updating selectedValues for ${attribute}:`, values);
    setSelectedValues((prevValues) => ({ ...prevValues, [attribute]: values }));
  };

  const toggleViewMode = (mode) => {
    setViewMode(mode);
    if (mode === "individual") {
      setSelectedDataIndices([0]); 
    } else {
      setSelectedDataIndices([]); 
    }
  };

  useEffect(() => {
    if (!selectedDataset || selectedDataIndices.length === 0) return;
    if (datasets[selectedDatasetKey]?.originalDataset?.length > 0) {
      setOriginalData(datasets[selectedDatasetKey].originalDataset[1]);
    }
    console.log('treeData in Dashboard:', treeDataState);
    console.log('cfs in Dashboard:', cfRowDataState);
    const filteredIndices = Object.values(cfRowDataState) 
      .flat()
      .reduce((indices, row, index) => {
        const match = Object.keys(selectedValues).every(attribute => {
          const selected = selectedValues[attribute];
          return Array.isArray(selected) ? selected.includes(row[attribute]) : row[attribute] === selected;
        });
        return match ? [...indices, index] : indices;
      }, []);

    const filteredTree = filterTreeByIndices(treeDataState, filteredIndices);
    setTreeDataState(filteredTree);
    console.log('filteredIndices',filteredIndices);
    console.log('Filtered Tree:', JSON.stringify(filteredTree, null, 2));
  }, [selectedValues, selectedDataset]);  
    
    const filterTreeByIndices = (node, filteredIndices) => {
      if (!node) return null;
      const nodeHasMatchingIndices = node.indices.some(index => filteredIndices.includes(index));
    
      const filteredChildren = (node.children || [])
        .map(child => filterTreeByIndices(child, filteredIndices))
        .filter(child => child !== null);
    
      if (!nodeHasMatchingIndices && filteredChildren.length === 0) {
        return null;
      }
    
      return {
        ...node,
        children: filteredChildren,
        indices: node.indices.filter(index => filteredIndices.includes(index)),
      };
    };


const pruneTree = (tree, attributeToRemove) => {
  if (!tree) return tree;
  const prunedNode = { ...tree };
  if (prunedNode.attribute === attributeToRemove) {
    return null;
  }
  if (prunedNode.children && prunedNode.children.length > 0) {
    const prunedChildren = prunedNode.children
      .map(child => pruneTree(child, attributeToRemove))
      .filter(child => child !== null);
    if (prunedChildren.length === 0 && prunedNode.attribute !== "Root") {
      return null;
    }
    prunedNode.children = prunedChildren;
    if (prunedNode.attribute !== "Root") {
      const allChildIndices = [...new Set(prunedChildren.flatMap(child => child.indices || []))];
      prunedNode.indices = allChildIndices;
      prunedNode.count = allChildIndices.length;
    }
  }
  return prunedNode;
};

  const handleAttributeChange = (attribute) => {
    setSelectedAttributes((prevSelected) => {
      const updatedAttributes = prevSelected.includes(attribute)
        ? prevSelected.filter((attr) => attr !== attribute)
        : [...prevSelected, attribute];
  
      fetch('http://localhost:8000/api/filter-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          selectedAttributes: updatedAttributes,
          datasetKey: selectedDatasetKey 
        }),
      })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
          return response.json();
        })
        .then(data => {
          console.log('Updated data from Backend:', data);
          
          if (data.tree) {
            setTreeDataState(data.tree);
          } else {
            setTreeDataState(data);
          }
          
          if (data.cfRowData) {
            console.log('Updating cfRowData with filtered data');
            setCfRowDataState(data.cfRowData);
            
            if (!originalCfRowData) {
              setOriginalCfRowData(data.cfRowData);
            }
          }
        })
        .catch(error => {
          console.error('Error fetching filtered tree:', error);
        });

      return updatedAttributes;
    });
  };


  const handleHeadersRendered = () => {
    setHeadersLoaded(true);
  };
const handleReorder = (newOrder) => {
  console.log("newOrder", newOrder);
  setSelectedAttributes(newOrder); 
  
  fetch('http://localhost:8000/api/reorder-attributes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reorderedAttributes: newOrder }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log('New tree data from FastAPI:', data);
      setTreeDataState(data);
    })
    .catch((error) => {
      console.error('Error updating tree data:', error);
    });
};

const handleThresholdChange = (newClusteringThreshold) => {
  console.log("handleThresholdChange called with:", newClusteringThreshold);
  setClusteringThreshold(newClusteringThreshold);
  sendThresholdsToBackend(newClusteringThreshold, descriptionThreshold, selectedAttributes);
};

  const handleDescriptionThresholdChange = (newAttributeThreshold) => {
    setDescriptionThreshold(newAttributeThreshold);
    sendThresholdsToBackend(clusteringThreshold, newAttributeThreshold, selectedAttributes);
  };
      
      const highlightCommonAttributes = (attributes,clusterId) => {
              d3.selectAll(".filter-header-cell").each(function () {
          const headerCell = d3.select(this);
          const attribute = headerCell.text().trim();
          if (attributes.includes(attribute)) {
            headerCell.style("background-color", getClusterColor(clusterId));
          }
        });
      };
  
  
      const handleClusterClick = (clusterId) => {
        setSelectedClusterId(clusterId);
        console.log(`Cluster ${clusterId} selected`);
        const selectedCluster = clusterLegend.find(cluster => cluster.cluster_id === clusterId);
        d3.selectAll(".filter-header-cell").style("background-color", ""); 
        
        if (selectedCluster) {
          setTreeDataState(selectedCluster.tree)
          console.log("selectedCluster.tree", selectedCluster.tree);
          
          highlightCommonAttributes(selectedCluster.common_attributes, clusterId); 
        } 
        else {
          setTreeDataState(treeData);
          setCfRowDataState(datasets[selectedDatasetKey].cfRowData);
          setOriginalCfRowData(null);
          highlightCommonAttributes([]);
        }
      };
  
      const handleShowAllGroups = () => {
        console.log("Show All Groups clicked!"); 
        d3.selectAll(".filter-header-cell").style("background-color", ""); 
        if (originalTreeData) {
          console.log("originalTreeData", originalTreeData);
          setTreeDataState(originalTreeData);
          setSelectedClusterId(null);
          
          if (originalCfRowData) {
            setCfRowDataState(originalCfRowData);
          } else {
            setCfRowDataState(datasets[selectedDatasetKey].cfRowData);
          }
          setOriginalCfRowData(null);
        } else {
          console.warn("Original tree data is not available!");
        }
        highlightCommonAttributes([]);
      }
      const handleClusterHover = (cluster) => {
        if (!cluster) {
          highlightCommonAttributes([]);
          d3.selectAll(".filter-header-cell").style("background-color", "");
          return;
        }
      
        highlightCommonAttributes(cluster.common_attributes,cluster.cluster_id);
      
        if (cluster) {
          setTooltip({
            visible: true,
            content: `Common Attributes: ${cluster.common_attributes.join(", ")}`,
            x: window.event.pageX + 10,
            y: window.event.pageY - 20
          });
        } else {
          setTooltip({ visible: false, content: "", x: 0, y: 0 });
        }
      };
      
      const getClusterColor = (clusterId) => {
        const colors = [
          "#e6194B", "#3cb44b", "#ffe119", "#4363d8", "#f58231", 
          "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe", 
          "#008080", "#e6beff", "#9A6324", "#800000", "#aaffc3", 
          "#808000", "#FFD700", "#808080", "#000075", "#a9a9a9"
        ];
        return colors[clusterId % colors.length];
      };
  
      const sendThresholdsToBackend = useCallback(debounce(async (thresholdValue,descriptionThresholdValue,customOrder) => {
        try {
          const response = await fetch("http://localhost:8000/api/update-thresholds", {
            method: "POST",
            mode: "cors",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              threshold: thresholdValue,
              attributeOrder: customOrder,
              descriptionThreshold: descriptionThresholdValue,
            }),
          });
  
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
  
          const result = await response.json();
          console.log("Updated tree data:", result.tree);
          if (result.tree) {
            setTreeDataState(result.tree);
          }
          if(result.clusterLegend){
            setClusterLegend(result.clusterLegend);
            console.log("clusterLegend",result.clusterLegend)
          }
        } catch (error) {
          console.error("Error updating threshold:", error);
        }
      }, 300), []);
   
  return (
    <div className={isCompactLayout ? 'compact-layout' : ''}>
      <div className="dataset-selector">
        <label htmlFor="dataset">Select Dataset: </label>
        <select id="dataset" value={selectedDatasetKey} onChange={handleDatasetChange}>
          {Object.keys(datasets).map((key) => (
            <option key={key} value={key}>
              {datasets[key].name}
            </option>
          ))}
        </select>
      </div>
      <NavBar
        userPhoto={totoroImage}
        groupPhoto={groupImage}
        viewMode={viewMode}
        toggleViewMode={toggleViewMode}
        originalData={originalData}
        attributeOrder={attributeOrder}
        attributeOrderWithTarget={attributeOrderWithTarget}
        groupData={selectedDataset.originalDataset} 
        setSelectedDataIndices={setSelectedDataIndices} 
        setTreeDataState={setTreeDataState}
        setCfRowDataState={setCfRowDataState}
        setThresholds={setThresholds}
        setCurrentThreshold={setCurrentThreshold}
        setOriginalTreeData={setOriginalTreeData}
        selectedDatasetKey={selectedDatasetKey}  
        setOriginalData={setOriginalData} 
        isCompactLayout={isCompactLayout}
      />
      

        {viewMode === 'individual' && 
          <div className="buttons-container">
            <button className="toggle-btn" onClick={toggleCard}>
              Filter Counterfactuals by Attributes
            </button>
            <button className="showallattributes-btn" onClick={handleShowAllAttributes}>Show All Attributes</button>
          </div>
        }
        {viewMode === 'group' && 
          <>
            <div className="buttons-container">
              <button className="toggle-btn" onClick={toggleCard}>
                Filter Counterfactuals by Attributes
              </button>
              <button className="showallattributes-btn" onClick={handleShowAllAttributes}>Show All Attributes</button>
            </div>
            <ThresholdSlider
                thresholds={thresholds}
                clusteringThreshold={clusteringThreshold}
                descriptionThreshold={descriptionThreshold}
                handleThresholdChange={handleThresholdChange}
                handleDescriptionThresholdChange={handleDescriptionThresholdChange}
                clusterLegend={clusterLegend}
                selectedClusterId={selectedClusterId}
                handleClusterClick={handleClusterClick}
                handleShowAllGroups={handleShowAllGroups}
                getClusterColor={getClusterColor}
                tooltip={tooltip}
                selectedAttributes={selectedAttributes}
                isCompactLayout={isCompactLayout}
              />
          </>
        }
      
      <div className={`cards-container ${isCardExpanded ? "expanded" : "collapsed"}`}>
          {isCardExpanded && (
              <CounterfactualCard
                  attributes={selectedAttributes}  
                  onAttributeValueChange={handleAttributeValueChange}
                  selectedDatasetKey={selectedDatasetKey}
                  cfRowData={cfRowDataState}
                  isCompactLayout={isCompactLayout} 
              />
          )}
      </div>
      <FilterableHeader
        selectedAttributes={selectedAttributes}
        onAttributeChange={handleAttributeChange}
        headersRendered={handleHeadersRendered}
        onReorder={handleReorder}
        setSelectedAttributes={setSelectedAttributes}
        isCompactLayout={isCompactLayout} 
      />
      <TreeDiagram treeData={treeDataState} 
        selectedAttributes={selectedAttributes} 
        selectedDatasetKey={selectedDatasetKey}
        selectedDataIndices={selectedDataIndices} 
        cfRowData={cfRowDataState}
        currentThreshold={currentThreshold}  
        onThresholdChange={(updatedTree) => {
          console.log("Updating tree state from threshold change");
          setTreeDataState(updatedTree); 
        }}
        thresholds={thresholds} 
        currentDescriptionThreshold={descriptionThreshold} 
        setTreeDataState={setTreeDataState}
        originalTreeData={originalTreeData}
        getClusterColor={getClusterColor} 
        clusterLegend={clusterLegend}
        isCompactLayout={isCompactLayout} 
      />

     </div>
  );
};

export default Dashboard;





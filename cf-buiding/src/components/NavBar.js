import React, { useState, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import CheckboxDropdown from './CheckboxDropdown';
import './NavBar.css';
import ReactSlider from "react-slider";
import { FaFilter } from "react-icons/fa";

const NavBar = ({ userPhoto, groupPhoto, viewMode, toggleViewMode, originalData, attributeOrder, attributeOrderWithTarget, groupData, setSelectedDataIndices, setTreeDataState, setCfRowDataState, setThresholds, setCurrentThreshold, setOriginalTreeData, selectedDatasetKey,setOriginalData, isCompactLayout }) => {
  const [filter, setFilter] = useState({});
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectedRowIndices, setSelectedRowIndices] = useState([]);
  const [openDropdowns, setOpenDropdowns] = useState({});

  console.log("Selected Dataset Key:", selectedDatasetKey);

  const datasetTargetNames = {
    income: "income"
  };

  const targetName = datasetTargetNames[selectedDatasetKey] || "target";

  const getDisplayName = (attr) => {
    if (attr === "target") {
      return datasetTargetNames[selectedDatasetKey]?.replace('_', ' ') || "Target";
    }
    return attr.replace('_', ' ');
  };

  const updatedAttributeOrderWithTarget = attributeOrderWithTarget.map((attr) =>
    attr === "target" ? targetName : attr
  );

  const uniqueValuesByAttribute = useMemo(() => {
    const uniqueMap = {};
    (updatedAttributeOrderWithTarget || []).forEach((attribute) => {
      uniqueMap[attribute] = [...new Set(groupData.map((row) => row[attribute]))];
    });
    return uniqueMap;
  }, [updatedAttributeOrderWithTarget, groupData]);

  const isCategorical = (attribute) => {
    if (!groupData || groupData.length === 0) {
      console.warn("groupData is empty or undefined!");
      return false;
    }
    if (attribute === "target") {
      return true;
    }
    const uniqueValues = uniqueValuesByAttribute[attribute] || [];
    return (
      typeof groupData[0]?.[attribute] === 'string' ||
      Array.isArray(groupData[0]?.[attribute]) ||
      (uniqueValues.length > 0 && uniqueValues.every((value) => value === 0 || value === 1))
    );
  };

  const getOptions = (attribute) => [...new Set(groupData.map((row) => row[attribute]))];

  const handleFilterChange = (attribute, value) => {
    setFilter((prevFilter) => ({ ...prevFilter, [attribute]: value }));
  };

  const filteredDataWithIndices = useMemo(() => {
    return groupData
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) =>
        Object.keys(filter).every((key) =>
          filter[key]
            ? isCategorical(key)
              ? filter[key].length === 0 || filter[key].includes(row[key])
              : row[key] >= filter[key][0] && row[key] <= filter[key][1]
            : true
        )
      );
  }, [groupData, filter, isCategorical]);

  const Row = ({ index, style }) => {
    const { row, originalIndex } = filteredDataWithIndices[index];
    return (
      <div style={style} className="user-data-row">
        <div className="user-data-item">
          <input
            type="checkbox"
            checked={selectedRows.includes(row)}
            onChange={() => toggleRowSelection(row, originalIndex)}
          />
        </div>
        {(attributeOrderWithTarget || []).map((attribute) => (
          <div key={attribute} className="user-data-item">
            <span className="data-value">{row[attribute] ?? 'N/A'}</span>
          </div>
        ))}
      </div>
    );
  };

  const toggleRowSelection = (row, originalIndex) => {
    setSelectedRows((prevSelected) =>
      prevSelected.includes(row)
        ? prevSelected.filter((selected) => selected !== row)
        : [...prevSelected, row]
    );
    setSelectedRowIndices((prevIndices) =>
      prevIndices.includes(originalIndex)
        ? prevIndices.filter((index) => index !== originalIndex)
        : [...prevIndices, originalIndex]
    );
  };

  const toggleSelectAll = () => {
    const allSelected = filteredDataWithIndices.every(({ row }) => selectedRows.includes(row));
    if (allSelected) {
      setSelectedRows([]);
      setSelectedRowIndices([]);
    } else {
      setSelectedRows(filteredDataWithIndices.map(({ row }) => row));
      setSelectedRowIndices(filteredDataWithIndices.map(({ originalIndex }) => originalIndex));
    }
  };

  const toggleDropdown = (attribute, isOpen) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [attribute]: isOpen !== undefined ? isOpen : !prev[attribute],
    }));
  };

  const handleSubmit = async () => {
    console.log("Selected Rows Detail:", selectedRows);
    const payload = {
      selectedIndices: selectedRowIndices,
      attributeOrder: attributeOrder,
      databaseKey: selectedDatasetKey,
    };
    
    try {
      const response = await fetch('http://localhost:8000/api/process-selected-indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log("Response from backend:", result);
      
      if (result.tree) {
        setTreeDataState(result.tree);
        setOriginalTreeData(result.tree);
        console.log("Tree data updated successfully.");
      }
      
      if (result.cfRowData) {
        setCfRowDataState(result.cfRowData);
        console.log("cfRowData updated successfully.");
      }
      
      if (result.thresholds) {
        setThresholds(result.thresholds);
        setCurrentThreshold(result.thresholds.default);
        console.log("Thresholds updated successfully:", result.thresholds);
      }
      
      if (selectedRows.length === 1) {
        setOriginalData(selectedRows[0]);
        toggleViewMode('individual');
      }
    } catch (error) {
      console.error("Error submitting selected indices:", error);
    }
  };

  return (
    <div className={`navbar-container ${isCompactLayout ? 'compact-layout' : ''}`}> 
      <div className="navbar-top">
        <img
          src={viewMode === 'individual' ? userPhoto : groupPhoto}
          alt={viewMode === 'individual' ? 'User Avatar' : 'Group Avatar'}
          className="user-photo"
        />
        <h3 className={`username ${isCompactLayout ? 'compact-label' : ''}`}>{viewMode === 'individual' ? 'Individual View' : 'Group View'}</h3> 
        <div
          className={`toggle-container ${viewMode === 'group' ? 'active' : ''} ${isCompactLayout ? 'compact-toggle' : ''}`} 
          onClick={() => toggleViewMode(viewMode === 'individual' ? 'group' : 'individual')}
        >
          <div
            className="toggle-slider"
            style={{
              backgroundImage: `url(${viewMode === 'individual' ? userPhoto : groupPhoto})`,
            }}
          ></div>
        </div>
      </div>

      {viewMode === 'individual' ? (
        <div className="navbar-table">
          <div className="user-data-row header-row">
            {(attributeOrderWithTarget || []).map((attribute) => (
              <div key={attribute} className={`user-data-item ${isCompactLayout ? 'compact-item' : ''}`}> 
                <div className="header-title">
                  <span className={isCompactLayout ? 'compact-label' : ''}>{getDisplayName(attribute)}</span> 
                </div>
                <div className="data-content">
                  <span className={`data-value ${isCompactLayout ? 'compact-label' : ''}`}> 
                    {originalData?.[attribute] !== undefined && originalData?.[attribute] !== null 
                      ? (isCategorical(attribute) ? originalData[attribute].toString() : originalData[attribute])
                      : 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="navbar-table">
          
          <div className="user-data-row header-row">
            <div className={`user-data-item ${isCompactLayout ? 'compact-item' : ''}`}> 
              <input
                type="checkbox"
                onChange={toggleSelectAll}
                checked={filteredDataWithIndices.every(({ row }) => selectedRows.includes(row))}
              />
              <span className={isCompactLayout ? 'data-value compact-label' : 'data-value '}>Select All</span> 
            </div>
            {(attributeOrderWithTarget || []).map((attribute) => (
              <div key={attribute} className={`user-data-item ${isCompactLayout ? 'compact-item' : ''}`}> 
                <div 
                  className="header-title"
                  onClick={() => toggleDropdown(attribute)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`data-value ${isCompactLayout ? 'compact-label' : ''}`}>{getDisplayName(attribute)}</span>
                  <FaFilter
                    className="filter-icon"
                  />
                </div>
                <div className="filter-component">
                  {isCategorical(attribute) ? (
                    <CheckboxDropdown
                      attribute={attribute}
                      options={getOptions(attribute)}
                      selectedValues={filter[attribute] || []}
                      onChange={handleFilterChange}
                      isOpen={openDropdowns[attribute] || false}
                      toggleDropdown={(isOpen) => toggleDropdown(attribute, isOpen)}
                      isCompactLayout={isCompactLayout} 
                    />
                  ) : (
                    openDropdowns[attribute] &&(                    
                    <div className="range-slider">
                      <ReactSlider
                      min={Math.min(...groupData.map((row) => row[attribute]))}
                      max={Math.max(...groupData.map((row) => row[attribute]))}
                      value={filter[attribute] || [Math.min(...groupData.map((row) => row[attribute])), Math.max(...groupData.map((row) => row[attribute]))]}
                      onChange={(newValues) => handleFilterChange(attribute, newValues)}
                      className="slider-control"
                      thumbClassName={`thumb ${isCompactLayout ? 'compact-thumb' : ''}`}
                      trackClassName={(index) => (index === 1 ? "track-green" : "track-grey")}
                      renderThumb={(props, state) => <div {...props}>{state.valueNow}</div>}
                    />
                    
                  </div>)

                  )}
                </div>
              </div>
            ))}
          </div>

          <List height={150} itemCount={filteredDataWithIndices.length} itemSize={isCompactLayout ? 40 : 50} width="100%">
            {({ index, style }) => (
              <Row index={index} style={style} />
            )}
          </List>
          
          <div className="submit-section">
            <button 
              onClick={handleSubmit} 
              disabled={selectedRows.length === 0}
              className={isCompactLayout ? 'compact-button' : ''} 
            >
              {selectedRows.length === 1 
                ? "Submit for generating counterfactuals and direct to individual view" 
                : "Submit for generating counterfactuals"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NavBar;
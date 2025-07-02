import React, { useState,useEffect } from 'react';
import './CounterfactualCard.css';
import { datasets } from '../cfRowData';
import ReactSlider from 'react-slider';

const getUniqueValues = (data, attribute) => {
  const allCounterfactuals = Array.isArray(data) ? data : Object.values(data).flat();
  return [...new Set(allCounterfactuals.map((item) => item[attribute]))]
  .filter(value => value !== 0 && value !== "0" && value !== undefined && value !== null); 
};

const isNumerical = (data, attribute) => {
  const allCounterfactuals = Array.isArray(data) ? data : Object.values(data).flat();
  return allCounterfactuals.every((item) => typeof item[attribute] === 'number');
};

const CounterfactualCard = ({ attributes, onAttributeValueChange, selectedDatasetKey = 'dataset1' ,cfRowData, isCompactLayout }) => { 
  const selectedDataset = datasets[selectedDatasetKey];
  const allCounterfactuals = cfRowData ? (Array.isArray(cfRowData) ? cfRowData : Object.values(cfRowData).flat()) : [];

  const [values, setValues] = useState({});
  
  useEffect(() => {
    if (!cfRowData) return;

    const updatedValues = attributes.reduce((acc, attr) => {
      if (isNumerical(allCounterfactuals, attr)) {
        const min = Math.min(...allCounterfactuals.map((row) => row[attr]));
        const max = Math.max(...allCounterfactuals.map((row) => row[attr]));
        acc[attr] = [min, max]; 
      } else {
        const uniqueValues = getUniqueValues(allCounterfactuals, attr);
        acc[attr] = Array.isArray(uniqueValues) ? uniqueValues : [];
      }
      return acc;
    }, {})

    setValues(updatedValues);
  }, [cfRowData, attributes]);
  
  useEffect(() => {
    const syncControlsWithHeaderCells = () => {
      const headerCells = document.querySelectorAll('.filter-header-cell');
      const attributeControls = document.querySelectorAll('.attribute-control');
      
      if (headerCells.length === 0 || attributeControls.length === 0) return;
      
      headerCells.forEach((cell, index) => {
        if (attributeControls[index]) {
          const cellWidth = cell.getBoundingClientRect().width + 10;
          attributeControls[index].style.width = `${cellWidth}px`;
        }
      });
    };
    
    setTimeout(syncControlsWithHeaderCells, 100);
    
    window.addEventListener('resize', syncControlsWithHeaderCells);
    
    const observer = new MutationObserver(() => {
      setTimeout(syncControlsWithHeaderCells, 100);
    });
    
    const filterHeaderContainer = document.querySelector('.filter-header-container');
    if (filterHeaderContainer) {
      observer.observe(filterHeaderContainer, { 
        childList: true, 
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      });
    }
    
    return () => {
      window.removeEventListener('resize', syncControlsWithHeaderCells);
      observer.disconnect();
    };
  }, [attributes, selectedDatasetKey, cfRowData]); 
  
  const handleRangeChange = (attribute, newValues) => {
    setValues((prevValues) => {
      const updatedValues = { ...prevValues, [attribute]: newValues };
      onAttributeValueChange(attribute, updatedValues[attribute]);
      return updatedValues;
    });
  };

  const handleCheckboxChange = (attribute, value) => {
    setValues((prevValues) => {
      const currentValues = prevValues[attribute] || [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      onAttributeValueChange(attribute, newValues); 
      return { ...prevValues, [attribute]: newValues };
    });
  };

  return (
    <div className={`control-panel ${isCompactLayout ? 'compact-layout' : ''}`}> 
      {attributes.filter(attr => attr !== "target").map((attribute) => (
        <div className={`attribute-control ${isCompactLayout ? 'compact-control' : ''}`} key={attribute}> 
          <label className={isCompactLayout ? 'compact-label' : ''}>{attribute}</label> 
          {isNumerical(allCounterfactuals, attribute) ? (
            <div className={`range-slider ${isCompactLayout ? 'compact-slider-container' : ''}`}> 
              <ReactSlider
                min={Math.min(...allCounterfactuals.map((row) => row[attribute]))}
                max={Math.max(...allCounterfactuals.map((row) => row[attribute]))}
                value={values[attribute]}
                onChange={(newValues) => handleRangeChange(attribute, newValues)}
                className={`slider-control ${isCompactLayout ? 'compact-slider' : ''}`} 
                thumbClassName={`thumb ${isCompactLayout ? 'compact-thumb' : ''}`} 
                trackClassName={(index) => (index === 1 ? 'track-green' : 'track-grey')}
                renderThumb={(props, state) => <div {...props} className={`thumb ${isCompactLayout ? 'compact-thumb' : ''}`}>{state.valueNow}</div>} 
              />
              <span className={`range-display ${isCompactLayout ? 'compact-label' : ''}`}>{`Range: ${values[attribute]?.[0] ?? "N/A"} - ${values[attribute]?.[1] ?? "N/A"}`}</span> 
            </div>
          ) : (
            <div className="checkbox-container-vertical">
              {values[attribute]?.filter(value => value !== 0 && value !== "0").map((value) => (
                <div key={value} className={`checkbox-control ${isCompactLayout ? 'compact-checkbox-control' : ''}`}> 
                  <input
                    type="checkbox"
                    id={`${attribute}-${value}`}
                    value={value}
                    checked={Array.isArray(values[attribute]) && values[attribute].includes(value)}
                    onChange={() => handleCheckboxChange(attribute, value)}
                    className={`original-data-value ${isCompactLayout ? 'compact-checkbox' : ''}`} 
                  />
                  <label htmlFor={`${attribute}-${value}`} className={isCompactLayout ? 'compact-label' : ''}>{value}</label> 
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CounterfactualCard;


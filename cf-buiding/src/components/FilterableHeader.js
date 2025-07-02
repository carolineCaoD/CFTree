import React, { useState, useEffect } from 'react';
import './FilterableHeader.css';  

const FilterableHeader = ({ selectedAttributes, onAttributeChange, headersRendered, onReorder, isCompactLayout }) => { 
  const [orderedAttributes, setOrderedAttributes] = useState(
    selectedAttributes.filter(attr => attr !== 'target')
  );

  useEffect(() => {
    const filteredAttributes = selectedAttributes.filter(attr => attr !== 'target');
    console.log("attributeOrder prop:", selectedAttributes);
    setOrderedAttributes(filteredAttributes);  
  }, [selectedAttributes]);

  useEffect(() => {
    if (headersRendered) {
      headersRendered();
    }
  }, []);  

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData('draggedIndex', index);  
  };

  const handleDrop = (e, dropIndex) => {
    const draggedIndex = e.dataTransfer.getData('draggedIndex');
    if (draggedIndex === '') return;

    if (draggedIndex === dropIndex) return;

    const updatedOrder = [...orderedAttributes];
    const [movedAttribute] = updatedOrder.splice(draggedIndex, 1);  
    updatedOrder.splice(dropIndex, 0, movedAttribute);  

    setOrderedAttributes(updatedOrder);
    onReorder(updatedOrder);  
  };

  const handleDragOver = (e) => {
    e.preventDefault();  
  };

  return orderedAttributes.length > 0 ? (
    <div className={`filter-header-container ${isCompactLayout ? 'compact-layout' : ''}`}> 
      <div className={`filter-header ${isCompactLayout ? 'compact-header' : ''}`}> 
        {orderedAttributes.map((attribute, index) => (
          <div
            key={attribute}
            className={`filter-header-cell ${isCompactLayout ? 'compact-cell' : ''}`} 
            draggable  
            onDragStart={(e) => handleDragStart(e, index)}  
            onDrop={(e) => handleDrop(e, index)}  
            onDragOver={handleDragOver}  
          >
            <label className={isCompactLayout ? 'compact-label' : ''}> 
              <input
                type="checkbox"
                checked={selectedAttributes.includes(attribute)}
                onChange={() => onAttributeChange(attribute)}
                className={isCompactLayout ? 'compact-checkbox' : ''} 
              />
              {attribute}
            </label>
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div>Loading...</div>
  );
};

export default FilterableHeader;






        

import React, { useEffect, useRef } from 'react';
import './CheckboxDropdown.css';

const CheckboxDropdown = ({ attribute, options = [], selectedValues = [], onChange, isOpen, toggleDropdown }) => {
  const dropdownRef = useRef(null);

  const handleCheckboxChange = (option) => {
    const newValues = selectedValues.includes(option)
      ? selectedValues.filter((value) => value !== option) 
      : [...selectedValues, option]; 
    onChange(attribute, newValues);
  };

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        toggleDropdown(false); 
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen, toggleDropdown]);

  return (
    <div className="checkbox-dropdown" ref={dropdownRef}>
      {isOpen && (
        <div className="dropdown-menu">
          {options.map((option, index) => (
            <div key={index} className="dropdown-item">
              <input
                type="checkbox"
                checked={selectedValues.includes(option)}
                onChange={() => handleCheckboxChange(option)}
                aria-labelledby={`checkbox-${attribute}-${index}`}
              />
              <label id={`checkbox-${attribute}-${index}`} className="dropdown-label">
                {option}
              </label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CheckboxDropdown;
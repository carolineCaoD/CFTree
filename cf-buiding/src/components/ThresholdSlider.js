import React from "react";
import ReactSlider from "react-slider"; 
import "./ThresholdSlider.css"; 

const ThresholdSlider = ({
  thresholds,
  clusteringThreshold,
  descriptionThreshold,
  handleThresholdChange,
  handleDescriptionThresholdChange,
  clusterLegend,
  selectedClusterId,
  handleClusterClick,
  handleShowAllGroups,
  getClusterColor,
  tooltip,
  isCompactLayout 
}) => {
  return (
    <div className={`slider-container-wrapper ${isCompactLayout ? 'compact-layout' : ''}`}>

      
      <div className={`slider-container ${isCompactLayout ? 'compact-slider-container' : ''}`}> 
        <label className={isCompactLayout ? 'compact-label' : ''}>Counterfactual Groups: </label> 
        <div
          className="slider-labels"
          style={{ display: "flex", justifyContent: "space-between", width: "100%" }}
        >
          <span className={isCompactLayout ? 'compact-label' : ''}>Fewer</span> 
          <ReactSlider
            id="threshold-slider"
            min={thresholds.min_threshold}
            max={thresholds.max_threshold}
            step={0.1}
            value={thresholds.max_threshold - (clusteringThreshold - thresholds.min_threshold)} 
            onChange={(val) =>
              handleThresholdChange(thresholds.max_threshold - (val - thresholds.min_threshold))
            }
            className={`styled-slider ${isCompactLayout ? 'compact-slider' : ''}`} 
            thumbClassName={`styled-thumb ${isCompactLayout ? 'compact-thumb' : ''}`} 
            trackClassName="styled-track"
          />
          <span className={isCompactLayout ? 'compact-label' : ''}>More</span> 
        </div>
      </div>

      
      <div className={`cluster-legend ${isCompactLayout ? 'compact-legend' : ''}`}> 
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h4 className={isCompactLayout ? 'compact-label' : ''}>Group Legend</h4> 
          <button onClick={handleShowAllGroups} className={`show-all-groups-button ${isCompactLayout ? 'compact-button' : ''}`}> 
            Show All Groups
          </button>
        </div>

        
        {tooltip.content && (
          <div
            className={`common-attributes-text ${isCompactLayout ? 'compact-label' : ''}`} 
            style={{
              color: "#555",
              marginBottom: "8px",
            }}
          >
            {tooltip.content}
          </div>
        )}

        {clusterLegend.length > 0 ? (
          <div className={`legend-container ${isCompactLayout ? 'compact-legend-container' : ''}`}> 
            {clusterLegend.map((cluster) => (
              <div
                key={cluster.cluster_id}
                onClick={() => handleClusterClick(cluster.cluster_id)}
                className={`legend-box ${selectedClusterId === cluster.cluster_id ? "active" : ""} ${isCompactLayout ? 'compact-legend-box' : ''}`} 
                style={{
                  backgroundColor: getClusterColor(cluster.cluster_id),
                  cursor: "pointer",
                }}
              >
                {cluster.cluster_id}
              </div>
            ))}
          </div>
        ) : (
          <p className={isCompactLayout ? 'compact-label' : ''}>No clusters available</p> 
        )}
      </div>

      
      <div className={`slider-container ${isCompactLayout ? 'compact-slider-container' : ''}`} style={{ textAlign: "center" }}> 
        <label className={isCompactLayout ? 'compact-label' : ''}>group's common attributes: </label> 
        <div
          className="slider-labels"
          style={{ display: "flex", justifyContent: "space-between", width: "100%" }}
        >
          <span className={isCompactLayout ? 'compact-label' : ''}>Stricter</span> 
          <ReactSlider
            id="description-threshold-slider"
            min={0}
            max={1}
            step={0.1}
            value={1 - descriptionThreshold}
            onChange={(val) => handleDescriptionThresholdChange(1 - val)}
            className={`styled-slider ${isCompactLayout ? 'compact-slider' : ''}`} 
            thumbClassName={`styled-thumb ${isCompactLayout ? 'compact-thumb' : ''}`} 
            trackClassName="styled-track"
          />
          <span className={isCompactLayout ? 'compact-label' : ''}>Looser</span> 
        </div>
      </div>
    </div>
  );
};

export default ThresholdSlider;
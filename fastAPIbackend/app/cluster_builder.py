import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import linkage,fcluster
from gower import gower_matrix
from .tree_builder import build_trees_for_all_attributes,process_data_for_tree_building,fix_missing_null_nodes

def getLinkageMatrix(data, ordinal_attributes=None):
    data_encoded = data.copy()
    original_values = {}
    if ordinal_attributes:
        for attr, order in ordinal_attributes.items():
            if attr in data_encoded.columns:
                original_values[attr] = data_encoded[attr].copy()
                data_encoded[attr] = data_encoded[attr].apply(lambda x: order.index(x) if x in order else np.nan)
    if data_encoded.isnull().values.any():
        print("Warning: Data contains NaN values. Filling with median/mode.")
        data_encoded = data_encoded.fillna(data_encoded.median(numeric_only=True)).fillna(data_encoded.mode().iloc[0])
    gower_dist = gower_matrix(data_encoded)
    if np.isnan(gower_dist).any():
        raise ValueError("Gower distance matrix contains NaN values. Check categorical encoding.")
    if not np.all(np.isfinite(gower_dist)):
        raise ValueError("Error: Gower distance matrix contains NaN or infinite values.")
    linkage_matrix = linkage(gower_dist, method="complete")
    return linkage_matrix

def computeThresholdRange(data,ordinal_attribute):
    linkage_matrix=getLinkageMatrix(data,ordinal_attribute)
    distances = linkage_matrix[:, 2]
    min_threshold = max(round(np.min(distances) * 0.9, 3), 0.001)
    max_threshold =round(np.max(distances), 3) 
    return {
        "min_threshold": min_threshold, 
        "max_threshold": max_threshold, 
        "default": round(np.median(distances), 3)
    }

def apply_threshold(threshold, description_threshold, custom_order, filtered_df, ordinal_attribute):
    original_df = filtered_df.copy()
    print("Columns before clustering:", filtered_df.columns)
    for col in filtered_df.columns:
        if col in ordinal_attribute:
            print(f"Original {col} values:", filtered_df[col].unique())
    linkage_matrix = getLinkageMatrix(filtered_df, ordinal_attribute)
    cluster_labels = fcluster(linkage_matrix, t=threshold, criterion='distance')
    clustered_data = original_df.copy()
    clustered_data['cluster'] = cluster_labels
    print("clustered_data before filtering", clustered_data)
    print("Education unique values after clustering:", 
          clustered_data["education"].unique() if "education" in clustered_data.columns else "No education column")
    process_result = process_data_for_tree_building(clustered_data, custom_order, description_threshold)
    filtered_data = process_result["data"]
    common_attributes_by_cluster = process_result["common_attributes_by_cluster"]
    print("filtered_data when apply_threshold", filtered_data)
    print("Common attributes by cluster:", common_attributes_by_cluster)
    trees = build_trees_for_all_attributes(filtered_data, custom_order)
    for tree in trees:
        fix_missing_null_nodes(tree)
    filtered_trees = [tree for tree in trees if tree['count'] > 0]
    tree_data = {
        'attribute': 'Root',
        'indices': [],
        'children': filtered_trees
    }
    return clustered_data, tree_data, common_attributes_by_cluster
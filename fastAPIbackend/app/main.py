import pandas as pd
from fastapi import FastAPI,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
from .tree_builder import build_trees_for_all_attributes,build_tree_for_attribute, filter_counterfactuals_by_common_attributes,fix_missing_null_nodes, get_common_attributes
from pathlib import Path
from .cluster_builder import computeThresholdRange, getLinkageMatrix, apply_threshold
import json

DATASETS = {
    "income": {
        "df_cfs": "data/dice_exp_income.pkl",
        "columns_to_drop": ["income", "Original_Index"],
        "ordinal_attributes": {
            "education": ["School", "HS-grad", "Some-college", "Bachelors", "Masters", "Doctorate"]
        },
        "target_column_name": "income",
    },
    "heart": {
        "df_cfs": "data/dice_exp_heart.pkl",
        "columns_to_drop": ["target", "Original_Index"],
        "ordinal_attributes": {
            "cp": ["Typical angina", "Atypical angina", "Non-anginal pain", "Asymptomatic"],
            "restecg": ["Normal", "ST-T wave abnormality", "Left ventricular hypertrophy"],
            "thal": ["Normal", "Fixed defect", "Reversible defect"],
            "slope": ["Upsloping", "Flat", "Downsloping"],
            "ca": ["0", "1", "2", "3"]
        },
        "target_column_name": "target",
    },
    "LIDC": {
        "df_cfs": "data/dice_exp_LIDC.pkl",
        "columns_to_drop": ["Spiculation", "Original_Index"],
        "ordinal_attributes": {
        },
        "target_column_name": "Spiculation",
    },
    "linguistic": {
        "df_cfs": "data/dice_exp_Linguistic.pkl",
        "columns_to_drop": ["Token", "Original_Index"],
        "ordinal_attributes": {
        },
        "target_column_name": "Token",
    }
}

app = FastAPI()

class SelectedIndicesPayload(BaseModel):
    selectedIndices: List[int]
    attributeOrder: List[str]
    databaseKey: str

global difference_df
global selected_indices_global, current_dataset_key

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/process-selected-indices")
async def process_selected_indices(payload: SelectedIndicesPayload):
    global difference_df, selected_indices_global, current_dataset_key
    print(f"Received payload: {payload}")
    selected_indices = payload.selectedIndices
    attribute_order = payload.attributeOrder
    database_key = payload.databaseKey  
    current_dataset_key = database_key

    print(f"Processing dataset for: {database_key}")

    if database_key not in DATASETS:
        raise HTTPException(status_code=400, detail=f"Dataset '{database_key}' not found!")

    dataset_settings = DATASETS[database_key]
    columns_to_drop = dataset_settings["columns_to_drop"]
    ordinal_attribute = dataset_settings["ordinal_attributes"]
    target_column_name = dataset_settings["target_column_name"]
    selected_indices_global = selected_indices  

    try:
        df_pickle_dice_path=DATASETS[database_key]["df_cfs"]
        
        counterfactuals = load_dataframe_from_pickle(df_pickle_dice_path)
        if counterfactuals is None:
            raise HTTPException(status_code=500, detail=f"Failed to load counterfactuals from {df_pickle_dice_path}")
        
        valid_range = len(counterfactuals.cf_examples_list)
        valid_indices = [idx for idx in selected_indices if 0 <= idx < valid_range]
        
        if not valid_indices:
            raise HTTPException(status_code=400, detail=f"No valid indices provided. Valid range is 0 to {valid_range-1}.")
        
        print(f"Found {len(valid_indices)} valid indices out of {len(selected_indices)} provided.")
        
        selected_indices_global = valid_indices
        
        difference_df = compute_differences(df_pickle_dice_path, valid_indices, target_column_name)

        if difference_df is None or difference_df.empty:
            raise HTTPException(status_code=404, detail="No valid counterfactuals found for the selected indices.")

        filtered_df=difference_df.copy(deep=True)

        filtered_df = filtered_df.drop(columns=[col for col in columns_to_drop if col in filtered_df.columns], errors="ignore")
        filtered_df.to_json("final_difference_df.json", orient="records", indent=2)
        cfRowData_json = filtered_df.to_dict(orient="records")

        requested_attributes = [attr for attr in attribute_order if attr in filtered_df.columns]
        if not requested_attributes:
            available_attributes = filtered_df.columns.tolist()
            raise HTTPException(
                status_code=400, 
                detail=f"None of the requested attributes {attribute_order} found in the data. Available attributes: {available_attributes}"
            )
        
        if len(requested_attributes) < len(attribute_order):
            missing_attributes = [attr for attr in attribute_order if attr not in filtered_df.columns]
            print(f"Warning: Some requested attributes are not in the dataset: {missing_attributes}")
            print(f"Continuing with available attributes: {requested_attributes}")
            attribute_order = requested_attributes

        with open("last_cfRowData.json", "w") as f:
            json.dump(cfRowData_json, f, indent=2)

        threshold_values = computeThresholdRange(filtered_df, ordinal_attribute)

        try:
            tree_data = buildTreeandFixMissing(difference_df, attribute_order)
            with open("last_tree_data.json", "w") as f:
                json.dump(tree_data, f, indent=2)
            print("Tree data saved to last_tree_data.json")
        except Exception as tree_error:
            print(f"Error building tree: {tree_error}")
            tree_data = {
                'attribute': 'Root',
                'indices': [],
                'children': [],
                'error': str(tree_error)
            }

        metadata = {
            "total_indices_requested": len(selected_indices),
            "valid_indices_found": len(valid_indices),
            "counterfactuals_found": len(difference_df) if difference_df is not None else 0,
            "attributes_requested": attribute_order,
            "dataset": database_key
        }

        return {
            "message": "Differences computed successfully", 
            "tree": tree_data, 
            "cfRowData": cfRowData_json,
            "thresholds": threshold_values,
            "metadata": metadata
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing selected indices: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing selected indices: {e}")

def load_dataframe_from_pickle(pickle_path):
    try:
        df = pd.read_pickle(pickle_path)
        print(f"DataFrame loaded successfully from {pickle_path}.")
        return df
    except Exception as e:
        print(f"Error loading DataFrame from pickle: {e}")
        return None

    
def compute_differences(pickle_path, selectedIndices=None, target_column_name=None,column_order=None):
    counterfactuals = load_dataframe_from_pickle(pickle_path)

    if counterfactuals is None:
        print("Failed to load counterfactuals. Exiting.")
        return None

    try:
        if not selectedIndices:
            selectedIndices = list(range(len(counterfactuals.cf_examples_list)))
            print(f"No selected indices provided. Defaulting to all indices: {selectedIndices}")
        
        valid_range = len(counterfactuals.cf_examples_list)
        valid_indices = [idx for idx in selectedIndices if 0 <= idx < valid_range]
        if len(valid_indices) < len(selectedIndices):
            print(f"Warning: {len(selectedIndices) - len(valid_indices)} indices were out of range. Valid range is 0 to {valid_range-1}.")
            print(f"Proceeding with {len(valid_indices)} valid indices.")
        
        if not valid_indices:
            print("No valid indices to process. Returning empty DataFrame.")
            return pd.DataFrame()
            
        difference_dfs = []

        for idx in valid_indices:
            try:
                cf_example = counterfactuals.cf_examples_list[idx]
            except IndexError:
                print(f"Index {idx} is out of range. Skipping.")
                continue

            row_key = f"{idx}"

            original_instance = cf_example.test_instance_df

            cf_df = cf_example.final_cfs_df

            if cf_df is not None and not cf_df.empty:
                if column_order:
                    cf_df = cf_df[column_order]

                differences = cf_df.copy()

                for col in cf_df.columns:
                    if col in original_instance.columns:
                        if pd.api.types.is_numeric_dtype(original_instance[col]):
                            original_val = original_instance.iloc[0][col]
                            is_different = ~np.isclose(cf_df[col], original_val, rtol=1e-05, atol=1e-08, equal_nan=True)
                            differences[col] = cf_df[col].where(is_different, 0)
                        else:
                            differences[col] = cf_df[col].where(cf_df[col] != original_instance.iloc[0][col], 0)
                    else:
                        differences[col] = 0

                differences["Original_Index"] = row_key
                
                difference_dfs.append(differences)

        if difference_dfs:
            difference_df = pd.concat(difference_dfs, ignore_index=True)

            if target_column_name in difference_df.columns:
                original_target = original_instance.iloc[0][target_column_name]
                difference_df = difference_df[difference_df[target_column_name] != original_target]
                
                if difference_df.empty:
                    print("No counterfactuals found with different target values.")
                    return pd.DataFrame()

            difference_df = difference_df.reset_index(drop=True)
            
            print(f"Difference DataFrame computed successfully with {len(difference_df)} rows.")
            return difference_df
        
        else:
            print("No differences computed. Returning an empty DataFrame.")
            return pd.DataFrame()

    except Exception as e:
        print(f"Error processing counterfactuals: {e}")
        return None

class ReorderRequest(BaseModel):
    reorderedAttributes: List[str]

def load_tree_data():
    tree_file_path = Path("./data/treeResult.js")
    with tree_file_path.open() as f:
        tree_content = f.read().replace('export default ', '')
        tree_data = json.loads(tree_content)
    return tree_data

def buildTreeandFixMissing(difference_df,attributes):
    trees = build_trees_for_all_attributes(difference_df,attributes )
    for tree in trees:
        fix_missing_null_nodes(tree)
    
    filtered_trees = [tree for tree in trees if tree['count'] > 0]

    tree_data = {
        'attribute': 'Root',
        'indices': [],
        'children': filtered_trees
    }
    return tree_data


@app.post("/api/reorder-attributes")
async def reorder_attributes(request: ReorderRequest):
    global difference_df
    reordered_attributes = request.reorderedAttributes
    print(reordered_attributes)

    trees = build_trees_for_all_attributes(difference_df, reordered_attributes)
    for tree in trees:
        fix_missing_null_nodes(tree)
    
    filtered_trees = [tree for tree in trees if tree['count'] > 0]

    tree_data = {
        'attribute': 'Root',
        'indices': [],
        'children': filtered_trees
    }
    return tree_data

@app.post("/api/update-thresholds")
async def update_threshold(payload: dict):
    global selected_indices_global, current_dataset_key
    print(f"Received payload: {payload}")
    threshold = payload.get("threshold")
    description_threshold = payload.get("descriptionThreshold") 
    custom_order = payload.get("attributeOrder")
    
    if not threshold or not custom_order:
        raise HTTPException(status_code=400, detail="Missing required parameters")
    if difference_df is None:
        raise HTTPException(status_code=500, detail="Difference data is not initialized.")
    if not selected_indices_global:
        print("ERROR: No selected indices available. Ensure process-selected-indices is called first!")
        raise HTTPException(status_code=400, detail="No selected indices available.")
    
    filtered_df=difference_df.iloc[selected_indices_global].copy()
    print(f"Filtered difference_df: {filtered_df.shape}")

    if current_dataset_key not in DATASETS:
        raise HTTPException(status_code=400, detail=f"Dataset '{current_dataset_key}' not found!")
    
    dataset_settings = DATASETS[current_dataset_key]
    ordinal_attribute = dataset_settings["ordinal_attributes"]

    clustered_data, tree_data, common_attributes_by_cluster = apply_threshold(threshold, description_threshold, custom_order, filtered_df, ordinal_attribute)
    
    cf_row_data = clustered_data.copy()
    
    print("Column types:", cf_row_data.dtypes)
    print("Education sample values:", cf_row_data["education"].head() if "education" in cf_row_data.columns else "No education column")
    
    for column in cf_row_data.select_dtypes(include=['float64']).columns:
        cf_row_data[column] = cf_row_data[column].replace([float('inf'), float('-inf')], [1e30, -1e30])
    
    cf_row_data_json = json.loads(cf_row_data.to_json(orient="records"))
    
    with open("last_cfRowData.json", "w") as f:
        json.dump(cf_row_data_json, f, indent=2)
    
    cluster_legend = []
    for cluster_id in clustered_data["cluster"].unique():
        cluster_id_str = str(cluster_id)
        common_attributes = common_attributes_by_cluster.get(cluster_id_str, [])
        
        cluster_df = clustered_data[clustered_data["cluster"] == cluster_id]
        
        filtered_cluster_data = filter_counterfactuals_by_common_attributes(cluster_df, common_attributes)
        cluster_trees = build_trees_for_all_attributes(filtered_cluster_data, custom_order)
        for tree in cluster_trees:
            fix_missing_null_nodes(tree)
    
        filtered_trees = [tree for tree in cluster_trees if tree['count'] > 0]

        cluster_tree_data = {
            'attribute': 'Root',
            'indices': [],
            'children': filtered_trees
        }
        cluster_legend.append({
            "cluster_id": int(cluster_id),
            "common_attributes": common_attributes,
            "tree": cluster_tree_data
        })

    return {
        "tree": tree_data,
        "clusterLegend": cluster_legend,
        "cfRowData": cf_row_data_json,
        "commonAttributesByCluster": common_attributes_by_cluster
    }

class FilterAttributesRequest(BaseModel):
    selectedAttributes: List[str]
    datasetKey: str

@app.post("/api/filter-attributes")
async def filter_attributes(request: FilterAttributesRequest):
    global difference_df, current_dataset_key
    
    selected_attributes = request.selectedAttributes
    dataset_key = request.datasetKey
    
    print(f"Filtering attributes for dataset {dataset_key}: {selected_attributes}")
    
    if not selected_attributes:
        raise HTTPException(status_code=400, detail="No attributes selected")
    
    if difference_df is None:
        raise HTTPException(status_code=500, detail="Difference data is not initialized. Please process selected indices first.")
    
    if dataset_key != current_dataset_key:
        raise HTTPException(status_code=400, detail=f"Dataset mismatch. Current: {current_dataset_key}, Requested: {dataset_key}")
    
    available_attributes = difference_df.columns.tolist()
    requested_attributes = [attr for attr in selected_attributes if attr in available_attributes]
    
    if not requested_attributes:
        raise HTTPException(
            status_code=400, 
            detail=f"None of the requested attributes exist in the data. Available attributes: {available_attributes}"
        )
    
    if len(requested_attributes) < len(selected_attributes):
        missing_attributes = [attr for attr in selected_attributes if attr not in available_attributes]
        print(f"Warning: Some requested attributes are not in the dataset: {missing_attributes}")
        print(f"Continuing with available attributes: {requested_attributes}")
    
    try:
        tree_data = buildTreeandFixMissing(difference_df, requested_attributes)
        
        with open("filtered_tree_data.json", "w") as f:
            json.dump(tree_data, f, indent=2)
        
        try:
            with open("last_cfRowData.json", "r") as f:
                cfRowData_json = json.load(f)
            print(f"Successfully loaded cfRowData from file with {len(cfRowData_json)} entries")
        except Exception as e:
            print(f"Error loading cfRowData from file: {e}")
            if dataset_key in DATASETS:
                dataset_settings = DATASETS[dataset_key]
                columns_to_drop = dataset_settings["columns_to_drop"]
                
                filtered_df = difference_df.copy(deep=True)
                filtered_df = filtered_df.drop(columns=[col for col in columns_to_drop if col in filtered_df.columns], errors="ignore")
                cfRowData_json = filtered_df.to_dict(orient="records")
                print(f"Created cfRowData from difference_df with {len(cfRowData_json)} entries")
        
        return {
            "tree": tree_data,
            "cfRowData": cfRowData_json
        }
    
    except Exception as e:
        print(f"Error building filtered tree: {e}")
        raise HTTPException(status_code=500, detail=f"Error building filtered tree: {str(e)}")

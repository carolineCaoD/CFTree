import pandas as pd

global difference_df

def build_tree(df, attributes, level=0, parent_indices=None):
    if level >= len(attributes):
        return []

    print("DataFrame columns:", df.columns)
    current_attribute = attributes[level]

    tree = []

    grouped = {}
   
    for index, row in df.iterrows():
        combination = row['Combination']
        if level < len(combination):
            attribute_value = combination[level]
        else:
            attribute_value = 'null'
        
        if attribute_value not in grouped:
            grouped[attribute_value] = []
        grouped[attribute_value].append(row)

    for attribute_value, group_rows in grouped.items():
        group_df = pd.DataFrame(group_rows)
        count = int(group_df['Count'].sum())

        if count == 0:
            continue

        indices = sorted(set(i for sublist in group_df['Indices'] for i in sublist))

        node = {
            'attribute': attribute_value if attribute_value is not None else 'null',
            'count': count,
            'indices': indices,
            'children': build_tree(group_df, attributes, level + 1, indices)
        }

        if not (attribute_value == 'null' and parent_indices == indices):
            tree.append(node)

    return tree

def reorder_tree(node, order):
    if "children" in node:
        node["children"].sort(key=lambda child: order.index(child["attribute"]) if child["attribute"] in order else len(order))
        
        for child in node["children"]:
            reorder_tree(child, order)

def get_common_attributes(cluster_data, desciptionThreshold=0.7):
    feature_columns = [col for col in cluster_data.columns if col not in ['income', 'Original_Index', 'cluster']]
    num_instances = len(cluster_data)
    if num_instances == 0:
        return set()  

    non_zero_counts = (cluster_data[feature_columns] != 0).sum()
    print("non_zero_counts",non_zero_counts)

    attribute_ratios = non_zero_counts / num_instances
    print("attribute_ratios",attribute_ratios)

    common_attributes = set(attribute_ratios[attribute_ratios >= desciptionThreshold].index)

    return common_attributes

def filter_counterfactuals_by_common_attributes(cluster_data, common_attributes):
    print(f"Common attributes: {common_attributes}")
    print(f"Initial cluster_data shape: {cluster_data.shape}")
    
    if not common_attributes:
        print("Warning: No common attributes found. Returning empty DataFrame.")
        return pd.DataFrame(columns=cluster_data.columns)
    
    for attr in common_attributes:
        print(f"{attr} unique values:", cluster_data[attr].unique())
        
    print("cluster_data indices BEFORE filtering:", cluster_data.index.tolist())
    
    mask_common = (cluster_data[common_attributes] != 0).any(axis=1)
    
    # print("Number of CFs with ANY non-zero:", (cluster_data[common_attributes] != 0).any(axis=1).sum())
    # print("Number of CFs with ALL non-zero:", (cluster_data[common_attributes] != 0).all(axis=1).sum())
    
    filtered_data = cluster_data.loc[mask_common]
    
    if filtered_data.empty:
        print("No counterfactuals passed the filter. Returning empty DataFrame.")
        return filtered_data
        
    print(f"Filtered data shape: {filtered_data.shape}")
    print("filtered_data indices AFTER filtering:", filtered_data.index.tolist())
    
    return filtered_data

def process_data_for_tree_building(data, custom_order, descriptionThreshold=0.7):

    filtered_clusters = []
    common_attributes_by_cluster = {}
    
    for cluster_id in data["cluster"].unique():
        cluster_df = data[data["cluster"] == cluster_id]
        raw_common_attributes = get_common_attributes(cluster_df, descriptionThreshold)
        common_attributes = [attr for attr in raw_common_attributes if attr in custom_order]
        
        common_attributes_by_cluster[str(cluster_id)] = common_attributes
        
        print(f"Cluster {cluster_id}: {len(common_attributes)} common attributes identified with threshold {descriptionThreshold}")
        print(f"Common attributes: {common_attributes}")
        cluster_filtered = filter_counterfactuals_by_common_attributes(cluster_df, common_attributes)
        filtered_clusters.append(cluster_filtered)
    
    if not filtered_clusters:
        print("No clusters passed filtering. Returning empty DataFrame.")
        return {"data": pd.DataFrame(columns=data.columns), "common_attributes_by_cluster": common_attributes_by_cluster}
        
    final_filtered = pd.concat(filtered_clusters, ignore_index=False)
    print(f"Common attributes processed per cluster. Final filtered shape: {final_filtered.shape}")
    
    
    return {
        "data": final_filtered,
        "common_attributes_by_cluster": common_attributes_by_cluster
    }

def build_trees_for_all_attributes(data, custom_order):
    trees = []
    print("Columns before selecting in build_trees_for_all_attributes:", data.columns)
    
    if 'Original_Index' not in data.columns:
        print("Warning: 'Original_Index' column not found in data")
        return []
    
    remaining_data = data[custom_order + ['Original_Index']]
    print("remaining_data len", len(remaining_data))
    
    for attribute in custom_order:
        print("custom_order", custom_order)
        
        attribute_rows = remaining_data[remaining_data[attribute] != 0]
        
       
        indices = []
        original_indices = []
        
        
        for idx, row in attribute_rows.iterrows():
            indices.append(idx)
            original_indices.append(str(row["Original_Index"]))  # Ensure these are strings
            print(f"Row {idx}: {row[attribute]} (Original Index: {row['Original_Index']})")
        
        print(f"Attribute {attribute}: {len(indices)} rows with non-zero values")
        
        
        tree_node = {
            'attribute': attribute,
            'count': len(attribute_rows),
            'indices': indices,
            'original_indices': original_indices,
            'children': build_tree_for_attribute(
                attribute_rows[custom_order].values.tolist(), 
                custom_order,
                attribute,
                level=0,  
                indices=indices,
                original_indices=original_indices
            )
        }
        trees.append(tree_node)
       
        remaining_data = remaining_data[remaining_data[attribute] == 0]
    
    return trees


def build_tree_for_attribute(rows, custom_order, root_attribute,level=0, indices=None, original_indices=None):
    if not rows or level >= len(custom_order):
        return []

    attribute_name = custom_order[level]
    
    
    if attribute_name == root_attribute:
        return build_tree_for_attribute(rows, custom_order, root_attribute, level + 1, indices, original_indices)
    
    
    tree = []
    has_attribute = []
    no_attribute = []
    has_attribute_indices = []
    no_attribute_indices = []
    has_attribute_original_indices, no_attribute_original_indices = [], []
    
    for i, row in enumerate(rows):
        if row[level] != 0:
            has_attribute.append(row)
            has_attribute_indices.append(indices[i])
            has_attribute_original_indices.append(original_indices[i])

        else:
            no_attribute.append(row)
            no_attribute_indices.append(indices[i])
            no_attribute_original_indices.append(original_indices[i])
    
    
    if has_attribute:
        node = {
            'attribute': attribute_name ,
            'count': len(has_attribute),
            'indices': has_attribute_indices,
            'original_indices': has_attribute_original_indices,
            'children': build_tree_for_attribute(has_attribute, custom_order, root_attribute,level + 1, has_attribute_indices,has_attribute_original_indices)
        }
        tree.append(node)
    
    if no_attribute:
        children = build_tree_for_attribute(no_attribute, custom_order, root_attribute, level + 1, no_attribute_indices,no_attribute_original_indices)

        tree.extend(children)
    return tree
def fix_missing_null_nodes(node):
    if not node.get('children'):
        return
    
    
    child_indices = set()
    for child in node['children']:
        child_indices.update(child['indices'])
    
    
    missing_indices = set(node['indices']) - child_indices
    missing_original_indices = [
        idx for idx in node['original_indices']
        if idx not in [child['original_indices'] for child in node['children']]
    ]
    
    if missing_indices:
        
        null_node = {
            'attribute': 'null',
            'count': len(missing_indices),
            'indices': sorted(missing_indices),
            'original_indices': missing_original_indices,
            'children': []
        }

        node['children'].append(null_node)

    for child in node['children']:
        fix_missing_null_nodes(child)
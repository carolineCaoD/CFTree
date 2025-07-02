import json
def build_tree(df, attributes, level=0,parent_indices=None):
    if level >= len(attributes):
        return []

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



desired_order = ['education', 'hours_per_week', 'age', 'occupation', 'workclass', 
                 'marital_status', 'gender', 'race']

tree= build_tree(combination_df, desired_order)

tree_data = {
    'attribute': 'Root',
    'indices': [],
    'children': tree
}


json_file_path = './tree_data25.json'
with open(json_file_path, 'w') as json_file:
    json.dump(tree_data, json_file, indent=2)

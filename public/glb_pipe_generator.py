#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Oct 13 14:31:05 2024

@author: jonjones
"""

import pandas as pd
import trimesh
import numpy as np
from scipy.spatial.transform import Rotation as R

# Function to create a cylindrical mesh
def create_pipe(start, end, pipe_diameter, pipe_thickness):
    # Calculate the length of the pipe
    length = np.linalg.norm(np.array(end) - np.array(start))
    radius_outer = pipe_diameter / 2
    radius_inner = radius_outer - pipe_thickness

    # Create the outer cylinder
    outer_cylinder = trimesh.creation.cylinder(radius_outer, length, sections=64)

    # Create the inner cylinder (to subtract from outer to create the hollow pipe)
    inner_cylinder = trimesh.creation.cylinder(radius_inner, length, sections=64)

    # Translate the cylinders to start at (0, 0, 0) and extend along the z-axis
    outer_cylinder.apply_translation([0, 0, length / 2])
    inner_cylinder.apply_translation([0, 0, length / 2])

    # Subtract inner cylinder from outer cylinder to get a hollow pipe
    pipe = outer_cylinder.difference(inner_cylinder)

    # Translate pipe to the correct position
    translation_vector = np.array(start)

    # Calculate the direction and rotation to align the pipe with the start and end points
    direction = np.array(end) - np.array(start)
    direction_norm = np.linalg.norm(direction)

    if direction_norm == 0:
        raise ValueError("Start and end points must be different.")
    
    direction = direction / direction_norm  # Normalize direction
    z_axis = np.array([0, 0, 1])
    
    # Calculate rotation axis and angle
    rotation_axis = np.cross(z_axis, direction)

    # Initialize a 4x4 transformation matrix
    transform_matrix = np.eye(4)

    # Only apply rotation if there's a valid axis
    if np.linalg.norm(rotation_axis) != 0:
        rotation_axis = rotation_axis / np.linalg.norm(rotation_axis)
        angle = np.arccos(np.clip(np.dot(z_axis, direction), -1.0, 1.0))
        rotation_matrix = R.from_rotvec(angle * rotation_axis).as_matrix()
        
        # Assign rotation to the upper left 3x3 part of the transformation matrix
        transform_matrix[:3, :3] = rotation_matrix

    # Set translation in the last column of the transformation matrix
    transform_matrix[:3, 3] = translation_vector

    # Apply the transformation matrix to the pipe
    pipe.apply_transform(transform_matrix)

    return pipe

# Function to create pipes from CSV data
def create_pipes_from_csv(file_path):
    # Load the CSV file
    df = pd.read_csv(file_path)
    pipes = []

    # Iterate through each row in the DataFrame
    for index, row in df.iterrows():
        start = [row['x1'], row['y1'], row['z1']]
        end = [row['x2'], row['y2'], row['z2']]
        diameter = row['diameter']
        # Define a thickness, you can change it based on your requirement
        thickness = 0.05  

        # Create the pipe mesh
        pipe = create_pipe(start, end, diameter, thickness)

        # Apply color if specified
        if 'color' in row:
            pipe.visual.vertex_colors = trimesh.visual.color.hex_to_rgba(row['color'])

        pipes.append(pipe)

    # Combine all pipes into one mesh
    return trimesh.util.concatenate(pipes)

# Load pipes from a CSV file
csv_file_path = '/Users/jonjones/Sites/VR Viewer/pipes.csv'  # Update with your CSV file path
pipe_mesh = create_pipes_from_csv(csv_file_path)

# Export the pipes to a GLB (GLTF) file
output_file_path = '/Users/jonjones/Sites/VR Viewer/pipes.glb'
pipe_mesh.export(output_file_path)

print(f"GLB file '{output_file_path}' has been created successfully.")

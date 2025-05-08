#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Sun Oct 13 14:31:05 2024

Updated on [Today's Date]

@original_author: jonjones
@update_author: ChatGPT
"""

import pandas as pd
import trimesh
import numpy as np
from scipy.spatial.transform import Rotation as R
import argparse
import os

# Function to create a cylindrical pipe mesh
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

# Function to create a cylindrical manhole mesh
def create_manhole(x, y, base_elevation, top_elevation, diameter):
    height = top_elevation - base_elevation
    if height <= 0:
        raise ValueError(f"Top elevation must be greater than base elevation for manhole at ({x}, {y}).")

    radius = diameter / 2

    # Create the cylinder representing the manhole
    manhole = trimesh.creation.cylinder(radius=radius, height=height, sections=64)

    # Translate the manhole to its correct position
    manhole.apply_translation([x, y, base_elevation + height / 2])

    return manhole

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
        if 'color' in row and not pd.isna(row['color']):
            try:
                pipe.visual.vertex_colors = trimesh.visual.color.hex_to_rgba(row['color'])
            except ValueError:
                print(f"Invalid color format '{row['color']}' for pipe at index {index}. Skipping color.")

        pipes.append(pipe)

    return pipes

# Function to create manholes from CSV data
def create_manholes_from_csv(file_path):
    # Load the CSV file
    df = pd.read_csv(file_path)
    manholes = []

    # Iterate through each row in the DataFrame
    for index, row in df.iterrows():
        try:
            x = row['x']
            y = row['y']
            diameter = row['diameter']
            base_elevation = row['base_elevation']
            top_elevation = row['top_elevation']

            # Create the manhole mesh
            manhole = create_manhole(x, y, base_elevation, top_elevation, diameter)

            # Optionally, apply color if specified
            if 'color' in row and not pd.isna(row['color']):
                try:
                    manhole.visual.vertex_colors = trimesh.visual.color.hex_to_rgba(row['color'])
                except ValueError:
                    print(f"Invalid color format '{row['color']}' for manhole ID {row['id']}. Skipping color.")

            manholes.append(manhole)
        except KeyError as e:
            print(f"Missing column {e} in manhole CSV at row {index}. Skipping this manhole.")
        except ValueError as ve:
            print(f"Value error for manhole ID {row.get('id', 'Unknown')}: {ve}. Skipping this manhole.")

    return manholes

def main(pipes_csv, manholes_csv, output_file):
    # Check if input files exist
    if not os.path.isfile(pipes_csv):
        print(f"Pipes CSV file '{pipes_csv}' does not exist.")
        return
    if not os.path.isfile(manholes_csv):
        print(f"Manholes CSV file '{manholes_csv}' does not exist.")
        return

    # Create pipe and manhole meshes
    pipe_meshes = create_pipes_from_csv(pipes_csv)
    manhole_meshes = create_manholes_from_csv(manholes_csv)

    # Combine all meshes
    all_meshes = pipe_meshes + manhole_meshes
    combined_mesh = trimesh.util.concatenate(all_meshes)

    # Export the combined mesh to a GLB (GLTF) file
    combined_mesh.export(output_file)

    print(f"GLB file '{output_file}' has been created successfully with {len(pipe_meshes)} pipes and {len(manhole_meshes)} manholes.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a 3D model from pipes and manholes CSV files.")
    parser.add_argument('--pipes', type=str, default='pipes.csv', help="Path to the pipes CSV file.")
    parser.add_argument('--manholes', type=str, default='manholes.csv', help="Path to the manholes CSV file.")
    parser.add_argument('--output', type=str, default='output.glb', help="Path for the output GLB file.")

    args = parser.parse_args()

    main(args.pipes, args.manholes, args.output)


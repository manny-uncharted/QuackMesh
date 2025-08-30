from typing import List
import numpy as np

def fedavg(weight_sets: List[List[List[float]]]) -> List[List[float]]:
    """
    Average a list of model weight sets.
    Each weight set is a list of tensors, represented as lists of floats.
    Returns a single weight set of the same shape.
    """
    if not weight_sets:
        raise ValueError("No weight sets provided")

    num_clients = len(weight_sets)
    # Assume all have same shapes
    averaged: List[List[float]] = []
    for layer_idx in range(len(weight_sets[0])):
        layer_arrays = [np.array(ws[layer_idx], dtype=np.float32) for ws in weight_sets]
        layer_avg = np.mean(layer_arrays, axis=0)
        averaged.append(layer_avg.tolist())
    return averaged

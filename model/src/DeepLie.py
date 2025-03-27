import os
import numpy as np
import cv2
from keras.models import model_from_json
from keras.layers import Flatten
from keras.models import Model

# Define the project path in Google Drive
project_path = '/content/drive/MyDrive/FIT3162/deep-lie/'

# Load the FER2013 model
with open(os.path.join(project_path, "fer.json"), "r") as json_file:
    fer_model_json = json_file.read()
fer_model = model_from_json(fer_model_json)
fer_model.load_weights(os.path.join(project_path, "fer.weights.h5"))

# Create a feature extractor up to the Flatten layer
flatten_layer = None
for layer in fer_model.layers:
    if isinstance(layer, Flatten):
        flatten_layer = layer
        break
if flatten_layer is None:
    raise ValueError("No Flatten layer found in the FER2013 model.")
feature_extractor = Model(inputs=fer_model.input, outputs=flatten_layer.output)
print("FER2013 feature extractor loaded.")

# Load the embedding model
with open(os.path.join(project_path, "embedding_model.json"), "r") as json_file:
    embedding_model_json = json_file.read()
embedding_model = model_from_json(embedding_model_json)
embedding_model.load_weights(os.path.join(project_path, "embedding_model.weights.h5"))
print("Embedding model loaded.")

# Load the database
average_truth_emb = np.load(os.path.join(project_path, "average_truth_emb.npy"))
average_lie_emb = np.load(os.path.join(project_path, "average_lie_emb.npy"))
database = {'truth': average_truth_emb, 'lie': average_lie_emb}
print("Database loaded.")

# Load normalization parameters (mean and std from FER2013 training data)
# Note: These should have been saved during preprocessing; if not available, compute from training data
mean_x = np.load(os.path.join(project_path, "mean_x.npy"))
std_x = np.load(os.path.join(project_path, "std_x.npy"))
print("Normalization parameters loaded.")

# Function to predict from raw video frames
def predict_from_frames(frames, feature_extractor, embedding_model, database, mean_x, std_x):
    """
    Predicts whether a video (sequence of frames) is truth or lie.

    Args:
        frames: List of 300 raw frames (images, can be color or grayscale).
        feature_extractor: FER2013 model truncated at Flatten layer.
        embedding_model: Trained Siamese embedding model.
        database: Dictionary with 'truth' and 'lie' average embeddings.
        mean_x: Mean used for normalizing FER2013 training data (shape: (48, 48, 1)).
        std_x: Std used for normalizing FER2013 training data (shape: (48, 48, 1)).

    Returns:
        int: 1 (truth) or 0 (lie).
    """
    feature_sequence = []
    for frame in frames:
        # Convert to grayscale if color
        if len(frame.shape) == 3:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        # Resize to 48x48
        frame = cv2.resize(frame, (48, 48))
        # Normalize using the same mean and std as training data
        frame = frame.astype('float32')
        frame = (frame - mean_x.squeeze()) / std_x.squeeze()  # Remove channel dim if present
        # Add dimensions for model input: (1, 48, 48, 1)
        frame = np.expand_dims(frame, axis=-1)  # Add channel
        frame = np.expand_dims(frame, axis=0)   # Add batch
        # Extract features
        features = feature_extractor.predict(frame, verbose=0)
        feature_sequence.append(features[0])  # Shape: (4608,)

    # Stack features into (1, 300, 4608)
    feature_sequence = np.array(feature_sequence)  # Shape: (300, 4608)
    feature_sequence = np.expand_dims(feature_sequence, axis=0)  # Shape: (1, 300, 4608)

    # Compute embedding
    embedding = embedding_model.predict(feature_sequence, verbose=0)  # Shape: (1, 64)

    # Verify against database
    prediction = verify(embedding[0], database)
    return prediction

# Verification function
def verify(emb, database):
    """
    Compares the embedding to database embeddings to classify as truth or lie.

    Args:
        emb: Embedding vector (shape: (64,)).
        database: Dictionary with 'truth' and 'lie' embeddings.

    Returns:
        int: 1 (truth) or 0 (lie).
    """
    dist_truth = np.linalg.norm(emb - database["truth"])
    dist_lie = np.linalg.norm(emb - database["lie"])
    return 1 if dist_truth < dist_lie else 0

# Example usage (assuming a function to load video frames)
def load_video_frames(video_path):
    """
    Dummy function to load 300 frames from a video.
    Replace with actual video loading logic (e.g., using OpenCV).
    """
    cap = cv2.VideoCapture(video_path)
    frames = []
    while len(frames) < 300 and cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()
    # Pad or truncate to exactly 300 frames
    if len(frames) < 300:
        frames.extend([frames[-1]] * (300 - len(frames)))
    elif len(frames) > 300:
        frames = frames[:300]
    return frames

# Predict on a sample video
video_path = "/path/to/your/video.mp4"  # Replace with actual path
frames = load_video_frames(video_path)
prediction = predict_from_frames(frames, feature_extractor, embedding_model, database, mean_x, std_x)
print("Prediction (1 = truth, 0 = lie):", prediction)
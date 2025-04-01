import tensorflow as tf
import cv2
import numpy as np
from tensorflow.keras.models import Model
from constants import MODEL_ROOT_PATH, NOTEBOOKS_PATH, DATA_PATH

# Load the models with custom_objects as shown in the notebook
custom_objects = {"categorical_crossentropy": tf.keras.losses.categorical_crossentropy}
fer_model_path = NOTEBOOKS_PATH + 'deeplie/content/fer2013/fer.keras'
fer_model = tf.keras.models.load_model(fer_model_path, custom_objects=custom_objects)

# Verify the model's structure
print("FER Model Summary:")
print(fer_model.summary())
layer_names = [layer.name for layer in fer_model.layers]
print("Layers in fer_model:", layer_names)

main_model_path = NOTEBOOKS_PATH + 'deeplie/content/deep-lie/project/gru_model/gru_model_(LOOCV)_64.0 (+- 48.0).keras'
main_model = tf.keras.models.load_model(main_model_path)

# Load mean and std for normalization (these should be saved during training)
mean_X = np.load(NOTEBOOKS_PATH + 'deeplie/content/fer2013/mean_X.npy')        # Shape: (48, 48, 1)
std_X = np.load(NOTEBOOKS_PATH + 'deeplie/content/fer2013/std_X.npy')          # Shape: (48, 48, 1)  


def extract_frames(video_path, num_frames=300):
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames < num_frames:
        raise ValueError(f"Video has fewer frames ({total_frames}) than required ({num_frames}).")
    step = total_frames // num_frames
    frames = []
    for i in range(num_frames):
        cap.set(cv2.CAP_PROP_POS_FRAMES, i * step)
        ret, frame = cap.read()
        if ret:
            frames.append(frame)
        else:
            raise ValueError(f"Error reading frame at position {i * step}.")
    cap.release()
    return frames

def predict(video_path, fer_model, main_model, mean_X, std_X, num_frames=300):
        
    # Extract frames
    frames = extract_frames(video_path, num_frames)

    # Preprocess frames
    frames = [cv2.cvtColor(cv2.resize(frame, (48, 48)), cv2.COLOR_BGR2GRAY) for frame in frames]
    frames = np.array(frames).astype('float32')

    # Expand dimensions to match mean_X and std_X shape
    frames = np.expand_dims(frames, axis=-1)  # Shape: (300, 48, 48, 1)

    # Normalize frames using raw data mean_X and std_X
    frames = (frames - mean_X) / (std_X + 1e-8)  # Shape: (300, 48, 48, 1)

    # Create intermediate model for feature extraction
    encoding_model = tf.keras.Model(inputs=fer_model.layers[0].input, outputs=fer_model.get_layer('flatten').output)
    
    # Extract features from all frames at once
    features = encoding_model.predict(frames)  # Shape: (300, 4608)

    # Reshape for main model
    features = np.expand_dims(features, axis=0)  # Shape: (1, 300, 4608)

    # Predict
    prediction = main_model.predict(features)
    return prediction

# Example usage
video_path = DATA_PATH + 'MU3D/Videos/BF001_1PT.wmv'
prediction = predict(video_path, fer_model, main_model, mean_X, std_X)
print("Prediction:", prediction)
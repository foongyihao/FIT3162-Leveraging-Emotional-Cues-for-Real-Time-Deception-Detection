import tensorflow as tf
import tensorflow.keras.backend as K
import cv2
import numpy as np
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from constants import NOTEBOOKS_PATH
import tempfile
from MediaPipeCropping import process_video, initialize_face_mesh

app = Flask(__name__)
CORS(app)

# Global progress tracker
progress_value = 0

# Define emotion labels
EMOTION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise', 'Neutral']

# Load the models
custom_objects = {"categorical_crossentropy": tf.keras.losses.categorical_crossentropy}
fer_model_path = NOTEBOOKS_PATH + 'deeplie/content/fer2013/fer.keras'
fer_model = tf.keras.models.load_model(fer_model_path, custom_objects=custom_objects)

# Verify the model's structure
layer_names = [layer.name for layer in fer_model.layers]

main_model_path = NOTEBOOKS_PATH + 'deeplie/content/deep-lie/project/gru_model/gru_model_(LOOCV)_64.0 (+- 48.0).keras'
main_model = tf.keras.models.load_model(main_model_path)

# Load mean and std for normalization
mean_X = np.load(NOTEBOOKS_PATH + 'deeplie/content/fer2013/mean_X.npy')
std_X = np.load(NOTEBOOKS_PATH + 'deeplie/content/fer2013/std_X.npy')

def extract_frames_mediapipe(video_path, num_frames=300):
    """
    Extract frames using MediaPipeCropping which:
    1. Detects faces using MediaPipe
    2. Aligns the faces based on eye positions
    3. Crops the face region
    4. Enhances the image quality
    """
    global progress_value
    progress_value = 5
    
    # Create a temporary directory to store processed frames
    with tempfile.TemporaryDirectory() as temp_dir:
        # Process video using MediaPipeCropping
        frame_count, saved_frame_count = process_video(
            video_path, 
            temp_dir, 
            target_frames=num_frames, 
            ssim_threshold=0.9
        )
        progress_value = 15
        
        if saved_frame_count == 0:
            raise ValueError("No faces detected in the video.")
        
        # Load the processed frames
        frames = []
        for i in range(saved_frame_count):
            frame_path = os.path.join(temp_dir, f'frame_{i:04d}.png')
            if os.path.exists(frame_path):
                frame = cv2.imread(frame_path)
                frames.append(frame)
        
        if len(frames) < num_frames:
            print(f"Warning: Only {len(frames)} frames were extracted (requested {num_frames})")
            
        progress_value = 20
        return frames

def process_emotions(emotion_preds):
    """
    Calculate emotion distribution by counting the dominant emotion in each frame
    """
    # Get the dominant emotion for each frame
    dominant_emotions = np.argmax(emotion_preds, axis=1)
    
    # Count occurrences of each emotion across frames
    emotion_counts = np.zeros(len(EMOTION_LABELS))
    for emotion_idx in dominant_emotions:
        emotion_counts[emotion_idx] += 1
    
    # Calculate percentages
    total_frames = len(emotion_preds)
    emotion_percentages = (emotion_counts / total_frames) * 100
    
    # Format the results
    emotion_data = []
    for i, label in enumerate(EMOTION_LABELS):
        if emotion_percentages[i] > 0:
            emotion_data.append({"name": label, "value": float(emotion_percentages[i])})
    
    return emotion_data

def predict(video_path, fer_model, main_model, mean_X, std_X, num_frames=300):
    global progress_value
    progress_value = 0
    
    try:
        # Extract frames from the video using MediaPipeCropping
        frames = extract_frames_mediapipe(video_path, num_frames)
        
        # Convert and preprocess frames
        frames = [cv2.cvtColor(cv2.resize(f, (48, 48)), cv2.COLOR_BGR2GRAY) for f in frames]
        frames = np.array(frames).astype('float32')
        frames = np.expand_dims(frames, axis=-1)
        frames = (frames - mean_X) / (std_X + 1e-8)
        progress_value = 30
        
        # Get emotion predictions
        emotion_preds = fer_model.predict(frames)
        emotion_data = process_emotions(emotion_preds)  # Simplified call
        progress_value = 50
        
        # Extract features using encoding model
        encoding_model = tf.keras.Model(
            inputs=fer_model.layers[0].input,
            outputs=fer_model.get_layer('flatten').output
        )
        
        # Process in chunks to avoid memory issues
        chunk_size = 30
        all_features = []
        total_chunks = len(frames) // chunk_size
        
        for i in range(0, len(frames), chunk_size):
            chunk = frames[i : i + chunk_size]
            features_chunk = encoding_model.predict(chunk)
            all_features.append(features_chunk)
            
            # Update progress
            chunk_index = (i // chunk_size) + 1
            progress_value = 50 + int((chunk_index / total_chunks) * 40)
        
        # Concatenate and prepare features
        all_features = np.concatenate(all_features, axis=0)
        all_features = np.expand_dims(all_features, axis=0)  # Add batch dimension
        
        # Get deception prediction
        prediction = main_model.predict(all_features)
        progress_value = 100
        
        # Return an empty
        return prediction, emotion_data
        
    except Exception as e:
        progress_value = 100  # Reset progress
        raise e

@app.route("/api/predict", methods=["POST"])
def predict_route():
    global progress_value
    # Save file to a temporary path
    uploaded_file = request.files.get("video")
    if not uploaded_file:
        return jsonify({"error": "No video file provided"}), 400

    temp_path = "/tmp/uploaded_video.mp4"
    uploaded_file.save(temp_path)

    try:
        # Run prediction
        preds, emotion_data = predict(temp_path, fer_model, main_model, mean_X, std_X)
        
        # Format the prediction results
        prediction_value = float(preds[0][0])
        is_deceptive = prediction_value > 0.5
        confidence = abs(prediction_value - 0.5) * 2 * 100  # Convert to percentage and scale
        
        # Prepare the response
        result = {
            "prediction": preds.tolist(),
            "result": "Deceptive" if is_deceptive else "Truthful",
            "confidence": f"{confidence:.1f}%",
            "emotions": emotion_data,
            "time": "Analysis Complete"
        }
        
        return jsonify(result)
    except Exception as e:
        print(e)
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.route("/api/progress", methods=["GET"])
def get_progress():
    global progress_value
    return jsonify({"progress": progress_value})

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)
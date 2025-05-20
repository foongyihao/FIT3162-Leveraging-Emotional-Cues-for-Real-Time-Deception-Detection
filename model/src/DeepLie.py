import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import tensorflow as tf
import tensorflow.keras.backend as K
import cv2
import numpy as np
import os
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from constants import NOTEBOOKS_PATH, DATA_PATH
import tempfile
from MediaPipeCropping import process_video, initialize_face_mesh
import matplotlib
# Force matplotlib to use non-interactive backend to avoid GUI thread issues
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import base64
from io import BytesIO

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

def create_frames_visualization(frames, emotion_preds, num_frames=8, encodings=None):
    """
    Creates a visualization of frames with emotion predictions and encoding heatmaps
    Returns the image as a base64-encoded string
    """
    try:
        # Select evenly spaced frames
        if len(frames) < num_frames:
            num_frames = len(frames)
        
        indices = np.linspace(0, len(frames) - 1, num_frames, dtype=int)
        
        # Create figure with two rows
        fig, axs = plt.subplots(2, num_frames, figsize=(num_frames*2, 5))
        plt.ioff()  # Turn off interactive mode
        
        for j, idx in enumerate(indices):
            try:
                # Top row: Original frame
                frame = frames[idx].copy()  # Make a copy to avoid modifying original
                
                # Handle different frame formats safely
                if len(frame.shape) == 3 and frame.shape[2] == 1:
                    frame = frame.reshape(frame.shape[0], frame.shape[1])
                elif len(frame.shape) == 3 and frame.shape[2] > 1:
                    # If RGB, convert to grayscale for display consistency
                    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.shape[2] == 3 else frame[:,:,0]
                
                # Ensure frame data is valid for plotting
                if np.isnan(frame).any() or np.isinf(frame).any():
                    frame = np.nan_to_num(frame, nan=0.0, posinf=1.0, neginf=0.0)
                
                axs[0, j].imshow(frame, cmap='gray')
                axs[0, j].axis('off')
                
                # Get emotion prediction for the frame
                if idx < len(emotion_preds):
                    emotion_idx = np.argmax(emotion_preds[idx])
                    emotion_label = EMOTION_LABELS[emotion_idx]
                    confidence = emotion_preds[idx][emotion_idx] * 100
                    axs[0, j].set_title(f"{emotion_label}")
                else:
                    axs[0, j].set_title(f"Frame {idx}")
                
                # Bottom row: Encoding heatmap
                if encodings is not None and idx < len(encodings):
                    # Reshape encoding to a square-ish shape for visualization
                    # Default reshape to approximately square dimensions
                    encoding = encodings[idx]
                    encoding_dim = int(np.sqrt(encoding.shape[0]))
                    
                    # Reshape to square-ish dimensions - find best fit
                    if encoding.shape[0] == 4608:  # Common size in these models
                        encoding_reshaped = encoding.reshape(64, 72)  # 64×72=4608
                    else:
                        # Try to make it as square as possible
                        encoding_reshaped = encoding.reshape(encoding_dim, -1)
                    
                    # Display as heatmap
                    im = axs[1, j].imshow(encoding_reshaped, cmap='viridis')
                    axs[1, j].axis('off')
                    axs[1, j].set_title(f"Encoding")
                else:
                    axs[1, j].axis('off')
                    axs[1, j].text(0.5, 0.5, "No encoding available", 
                                 horizontalalignment='center', verticalalignment='center')
            except Exception as e:
                print(f"Error processing frame {idx}: {e}")
                # Draw placeholder for error frames
                axs[0, j].text(0.5, 0.5, f"Error: {str(e)[:20]}...", 
                              horizontalalignment='center', verticalalignment='center')
                axs[0, j].axis('off')
                axs[1, j].axis('off')
        
        plt.tight_layout()
        
        # Save to memory buffer
        buf = BytesIO()
        plt.savefig(buf, format='png', dpi=100)
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in response
        img_str = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        return img_str
    except Exception as e:
        print(f"Visualization generation failed: {e}")
        # Return a simple error image
        fig, ax = plt.subplots(1, 1, figsize=(8, 4))
        ax.text(0.5, 0.5, f"Visualization Error: {str(e)}", 
               horizontalalignment='center', verticalalignment='center')
        ax.axis('off')
        
        buf = BytesIO()
        plt.savefig(buf, format='png', dpi=100)
        plt.close(fig)
        buf.seek(0)
        
        return base64.b64encode(buf.getvalue()).decode('utf-8')

def predict(video_path, fer_model, main_model, mean_X, std_X, num_frames=300):
    global progress_value
    progress_value = 0
    
    try:
        # Extract frames from the video using MediaPipeCropping
        frames = extract_frames_mediapipe(video_path, num_frames)
        
        # Convert and preprocess frames
        frames_processed = [cv2.cvtColor(cv2.resize(f, (48, 48)), cv2.COLOR_BGR2GRAY) for f in frames]
        frames_processed = np.array(frames_processed).astype('float32')
        frames_processed = np.expand_dims(frames_processed, axis=-1)
        frames_processed = (frames_processed - mean_X) / (std_X + 1e-8)
        progress_value = 30
        
        # Get emotion predictions
        emotion_preds = fer_model.predict(frames_processed)
        emotion_data = process_emotions(emotion_preds)
        progress_value = 50
        
        # Extract features using encoding model
        encoding_model = tf.keras.Model(
            inputs=fer_model.layers[0].input,
            outputs=fer_model.get_layer('flatten').output
        )
        
        # Process in chunks to avoid memory issues
        chunk_size = 30
        all_features = []
        total_chunks = len(frames_processed) // chunk_size
        
        for i in range(0, len(frames_processed), chunk_size):
            chunk = frames_processed[i : i + chunk_size]
            features_chunk = encoding_model.predict(chunk)
            all_features.append(features_chunk)
            
            # Update progress
            chunk_index = (i // chunk_size) + 1
            progress_value = 50 + int((chunk_index / total_chunks) * 40)
        
        # Concatenate and prepare features
        all_features = np.concatenate(all_features, axis=0)
        all_features = np.expand_dims(all_features, axis=0)  # Add batch dimension
        
        # Create visualization of frames with emotions and encodings
        visualization_img = create_frames_visualization(frames_processed, emotion_preds, encodings=all_features[0])
        
        # Get deception prediction
        prediction = main_model.predict(all_features)
        progress_value = 100
        
        # Return prediction, emotions, and visualization
        return prediction, emotion_data, visualization_img
        
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

    # Use a temporary file to save the uploaded video
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp_file:
        temp_path = temp_file.name
        uploaded_file.save(temp_path)

    try:
        # Run prediction with visualization
        preds, emotion_data, visualization_img = predict(temp_path, fer_model, main_model, mean_X, std_X)
        
        # Format the prediction results
        prediction_value = float(preds[0][0])
        is_deceptive = prediction_value > 0.5
        confidence = abs(prediction_value - 0.5) * 2 * 100  # Convert to percentage and scale
        
        # Prepare the response with visualization
        result = {
            "prediction": preds.tolist(),
            "result": "Deceptive" if is_deceptive else "Truthful",
            "confidence": f"{confidence:.1f}%",
            "emotions": emotion_data,
            "time": "Analysis Complete",
            "visualization": visualization_img
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

@app.route("/api/codebook", methods=["GET"])
def get_codebook():
    codebook_path = os.path.join(DATA_PATH, "MU3D", "MU3D Codebook.xlsx")
    if not os.path.exists(codebook_path):
        return jsonify({"error": "Codebook file not found"}), 404
    
    return send_file(codebook_path, 
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    as_attachment=True,
                    download_name='MU3D_Codebook.xlsx')

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=5001)
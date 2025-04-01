import tensorflow as tf
import cv2
import numpy as np
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from constants import NOTEBOOKS_PATH

app = Flask(__name__)
CORS(app)

# Global progress tracker
progress_value = 0

# Define emotion labels
EMOTION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Sad', 'Surprise', 'Neutral']

# Load the models with custom_objects as shown in the notebook
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
    global progress_value
    progress_value = 0

    # Extract frames
    frames = extract_frames(video_path, num_frames)

    # Preprocess frames
    frames = [cv2.cvtColor(cv2.resize(f, (48, 48)), cv2.COLOR_BGR2GRAY) for f in frames]
    frames = np.array(frames).astype('float32')
    frames = np.expand_dims(frames, axis=-1)
    frames = (frames - mean_X) / (std_X + 1e-8)

    # Get emotion predictions directly from the full FER model
    emotion_preds = fer_model.predict(frames)
    
    # Calculate aggregated emotion data
    emotion_counts = np.sum(emotion_preds, axis=0)
    total_emotions = np.sum(emotion_counts)
    emotion_percentages = (emotion_counts / total_emotions) * 100
    
    # Format emotion data for the frontend
    emotion_data = []
    for i, label in enumerate(EMOTION_LABELS):
        if emotion_percentages[i] > 0:  # Only include emotions with non-zero percentages
            emotion_data.append({
                "name": label,
                "value": float(emotion_percentages[i])
            })

    # Create a timeline of emotions for the confidence chart
    confidence_timeline = []
    for i in range(0, len(frames), max(1, len(frames)//6)):  # Sample ~6 points for the timeline
        time_point = f"{i//30:d}:{(i%30)*2:02d}"  # Format as M:SS
        max_emotion_idx = np.argmax(emotion_preds[i])
        confidence_val = float(emotion_preds[i][max_emotion_idx] * 100)
        confidence_timeline.append({
            "time": time_point,
            "confidence": confidence_val,
            "emotion": EMOTION_LABELS[max_emotion_idx]
        })

    # Prepare chunked encoding for deception detection
    chunk_size = 30
    all_features = []
    total_chunks = len(frames) // chunk_size

    encoding_model = tf.keras.Model(
        inputs=fer_model.layers[0].input,
        outputs=fer_model.get_layer('flatten').output
    )

    for i in range(0, len(frames), chunk_size):
        chunk = frames[i : i + chunk_size]
        features_chunk = encoding_model.predict(chunk)
        all_features.append(features_chunk)

        # Update progress percentage
        chunk_index = (i // chunk_size) + 1
        progress_value = int((chunk_index / total_chunks) * 100)

    # Concatenate features from all chunks
    all_features = np.concatenate(all_features, axis=0)
    
    # Expand dims for main model
    all_features = np.expand_dims(all_features, axis=0)

    # Get deception prediction
    prediction = main_model.predict(all_features)
    progress_value = 100

    # Return both the prediction and emotion data
    return prediction, emotion_data, confidence_timeline

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
        preds, emotion_data, confidence_timeline = predict(temp_path, fer_model, main_model, mean_X, std_X)
        
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
            "confidence_timeline": confidence_timeline,
            "time": "Analysis Complete"
        }
        
        return jsonify(result)
    except Exception as e:
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
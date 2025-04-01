import cv2
import numpy as np
import os
from skimage.metrics import structural_similarity as ssim
import mediapipe as mp
from PIL import Image
import torch
from RealESRGAN import RealESRGAN

# Initialize Real-ESRGAN
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print('device:', device)
model_scale = 2
model = RealESRGAN(device, scale=model_scale)
model.load_weights(f'weights/RealESRGAN_x{model_scale}.pth')

def initialize_face_mesh():
    """Initialize and return the MediaPipe Face Mesh object."""
    mp_face_mesh = mp.solutions.face_mesh
    return mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=True)

def create_output_directory(video_path):
    """Create output directory based on video filename within the current working directory."""
    video_name = os.path.splitext(os.path.basename(video_path))[0]
    current_dir = os.getcwd()
    output_folder = os.path.join(current_dir, video_name)
    os.makedirs(output_folder, exist_ok=True)
    return output_folder

def get_facial_landmarks(face_landmarks, img_w, img_h):
    """Extract key facial landmarks from MediaPipe results."""
    left_eye = np.array([int(face_landmarks.landmark[33].x * img_w), int(face_landmarks.landmark[33].y * img_h)])
    right_eye = np.array([int(face_landmarks.landmark[263].x * img_w), int(face_landmarks.landmark[263].y * img_h)])
    nose_tip = np.array([int(face_landmarks.landmark[4].x * img_w), int(face_landmarks.landmark[4].y * img_h)])
    forehead_y = int(face_landmarks.landmark[10].y * img_h)
    chin_y = int(face_landmarks.landmark[152].y * img_h)
    return left_eye, right_eye, nose_tip, forehead_y, chin_y

def compute_rotation_matrix(left_eye, right_eye, img_w, img_h):
    """Compute rotation matrix based on eye positions."""
    eye_delta_x = right_eye[0] - left_eye[0]
    eye_delta_y = right_eye[1] - left_eye[1]
    angle = np.degrees(np.arctan2(eye_delta_y, eye_delta_x))
    center = (img_w // 2, img_h // 2)
    return cv2.getRotationMatrix2D(center, angle, 1.0)

def transform_landmarks(landmarks, rotation_matrix):
    """Transform landmarks using rotation matrix."""
    ones = np.ones((landmarks.shape[0], 1))
    landmarks_homogeneous = np.hstack([landmarks, ones])
    return np.dot(rotation_matrix, landmarks_homogeneous.T).T.astype(int)

def calculate_face_bounding_box(transformed_landmarks, forehead_y, chin_y, img_w, img_h):
    """Calculate face bounding box with margins."""
    x_coords = transformed_landmarks[:, 0]
    y_coords = transformed_landmarks[:, 1]
    x_min, x_max = min(x_coords), max(x_coords)
    # Add a margin for forehead and chin
    forehead_margin = int(0.08 * img_h)
    chin_margin = int(0.01 * img_h)
    y_min = max(0, forehead_y - forehead_margin)
    y_max = min(img_h, chin_y + chin_margin)
    # Add padding
    padding_x = int(0.02 * img_w)
    padding_y = int(0.02 * img_h)
    x_min = max(0, x_min - padding_x)
    x_max = min(img_w, x_max + padding_x)
    y_min = max(0, y_min - padding_y)
    y_max = min(img_h, y_max + padding_y)
    return x_min, y_min, x_max, y_max

def transform_point(point, rotation_matrix):
    """Transform a single point using rotation matrix."""
    return np.dot(rotation_matrix, np.array([point[0], point[1], 1])).astype(int)

def draw_landmarks_and_box(frame, x_min, y_min, x_max, y_max, t_left_eye, t_right_eye, t_nose_tip):
    """Draw bounding box and landmark lines on the frame."""
    # Draw bounding box
    # cv2.rectangle(frame, (x_min, y_min), (x_max, y_max), (0, 255, 0), 2)
    # Optionally draw landmarks and connections:
    # cv2.circle(frame, (t_left_eye[0], t_left_eye[1]), 3, (255, 0, 0), -1)
    # cv2.circle(frame, (t_right_eye[0], t_right_eye[1]), 3, (255, 0, 0), -1)
    # cv2.circle(frame, (t_nose_tip[0], t_nose_tip[1]), 3, (255, 0, 0), -1)
    return frame

def align_face(frame, face_landmarks, img_w, img_h):
    """Main function to align face and add visual elements."""
    left_eye, right_eye, nose_tip, forehead_y, chin_y = get_facial_landmarks(face_landmarks, img_w, img_h)
    rotation_matrix = compute_rotation_matrix(left_eye, right_eye, img_w, img_h)
    aligned_frame = cv2.warpAffine(frame, rotation_matrix, (img_w, img_h))
    landmarks = np.array([(int(lm.x * img_w), int(lm.y * img_h)) for lm in face_landmarks.landmark])
    transformed_landmarks = transform_landmarks(landmarks, rotation_matrix)
    x_min, y_min, x_max, y_max = calculate_face_bounding_box(transformed_landmarks, forehead_y, chin_y, img_w, img_h)
    t_left_eye = transform_point(left_eye, rotation_matrix)
    t_right_eye = transform_point(right_eye, rotation_matrix)
    t_nose_tip = transform_point(nose_tip, rotation_matrix)
    aligned_frame = draw_landmarks_and_box(aligned_frame, x_min, y_min, x_max, y_max, t_left_eye, t_right_eye, t_nose_tip)
    return aligned_frame

def process_video(video_path, output_folder, target_frames=300, ssim_threshold=0.9):
    """Process video frames, align faces, crop the face, enhance quality, and save results."""
    os.makedirs(output_folder, exist_ok=True)
    video = cv2.VideoCapture(video_path)
    face_mesh = initialize_face_mesh()  # Initialize face landmark detector
    saved_frames = []
    last_face_crop = None
    frame_count = 0

    while video.isOpened():
        ret, frame = video.read()
        if not ret:
            break
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(rgb_frame)
            if results.multi_face_landmarks:
                for face_landmarks in results.multi_face_landmarks:
                    img_h, img_w, _ = frame.shape
                    aligned_frame = align_face(frame, face_landmarks, img_w, img_h)
                    left_eye, right_eye, nose_tip, forehead_y, chin_y = get_facial_landmarks(face_landmarks, img_w, img_h)
                    rotation_matrix = compute_rotation_matrix(left_eye, right_eye, img_w, img_h)
                    landmarks = np.array([(int(lm.x * img_w), int(lm.y * img_h)) for lm in face_landmarks.landmark])
                    transformed_landmarks = transform_landmarks(landmarks, rotation_matrix)
                    x_min, y_min, x_max, y_max = calculate_face_bounding_box(transformed_landmarks, forehead_y, chin_y, img_w, img_h)
                    face_crop = aligned_frame[y_min:y_max, x_min:x_max]
                    face_crop_resized = cv2.resize(face_crop, (128, 128))
                    
                    if last_face_crop is not None:
                        face_crop_gray = cv2.cvtColor(face_crop_resized, cv2.COLOR_BGR2GRAY)
                        last_face_crop_gray = cv2.cvtColor(last_face_crop, cv2.COLOR_BGR2GRAY)
                        ssim_score, _ = ssim(face_crop_gray, last_face_crop_gray, full=True)
                        if ssim_score < ssim_threshold:
                            saved_frames.append(face_crop_resized)
                            last_face_crop = face_crop_resized
                    else:
                        saved_frames.append(face_crop_resized)
                        last_face_crop = face_crop_resized
        except Exception as e:
            print(f"Error processing frame {frame_count}: {e}")
        frame_count += 1

    video.release()
    cv2.destroyAllWindows()

    total_frames = len(saved_frames)
    if total_frames > target_frames:
        indices = np.linspace(0, total_frames - 1, target_frames, dtype=int)
        saved_frames = [saved_frames[i] for i in indices]
    elif total_frames < target_frames:
        if total_frames == 0:
            print("No valid frames were saved. Check video input or face detection.")
            return frame_count, 0
        indices = np.linspace(0, total_frames - 1, target_frames, dtype=int)
        saved_frames = [saved_frames[i] for i in indices]

    # Enhance image quality using Real-ESRGAN before saving
    enhanced_frames = []
    for idx, frame in enumerate(saved_frames):
        try:
            # Convert BGR (OpenCV) to RGB (PIL)
            pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            original_size = pil_image.size
            sr_image = model.predict(np.array(pil_image))
            sr_image = sr_image.resize(original_size, Image.LANCZOS)
            sr_frame = cv2.cvtColor(np.array(sr_image), cv2.COLOR_RGB2BGR)
            enhanced_frames.append(sr_frame)
        except Exception as e:
            print(f"Error enhancing frame {idx}: {e}")

    # Save enhanced images
    for idx, frame in enumerate(enhanced_frames):
        output_path = os.path.join(output_folder, f'frame_{idx:04d}.png')
        cv2.imwrite(output_path, frame)

    return frame_count, len(enhanced_frames)

"""Main function to orchestrate the face alignment process."""
video_filename = "BF001_3NT.wmv"  # Change this to your video
output_folder = create_output_directory(video_filename)
target_frames = 300  # Desired number of frames
ssim_threshold = 0.9  # Adjust sensitivity if needed
frame_count, saved_frame_count = process_video(video_filename, output_folder, target_frames, ssim_threshold)

print(f"Video filename: {video_filename}")
print(f"Total frames processed: {frame_count}")
print(f"Total frames saved: {saved_frame_count}")
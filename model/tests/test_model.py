import unittest
import requests
import time

class TestModel(unittest.TestCase):

    def setUp(self):
        self.url = "http://localhost:5001/api/predict"

    # def test_detection_correctness(self):
    #
    #     inputs = [
    #         ("/Users/foongyihao/Desktop/FIT3162/FYP/FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection/model/data/MU3D/Demo/BF001_1PT.wmv", "Truthful"),
    #         ("/Users/foongyihao/Desktop/FIT3162/FYP/FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection/model/data/MU3D/Demo/BF001_2NL.wmv", "Deceptive")
    #     ]
    #
    #     for file_path, result in inputs:
    #
    #         with open(file_path, "rb") as video_file:
    #             files = {"video": video_file}
    #             response = requests.post(self.url, files=files)
    #
    #         # Check if the response is valid
    #         self.assertEqual(response.status_code, 200, f"Unexpected status code: {response.status_code}")
    #
    #         # Validate the result
    #         self.assertEqual(response.json().get("result"), result)

    def test_latency(self):
        start_time = time.time()
        file_path = "/Users/foongyihao/Desktop/FIT3162/FYP/FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection/model/data/MU3D/Demo/10sec.wmv"

        with open(file_path, "rb") as video_file:
            files = {"video": video_file}
            response = requests.post(self.url, files=files)

        end_time = time.time()
        elapsed_time = end_time - start_time

        # Check if the response is valid
        self.assertEqual(response.status_code, 200, f"Unexpected status code: {response.status_code}")

        # Validate the result
        self.assertTrue(elapsed_time < 10)
        print(f"elapse_time: {elapsed_time}")


    # def test_preprocessing(self):
    #     target_frames = 300
    #     with tempfile.TemporaryDirectory() as temp_dir:
    #         frame_count, saved_frame_count = process_video(
    #             "/Users/foongyihao/Desktop/FIT3162/FYP/FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection/model/data/MU3D/Demo/BF001_1PT.wmv",
    #             temp_dir,
    #             target_frames=300,
    #             ssim_threshold=0.9
    #         )
    #
    #     # Check if any files were created in the temp directory
    #     files_in_temp_dir = os.listdir(temp_dir)
    #     self.assertTrue(len(files_in_temp_dir) > 0, "No files were created in the temporary directory")
    #
    #     self.assertTrue(saved_frame_count, target_frames)

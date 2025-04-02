# Leveraging Emotional Cues for Real-Time Deception Detection

## Overview

This project develops an AI-powered platform for real-time deception detection by analyzing facial micro-expressions. Unlike traditional multimodal systems that require extensive computational resources, our approach focuses exclusively on micro-expressions to create a more accessible and efficient detection system.

## Background

Deception detection is crucial in various contexts including legal proceedings, security screenings, and interviews. Current high-performing systems often employ multimodal approaches that integrate multiple data types, making them computationally intensive and expensive. This project addresses these limitations by focusing on micro-expressions—involuntary facial movements that can reveal concealed emotions—to create a more streamlined, accessible solution.

## Project Structure

```
FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection/
├── web/                           # NextJS web application
│   ├── app/                       # Next.js app directory
│   │   ├── about/                 # About page
│   │   ├── model/                 # Model interface page
│   │   └── page.tsx               # Home page
│   ├── components/                # Reusable UI components
│   ├── public/                    # Static assets
│   └── package.json               # Web dependencies
├── model/                         # Model files and notebooks
│   ├── notebooks/                 # Jupyter notebooks for model development
│   ├── data/                      # Training and testing datasets
│   ├── src/                       # Source code for model
│   │   └── constants.py           # Contains constant variables and common path declarations
│   └── [name]-requirements.txt    # Python dependencies file; ensure the file name ends with "-requirements.txt"
├── README.md                      # Project documentation and setup instructions
└── LICENSE                        # Project license
```

## Setup Instructions

### Prerequisites

- **Software Requirements**

  - Node.js (v16 or higher)
  - Python 3.8+ (Python 3.10 recommended)
  - npm (v7 or higher)
  - pip (Python package manager)
  - Git
- **Hardware Requirements**

  | Component           | Minimum Requirement                              | Recommended Requirement                   |
  | ------------------- | ------------------------------------------------ | ----------------------------------------- |
  | Processor (CPU)     | Quad-core processor, 2.5 GHz                     | 6-core processor, 3.0 GHz or higher       |
  | Memory (RAM)        | 8 GB                                             | 16 GB or higher                           |
  | Storage             | 256 GB SSD                                       | 512 GB SSD or higher                      |
  | Graphics (GPU)      | Integrated graphics                              | Dedicated GPU with 4 GB VRAM              |
  | Camera              | 720p webcam                                      | 1080p webcam, 10 Mbps upload              |
  | Internet Connection | 10 Mbps download, 5 Mbps upload                  | 25 Mbps download, 10 Mbps upload          |
  | Operating System    | Windows 10, macOS 10.15, or Linux (Ubuntu 20.04) | Latest version of Windows, macOS or Linux |
- **Web Browser**

  - Chrome (latest)
  - Firefox (latest)
  - Safari (latest)
  - Edge (latest)
- **Additional Dependencies**

  - CUDA and cuDNN (for GPU acceleration with NVIDIA GPUs)
  - Git Large File Storage (Git LFS)

### Installing Git LFS

```bash

1. Install Git LFS:

   ```bash
   # On macOS
   brew install git-lfs

   # On Ubuntu
   sudo apt-get install git-lfs

   # On Windows (using Chocolatey)
   choco install git-lfs

   # On Windows (using winget)
   winget install --id Git.GitLFS
   ```

2. Initialize Git LFS in the repository:

   ```bash
   git lfs install
   ```

3. Pull the large files after cloning the repository:

   ```bash
   git lfs pull
   ```

#### Tracking Large Files with Git LFS
Git LFS is used to efficiently handle large files such as videos, datasets, and model weights. This project tracks the following file types using Git LFS:  `keras`.

However, due to the limited storage quota, "npy", "wmv" etc. is not tracked by Git LFS and is ignored by git in the gitignore. To include a particular `.npy` file in your project, you need to track it using Git LFS. Here are the steps to do so:

1. Track the your `file path` using Git LFS:
   ```bash
   git lfs track "path/to/your/file.npy"
   ```

2. Add the `.npy` file to your repository:
   ```bash
   git add path/to/your/file.npy
   
   ```

Make sure to replace `path/to/your/file.npy` with the actual path to your `.npy` file and `your-branch-name` with the name of your branch.

#### Managing Git LFS
1. In case the repository hit the storage quota, you can manage the files tracked by Git LFS by removing unnecessary files or migrating them to a different storage location. Here are some useful commands to manage Git LFS:
   ```bash
   git lfs ls-files -l | awk '{print $3}' | xargs du -k | awk '{printf "%s %.6f GB\n", $2, $1 / (1024 * 1024)}'
   ```

### Web Application Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection.git
   cd FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection
   ```
2. Install web dependencies:

   ```bash
   cd web
   npm install
   ```
3. Create a `.env` file in the `web` directory with necessary environment variables:

   ```
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```

### Model Setup

1. Set up a Python virtual environment:

   ```bash
   cd model
   python -m venv my_project_env

   # Activate on Windows
   venv\Scripts\activate

   # Activate on macOS/Linux
   source venv/bin/activate
   ```
2. Install the required Python packages:

   ```bash
   cd model
   pip install -r [name]-requirements.txt # Depending on the model you are using, replace [name] with the model name
   ```
3. Download the pre-trained model (if available):

   ```bash
   cd model
   python src/download_model.py
   ```

## Running the Project

### Web Application

1. Start the development server:

   ```bash
   cd web
   npm run dev
   ```
2. Open your browser and navigate to `http://localhost:3000`

## Technologies Used

### Web Application

- Next.js
- React
- TypeScript
- Tailwind CSS
- Shadcn UI Components

### Model

- Python
- TensorFlow/PyTorch
- OpenCV
- Mediapipe
- Scikit-learn

## Preprocessed Datasets

The preprocessed datasets used for training and testing the model can be found in the following Google Drive folder:
https://drive.google.com/drive/u/1/folders/1oOCvq37bn4Dg8MdXT3XoRhu-ClcbCMIG

## Features

- Real-time deception detection using facial micro-expressions
- Interactive web interface for analysis and results visualization
- Research-backed model trained on facial micro-expression datasets
- Cost-effective alternative to multimodal deception detection systems

## Contributors

- Chong Chun Wei
- Foong Yi Hao
- Tan Chun Ling

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Monash University FIT3162 Final Year Project

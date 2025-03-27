# Leveraging Emotional Cues for Real-Time Deception Detection

## Overview

This project develops an AI-powered platform for real-time deception detection by analyzing facial micro-expressions. Unlike traditional multimodal systems that require extensive computational resources, our approach focuses exclusively on micro-expressions to create a more accessible and efficient detection system.

## Background

Deception detection is crucial in various contexts including legal proceedings, security screenings, and interviews. Current high-performing systems often employ multimodal approaches that integrate multiple data types, making them computationally intensive and expensive. This project addresses these limitations by focusing on micro-expressions—involuntary facial movements that can reveal concealed emotions—to create a more streamlined, accessible solution.

## Project Structure

```
FIT3162-Leveraging-Emotional-Cues-for-Real-Time-Deception-Detection/
├── web/                    # NextJS web application
│   ├── app/                # Next.js app directory
│   │   ├── about/          # About page
│   │   ├── model/          # Model interface page
│   │   └── page.tsx        # Home page
│   ├── components/         # Reusable UI components
│   ├── public/             # Static assets
│   └── package.json        # Web dependencies
│
├── model/                  # Model files and notebooks
│   ├── notebooks/          # Jupyter notebooks for model development
│   ├── data/               # Training and testing datasets
│   ├── src/                # Source code for model
│   └── requirements.txt    # Python dependencies
│
├── README.md               # This file
└── LICENSE                 # Project license
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

  | Component | Minimum Requirement | Recommended Requirement |
  |-----------|---------------------|-------------------------|
  | Processor (CPU) | Quad-core processor, 2.5 GHz | 6-core processor, 3.0 GHz or higher |
  | Memory (RAM) | 8 GB | 16 GB or higher |
  | Storage | 256 GB SSD | 512 GB SSD or higher |
  | Graphics (GPU) | Integrated graphics | Dedicated GPU with 4 GB VRAM |
  | Camera | 720p webcam | 1080p webcam, 10 Mbps upload |
  | Internet Connection | 10 Mbps download, 5 Mbps upload | 25 Mbps download, 10 Mbps upload |
  | Operating System | Windows 10, macOS 10.15, or Linux (Ubuntu 20.04) | Latest version of Windows, macOS or Linux |

- **Web Browser**
  - Chrome (latest)
  - Firefox (latest)
  - Safari (latest)
  - Edge (latest)

- **Additional Dependencies**
  - CUDA and cuDNN (for GPU acceleration with NVIDIA GPUs)

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

3. Create a `.env.local` file in the `web` directory with necessary environment variables:
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
   pip install -r requirements.txt
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

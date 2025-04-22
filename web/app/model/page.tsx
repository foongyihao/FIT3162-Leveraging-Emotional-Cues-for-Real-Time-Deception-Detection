"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Upload } from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import Image from "next/image"

interface PredictionResult {
  time: string
  result: string
  confidence: string
  videoName: string
  emotions?: Array<{ name: string; value: number }>
  visualization?: string
}

export default function ModelPage() {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState(
    "The selected file is either too large or in an unsupported format. Please select a video file under 100MB in MP4 format."
  )
  const [progress, setProgress] = useState(100)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [inputMethod, setInputMethod] = useState<"upload" | "camera">("upload")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [predictionResults, setPredictionResults] = useState<PredictionResult[]>([])
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionResult | null>(null)
  const [emotionData, setEmotionData] = useState<Array<{ name: string; value: number }>>([])
  const [visualizationImg, setVisualizationImg] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const inputMethodRef = useRef(inputMethod)
  const lastPredictionTimestamp = useRef<number>(Date.now())

  const mockData: PredictionResult[] = [
    { time: "0:02", result: "Deceptive", confidence: "95%", videoName: "-" },
    { time: "0:05", result: "Truth", confidence: "87%", videoName: "-" },
    { time: "0:08", result: "Truth", confidence: "92%", videoName: "-" },
  ]

  const pieData = [
    { name: "Happiness", value: 45 },
    { name: "Surprise", value: 25 },
    { name: "Contempt", value: 15 },
    { name: "Neutral", value: 15 },
  ]

  const COLORS = [
    "#000000",
    "#333333",
    "#666666",
    "#999999", 
    "#CCCCCC",  
  ]

  const startPredictProgressCheck = useCallback(async () => {
    if (pollTimer) {
      clearInterval(pollTimer)
    }
    console.log("Starting progress check polling...");
    const timer = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:5001/api/progress")
        const data = await res.json()
        if (data.progress !== undefined) {
          setProgress(data.progress)
          if (data.progress >= 100) {
            console.log("Progress reached 100, stopping poll.");
            clearInterval(timer)
            setPollTimer(null)
          }
        }
      } catch (err) {
        console.error("Progress poll error:", err)
      }
    }, 500)
    setPollTimer(timer)
  }, [pollTimer, setProgress, setPollTimer])

  const sendVideoForPrediction = useCallback(async (videoData: File | Blob) => {
    setProgress(0)
    startPredictProgressCheck()

    const formData = new FormData()
    const fileName = videoData instanceof File ? videoData.name : `live_recording_${new Date().toISOString()}.webm`
    formData.append("video", videoData, fileName)

    try {
      const response = await fetch("http://localhost:5001/api/predict", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${data.error || response.statusText}`)
      }

      console.log("Prediction result:", data)

      if (data.prediction) {
        const predictionResult: PredictionResult = {
          time: new Date().toLocaleTimeString(),
          result: data.result || (data.prediction[0] > 0.5 ? "Deceptive" : "Truthful"),
          confidence: data.confidence || `${Math.round(Math.abs(data.prediction[0] - 0.5) * 200)}%`,
          videoName: videoData instanceof File && videoData.name ? videoData.name : fileName,
          emotions: data.emotions,
          visualization: data.visualization ? `data:image/png;base64,${data.visualization}` : undefined,
        }

        setPredictionResults((prev) => [...prev, predictionResult])
        setSelectedPrediction(prevSelected => prevSelected ? prevSelected : predictionResult)

        if (data.emotions) {
          setEmotionData(data.emotions)
        }
        
        if (data.visualization) {
          setVisualizationImg(`data:image/png;base64,${data.visualization}`)
        }
      }
    } catch (err) {
      console.error("Prediction failed:", err)
      setErrorMessage("Prediction failed. Please try again.\n" + (err as Error).message)
      setShowError(true)
    }
  }, [startPredictProgressCheck])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("video/")) {
      setErrorMessage("Please select a valid video file.")
      setShowError(true)
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      setErrorMessage("File is too large. Please select a video under 100MB.")
      setShowError(true)
      return
    }

    const videoUrl = URL.createObjectURL(file)
    setVideoSrc(videoUrl)

    sendVideoForPrediction(file)
  }

  const getSupportedMimeType = useCallback(() => {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        console.log(`Browser supports: ${type}`);
        return type;
      }
    }
    
    console.warn("None of the preferred MIME types are supported, using default");
    return '';  
  }, []);

  const stopCamera = useCallback(() => {
    console.log("--- stopCamera called ---");
    setRecorder(prevRecorder => {
      if (prevRecorder) {
        console.log(`stopCamera: Recorder found (state: ${prevRecorder.state}). Stopping.`);
        if (prevRecorder.state === "recording") {
          prevRecorder.onstart = null;
          prevRecorder.ondataavailable = null;
          prevRecorder.onerror = null;
          prevRecorder.onstop = null;
          prevRecorder.stop();
          console.log("stopCamera: Recorder stop() called.");
        } else {
          console.log(`stopCamera: Recorder was not recording (state: ${prevRecorder.state}).`);
        }
      } else {
        console.log("stopCamera: No active recorder found to stop.");
      }
      return null;
    });

    setStream(prevStream => {
      if (prevStream) {
        console.log("stopCamera: Stream found. Stopping tracks.");
        prevStream.getTracks().forEach((track) => track.stop());
      } else {
         console.log("stopCamera: No active stream found to stop.");
      }
      return null;
    });

    if (videoRef.current) {
        videoRef.current.srcObject = null;
        console.log("stopCamera: Cleared video element source.");
    }

    setRecordedChunks([]);
    console.log("--- stopCamera finished ---");
  }, [])

  const startContinuousRecording = useCallback((mediaStream: MediaStream) => {
    if (!mediaStream) {
      console.error("No stream available for recording");
      return;
    }
    setRecorder(prevRecorder => {
        if (prevRecorder) {
            console.log("Recorder already exists.");
            return prevRecorder;
        }

        try {
            if (typeof MediaRecorder === 'undefined') {
                throw new Error("MediaRecorder not supported in this browser");
            }

            const mimeType = getSupportedMimeType();
            const options = mimeType ? { mimeType } : undefined;
            console.log(`Creating MediaRecorder with options:`, options);

            const newMediaRecorder = new MediaRecorder(mediaStream, options);

            newMediaRecorder.onstart = () => {
                console.log("MediaRecorder started with 30s timeslice");
                setRecordedChunks([]);
            };

            newMediaRecorder.onerror = (event) => {
                console.error("MediaRecorder error:", event);
                setErrorMessage(`Recording error: ${(event as any)?.error?.message || 'Unknown error'}`);
                setShowError(true);
                stopCamera();
            };

            newMediaRecorder.onstop = () => {
                console.log("MediaRecorder stopped");
            };

            newMediaRecorder.ondataavailable = (event) => {
                console.log(`ondataavailable: Event fired. Data size: ${event.data?.size || 0} bytes`);
                if (inputMethodRef.current === 'camera' && event.data && event.data.size > 0) {
                    console.log("ondataavailable: Still in camera mode. Blob received, sending for prediction...");
                    sendVideoForPrediction(event.data);
                } else if (inputMethodRef.current !== 'camera') {
                    console.log("ondataavailable: Input method changed away from camera. Skipping prediction.");
                } else {
                    console.warn("Received empty data in ondataavailable event");
                }
            };

            console.log("Starting MediaRecorder with 30000ms timeslice");
            newMediaRecorder.start(30000);
            console.log("MediaRecorder state after start:", newMediaRecorder.state);
            return newMediaRecorder;

        } catch (err) {
            console.error("Error in startContinuousRecording:", err);
            setErrorMessage(`Failed to start camera recording: ${(err as unknown as any).message}`);
            setShowError(true);
            return null;
        }
    });
  }, [getSupportedMimeType, setRecorder, setRecordedChunks, setErrorMessage, setShowError, stopCamera, sendVideoForPrediction]);

  const startCamera = useCallback(async () => {
    console.log(">>> startCamera called <<<");
    try {
      console.log("startCamera: Calling stopCamera first...");
      stopCamera();

      console.log("startCamera: Requesting camera access...");
      const mediaStream = await navigator.mediaDevices
        .getUserMedia({
          video: true,
          audio: false,
        });

      console.log("startCamera: Access granted.");

      if (!mediaStream) {
        throw new Error("Media stream is null or undefined");
      }

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.style.transform = "none";
        videoRef.current.onloadedmetadata = () => {
          console.log("startCamera: video metadata loaded.");
          videoRef.current?.play().then(() => {
             console.log("startCamera: video playback started, calling startContinuousRecording.");
             startContinuousRecording(mediaStream);
          }).catch((e) => console.error("Error playing video:", e));
        };
      } else {
         console.warn("Video ref not available immediately, attempting to start recording anyway.");
         startContinuousRecording(mediaStream);
      }

    } catch (err) {
      console.error("Error accessing camera:", err);
      setErrorMessage(`Could not access camera: ${(err as unknown as any).message}`);
      setShowError(true);
    }
    console.log(">>> startCamera finished <<<");
  }, [startContinuousRecording, stopCamera])

  useEffect(() => {
    inputMethodRef.current = inputMethod;
    console.log(`Input method ref updated to: ${inputMethodRef.current}`);
  }, [inputMethod]);

  useEffect(() => {
    if (inputMethod === "camera") {
      console.log("Input method changed to camera, starting...");
      startCamera()
    } else {
      console.log("Input method changed to upload, stopping camera...");
      stopCamera()
    }

    return () => {
      console.log("Cleanup: Stopping camera...");
      stopCamera()
    }
  }, [inputMethod, startCamera, stopCamera])

  useEffect(() => {
    if (videoSrc && inputMethod === "upload") {
      const videoEl = document.getElementById("video-preview") as HTMLVideoElement
      if (videoEl) {
        videoEl.load()
      }
    }
  }, [videoSrc, inputMethod])

  return (
    <main className="container mx-auto px-4 py-8">
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        <Card className="p-6 space-y-6 md:col-span-2">
          <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
            {inputMethod === "upload" ? (
              videoSrc ? (
                <video
                  id="video-preview"
                  src={videoSrc}
                  controls
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-muted-foreground">Upload a video to preview</p>
                </div>
              )
            ) : (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: "none" }} 
              />
            )}
          </div>

          <Select value={inputMethod} onValueChange={(value) => setInputMethod(value as "upload" | "camera")}>
            <SelectTrigger>
              <SelectValue placeholder="Select input method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">Upload Video</SelectItem>
              <SelectItem value="camera">Camera</SelectItem>
            </SelectContent>
          </Select>

          <div className="space-y-4">
            {inputMethod === "upload" ? (
              <>
                {progress < 100 && <Progress value={progress} className="w-full" />}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="video/*"
                  className="hidden"
                  title="Upload Video"
                />
                <Button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Video
                </Button>
              </>
            ) : (
              <>
                {progress < 100 && <Progress value={progress} className="w-full mb-4" />}
                <p>Camera streaming live. Predictions run every 30 seconds.</p>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="aspect-square bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={selectedPrediction && selectedPrediction.emotions ? selectedPrediction.emotions : pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="50%"
                    outerRadius="60%"
                    fill="#8884d8"
                    paddingAngle={10}
                    dataKey="value"
                    nameKey="name"
                    label={(entry) => entry.name} 
                    labelLine={{ strokeWidth: 1, stroke: "gray", strokeOpacity: 0.5 }}
                  >
                    {(selectedPrediction && selectedPrediction.emotions ? selectedPrediction.emotions : pieData)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))
                    }
                  </Pie>
                  <Tooltip 
                    formatter={(value) => `${(value as number).toFixed(0)}%`}
                    labelFormatter={(name) => `${name}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="p-6 space-y-6 md:col-span-3">
          <div className="flex flex-col h-[600px]">
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Video Name</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {predictionResults.length > 0
                    ? predictionResults.map((row, i) => (
                        <TableRow
                          key={i}
                          onClick={() => setSelectedPrediction(row)}
                          className="cursor-pointer hover:bg-gray-100"
                        >
                          <TableCell>{row.time}</TableCell>
                          <TableCell>{row.videoName}</TableCell>
                          <TableCell>{row.result}</TableCell>
                          <TableCell>{row.confidence}</TableCell>
                        </TableRow>
                      ))
                    : mockData.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.time}</TableCell>
                          <TableCell>{row.videoName}</TableCell>
                          <TableCell>{row.result}</TableCell>
                          <TableCell>{row.confidence}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex-1 mt-6 overflow-hidden">
              {selectedPrediction && selectedPrediction.visualization ? (
                <>
                  <h3 className="text-lg font-semibold mt-2">
                    Visualization for {selectedPrediction.videoName} at {selectedPrediction.time}
                  </h3>
                  <Image
                    src={selectedPrediction.visualization}
                    alt="Video frames with emotion predictions"
                    className="w-full h-full object-contain"
                    width={800}
                    height={600}
                    priority
                  />
                </>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p>Select a prediction result to view visualization details.</p>
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      <AlertDialog open={showError} onOpenChange={setShowError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
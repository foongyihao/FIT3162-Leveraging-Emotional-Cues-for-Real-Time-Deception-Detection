"use client"

import { useState, useRef, useEffect } from "react"
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
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function ModelPage() {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState(
    "The selected file is either too large or in an unsupported format. Please select a video file under 100MB in MP4 format."
  )
  const [progress, setProgress] = useState(100)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [inputMethod, setInputMethod] = useState<"upload" | "camera">("upload")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraTime, setCameraTime] = useState(0)
  const [predictionTimer, setPredictionTimer] = useState<NodeJS.Timeout | null>(null)
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  const [chunkTimestamps, setChunkTimestamps] = useState<number[]>([])
  const [predictionResults, setPredictionResults] = useState<
    Array<{
      time: string
      result: string
      confidence: string
    }>
  >([])
  const [emotionData, setEmotionData] = useState<Array<{ name: string; value: number }>>([])
  const [confidenceData, setConfidenceData] = useState<Array<{ time: string; confidence: number }>>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestDataIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const mockData = [
    { time: "0:02", result: "Deceptive", confidence: "95%" },
    { time: "0:05", result: "Truth", confidence: "87%" },
    { time: "0:08", result: "Truth", confidence: "92%" },
  ]

  const pieData = [
    { name: "Happiness", value: 45 },
    { name: "Surprise", value: 25 },
    { name: "Contempt", value: 15 },
    { name: "Neutral", value: 15 },
  ]

  const histogramData = [
    { time: "0:00", confidence: 85 },
    { time: "0:05", confidence: 92 },
    { time: "0:10", confidence: 78 },
    { time: "0:15", confidence: 95 },
    { time: "0:20", confidence: 88 },
    { time: "0:25", confidence: 90 },
  ]

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ]

  async function startPredictProgressCheck() {
    if (pollTimer) {
      clearInterval(pollTimer)
    }
    const timer = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:5001/api/progress")
        const data = await res.json()
        if (data.progress !== undefined) {
          setProgress(data.progress)
          if (data.progress >= 100) {
            clearInterval(timer)
            setPollTimer(null)
          }
        }
      } catch (err) {
        console.error("Progress poll error:", err)
      }
    }, 500)
    setPollTimer(timer)
  }

  async function sendVideoForPrediction(videoData: File | Blob) {
    setProgress(0)
    startPredictProgressCheck()

    const formData = new FormData()
    formData.append("video", videoData)

    try {
      const response = await fetch("http://localhost:5001/api/predict", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      console.log("Prediction result:", data)

      if (data.prediction) {
        const predictionResult = {
          time: new Date().toLocaleTimeString(),
          result: data.result || (data.prediction[0] > 0.5 ? "Deceptive" : "Truthful"),
          confidence: data.confidence || `${Math.round(Math.abs(data.prediction[0] - 0.5) * 200)}%`,
        }

        setPredictionResults((prev) => [...prev, predictionResult])

        if (data.emotions) {
          setEmotionData(data.emotions)
        }

        if (data.confidence_timeline) {
          setConfidenceData(data.confidence_timeline)
        }
      }
    } catch (err) {
      console.error("Prediction failed:", err)
      setErrorMessage("Prediction failed. Please try again.")
      setShowError(true)
    }
  }

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

  // Check and choose supported MIME type
  function getSupportedMimeType() {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`Browser supports: ${type}`);
        return type;
      }
    }
    
    console.warn("None of the preferred MIME types are supported, using default");
    return '';  // Let browser use default
  }

  // Start continuous recording
  function startContinuousRecording() {
    if (!stream) {
      console.error("No stream available");
      return;
    }
    
    try {
      // First verify MediaRecorder is available
      if (typeof MediaRecorder === 'undefined') {
        throw new Error("MediaRecorder not supported in this browser");
      }
      
      // Choose supported mime type
      const mimeType = getSupportedMimeType();
      
      // Create options object only if we have a supported type
      const options = mimeType ? { mimeType } : undefined;
      console.log(`Creating MediaRecorder with options:`, options);
      
      const mediaRecorder = new MediaRecorder(stream, options);
      
      // Add event listeners with more detailed logging
      mediaRecorder.onstart = () => {
        console.log("MediaRecorder started");
      };
      
      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };
      
      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped");
      };
      
      // Store timestamp with each chunk to track timing
      mediaRecorder.ondataavailable = (event) => {
        console.log(`Data available event fired, data size: ${event.data?.size || 0} bytes`);
        
        if (event.data && event.data.size > 0) {
          // Use callback form of setState to ensure we're working with latest state
          setRecordedChunks(prev => {
            const newChunks = [...prev, event.data];
            console.log(`Added chunk. Total chunks now: ${newChunks.length}`);
            return newChunks;
          });
          
          setChunkTimestamps(prev => {
            const newTimestamps = [...prev, Date.now()];
            return newTimestamps;
          });
        } else {
          console.warn("Received empty data in ondataavailable event");
        }
      };
      
      // Request chunks every 1 second - use shorter interval for testing
      console.log("Starting MediaRecorder with 1000ms timeslice");
      mediaRecorder.start();
      setRecorder(mediaRecorder);

      requestDataIntervalRef.current = setInterval(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.requestData();
        }
      }, 1000);
      console.log("MediaRecorder state after start:", mediaRecorder.state);
      
    } catch (err) {
      console.error("Error in startContinuousRecording:", err);
      setErrorMessage(`Failed to start camera recording: ${(err as unknown as any).message}`);
      setShowError(true);
    }
  }

  // Process video chunks with more robust handling
  function processLast30SecondsOfVideo() {
    console.log(`Processing - chunks available: ${recordedChunks.length}, timestamps: ${chunkTimestamps.length}`);
    
    // Only process if we have chunks
    if (recordedChunks.length === 0) {
      console.log("No video chunks available yet");
      return;
    }
    
    const now = Date.now();
    const thirtySecondsAgo = now - 30000; // 30 seconds in ms
    
    console.log(`Looking for chunks between ${new Date(thirtySecondsAgo).toISOString()} and ${new Date(now).toISOString()}`);
    
    // Find chunks from the last 30 seconds
    const recentChunks: Blob[] = [];
    
    // Loop through timestamps and collect corresponding chunks
    chunkTimestamps.forEach((timestamp, index) => {
      if (timestamp >= thirtySecondsAgo) {
        // Make sure recordedChunks has a corresponding entry
        if (index < recordedChunks.length) {
          recentChunks.push(recordedChunks[index]);
        }
      }
    });
    
    console.log(`Found ${recentChunks.length} chunks from the last 30 seconds`);
    
    if (recentChunks.length === 0) {
      console.log("No recent chunks available");
      return;
    }
    
    // Create a blob from the recent chunks
    const blob = new Blob(recentChunks, { type: "video/webm" });
    console.log(`Created blob of size: ${blob.size} bytes`);
    
    // Only proceed if we have a valid blob with data
    if (blob.size > 0) {
      // Send for prediction
      sendVideoForPrediction(blob);
    } else {
      console.error("Created empty blob from chunks");
    }
  }

  // Timer to trigger predictions every 30 seconds
  function startPredictionTimer() {
    if (predictionTimer) {
      clearInterval(predictionTimer);
    }
    
    console.log("Starting prediction timer");
    const timer = setInterval(() => {
      setCameraTime(prev => {
        const newTime = prev + 1;
        
        // Process every 30 seconds
        if (newTime % 30 === 0) {
          console.log(`30-second mark reached (${newTime}s), processing recent video...`);
          processLast30SecondsOfVideo();
          
          // Optional: clean up old chunks to avoid excessive memory use
          if (chunkTimestamps.length > 60) {
            const sixtySecondsAgo = Date.now() - 60000;
            const keepIndex = chunkTimestamps.findIndex(ts => ts >= sixtySecondsAgo);
            if (keepIndex > 0) {
              setRecordedChunks(prev => prev.slice(keepIndex));
              setChunkTimestamps(prev => prev.slice(keepIndex));
            }
          }
        }
        
        return newTime;
      });
    }, 1000);
    
    setPredictionTimer(timer);
    console.log("Prediction timer started");
  }

  // Start camera with additional checks
  async function startCamera() {
    try {
      // Check if browser supports required APIs
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }

      console.log("Requesting camera and microphone access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false, // Audio often requires additional permissions, simplify for now
      });

      console.log("Access granted to camera");

      // Check if mediaStream is valid
      if (!mediaStream) {
        throw new Error("Media stream is null or undefined");
      }

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.style.transform = "none"; // Remove mirroring
        videoRef.current.onloadedmetadata = () => {
          console.log("Video element loaded metadata, starting to play");
          videoRef.current?.play().catch((e) => console.error("Error playing video:", e));
        };
      }

      // Reset chunks before starting new recording
      setRecordedChunks([]);
      setChunkTimestamps([]);

      // First start continuous recording
      startContinuousRecording();

      // Then start the timer for predictions
      startPredictionTimer();
    } catch (err) {
      console.error("Error accessing camera:", err);
      setErrorMessage(`Could not access camera: ${(err as unknown as any).message}`);
      setShowError(true);
    }
  }

  function stopCamera() {
    if (recorder) {
      console.log("Stopping recorder...");
      if (recorder.state === "recording") {
        recorder.stop();
      }
      setRecorder(null);
    }
    if (stream) {
      console.log("Stopping stream tracks...");
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (requestDataIntervalRef.current) {
      clearInterval(requestDataIntervalRef.current);
      requestDataIntervalRef.current = null;
    }
    if (predictionTimer) {
      clearInterval(predictionTimer)
      setPredictionTimer(null)
    }

    setCameraTime(0)
    setRecordedChunks([])
    setChunkTimestamps([])
  }

  useEffect(() => {
    if (inputMethod === "camera") {
      startCamera()
    } else {
      stopCamera()
    }

    return () => {
      stopCamera()
    }
  }, [inputMethod])

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="p-6 space-y-6 md:col-span-1">
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
                style={{ transform: "none" }} // Remove mirroring
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
              <p>Camera streaming in real time; predictions triggered every 30 seconds.</p>
            )}
          </div>
        </Card>

        <Card className="p-6 space-y-6 md:col-span-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictionResults.length > 0
                ? predictionResults.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.time}</TableCell>
                      <TableCell>{row.result}</TableCell>
                      <TableCell>{row.confidence}</TableCell>
                    </TableRow>
                  ))
                : mockData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{row.time}</TableCell>
                      <TableCell>{row.result}</TableCell>
                      <TableCell>{row.confidence}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="aspect-square bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={emotionData.length > 0 ? emotionData : pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius="80%"
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(emotionData.length > 0 ? emotionData : pieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="aspect-video bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceData.length > 0 ? confidenceData : histogramData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="confidence" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
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
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import Image from "next/image"

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
  const [visualizationImg, setVisualizationImg] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestDataIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastPredictionTimestamp = useRef<number>(Date.now())

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

  const COLORS = [
    "#000000",
    "#333333",
    "#666666",
    "#999999", 
    "#CCCCCC",  
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

      const data = await response.json()

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${data.error || response.statusText}`)
      }

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
        
        if (data.visualization) {
          setVisualizationImg(`data:image/png;base64,${data.visualization}`)
        }
      }
    } catch (err) {
      console.error("Prediction failed:", err)
      setErrorMessage("Prediction failed. Please try again.\n" + err)
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
    return '';  
  }

  function startContinuousRecording() {
    if (!stream) {
      console.error("No stream available");
      return;
    }
    
    try {
      if (typeof MediaRecorder === 'undefined') {
        throw new Error("MediaRecorder not supported in this browser");
      }
      
      const mimeType = getSupportedMimeType();
      
      const options = mimeType ? { mimeType } : undefined;
      console.log(`Creating MediaRecorder with options:`, options);
      
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorder.onstart = () => {
        console.log("MediaRecorder started");
      };
      
      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
      };
      
      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped");
      };
      
      mediaRecorder.ondataavailable = (event) => {
        console.log(`Data available event fired, data size: ${event.data?.size || 0} bytes`);
        
        if (event.data && event.data.size > 0) {
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

  function processLast30SecondsOfVideo() {
    console.log(`Processing - chunks available: ${recordedChunks.length}, timestamps: ${chunkTimestamps.length}`);

    if (recordedChunks.length === 0) {
      console.log("No video chunks available yet");
      return;
    }

    const now = Date.now();
    // Only look at chunks from the last 30 seconds
    const oldestAllowedTimestamp = now - 30000;

    // Gather the most recent chunks
    const recentChunks: Blob[] = [];
    for (let i = 0; i < chunkTimestamps.length; i++) {
      if (chunkTimestamps[i] >= oldestAllowedTimestamp) {
        recentChunks.push(recordedChunks[i]);
      }
    }

    if (recentChunks.length === 0) {
      console.log("No new chunks available in the last 30 seconds");
      return;
    }

    // Create a Blob for prediction
    const blob = new Blob(recentChunks, { type: "video/webm" });
    console.log(`Created blob of size: ${blob.size} bytes for the last 30s`);

    // Start polling & send the video data
    // (sendVideoForPrediction already calls startPredictProgressCheck, but be sure it is never skipped)
    sendVideoForPrediction(blob);

    // Remove only chunks older than 30 seconds
    const newRecordedChunks: Blob[] = [];
    const newChunkTimestamps: number[] = [];
    for (let i = 0; i < chunkTimestamps.length; i++) {
      if (chunkTimestamps[i] >= oldestAllowedTimestamp) {
        newRecordedChunks.push(recordedChunks[i]);
        newChunkTimestamps.push(chunkTimestamps[i]);
      }
    }
    setRecordedChunks(newRecordedChunks);
    setChunkTimestamps(newChunkTimestamps);
  }

  function startPredictionTimer() {
    if (predictionTimer) {
      clearInterval(predictionTimer);
    }

    console.log("Starting prediction timer");
    const timer = setInterval(() => {
      setCameraTime((prev) => {
        const newTime = prev + 1;

        if (newTime % 30 === 0) {
          console.log(`30-second mark reached (${newTime}s), processing recent video...`);
          processLast30SecondsOfVideo();
        }

        return newTime;
      });
    }, 1000);

    setPredictionTimer(timer);
    console.log("Prediction timer started");
  }

  async function startCamera() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support camera access");
      }

      console.log("Requesting camera and microphone access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false, 
      });

      console.log("Access granted to camera");

      if (!mediaStream) {
        throw new Error("Media stream is null or undefined");
      }

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.style.transform = "none"; 
        videoRef.current.onloadedmetadata = () => {
          console.log("Video element loaded metadata, starting to play");
          videoRef.current?.play().catch((e) => console.error("Error playing video:", e));
        };
      }

      setRecordedChunks([]);
      setChunkTimestamps([]);

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

  useEffect(() => {
    if (stream && inputMethod === "camera") {
      startContinuousRecording();
    }
  }, [stream, inputMethod]);

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
              <p>Camera streaming in real time; predictions triggered every 30 seconds.</p>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="aspect-square bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={emotionData.length > 0 ? emotionData : pieData}
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
                    {(emotionData.length > 0 ? emotionData : pieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
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
            {/* History Table Container */}
            <div className="flex-1 overflow-auto">
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
            </div>
            {/* Visualization Container */}
            {visualizationImg && (
              <div className="flex-1 mt-6 overflow-hidden">
                  <h3 className="text-lg font-semibold mt-2">Visualization</h3>
                <Image
                    src={visualizationImg}
                    alt="Video frames with emotion predictions"
                    className="w-full h-full object-contain"
                    layout="responsive"
                    width={800}
                    height={600}
                    priority
                />
              </div>
            )}
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
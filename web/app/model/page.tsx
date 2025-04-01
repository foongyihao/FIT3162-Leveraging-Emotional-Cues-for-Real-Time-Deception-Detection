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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ModelPage() {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("The selected file is either too large or in an unsupported format. Please select a video file under 100MB in MP4 format.")
  const [progress, setProgress] = useState(100)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [inputMethod, setInputMethod] = useState<"upload" | "camera">("upload")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraTime, setCameraTime] = useState(0)
  const [predictionTimer, setPredictionTimer] = useState<NodeJS.Timeout | null>(null)
  const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)
  const [predictionResults, setPredictionResults] = useState<Array<{
    time: string;
    result: string;
    confidence: string;
  }>>([]);
  const [emotionData, setEmotionData] = useState<Array<{ name: string; value: number }>>([]);
  const [confidenceData, setConfidenceData] = useState<Array<{ time: string; confidence: number }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const mockData = [
    { time: "0:02", result: "Deceptive", confidence: "95%" },
    { time: "0:05", result: "Truth", confidence: "87%" },
    { time: "0:08", result: "Truth", confidence: "92%" },
  ]

  const pieData = [
    { name: 'Happiness', value: 45 },
    { name: 'Surprise', value: 25 },
    { name: 'Contempt', value: 15 },
    { name: 'Neutral', value: 15 },
  ]

  const histogramData = [
    { time: '0:00', confidence: 85 },
    { time: '0:05', confidence: 92 },
    { time: '0:10', confidence: 78 },
    { time: '0:15', confidence: 95 },
    { time: '0:20', confidence: 88 },
    { time: '0:25', confidence: 90 },
  ]

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))']

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

  async function sendFileForPrediction(file: File) {
    setProgress(0);
    startPredictProgressCheck();

    const formData = new FormData();
    formData.append("video", file);

    try {
      const response = await fetch("http://localhost:5001/api/predict", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("Prediction result:", data);
      
      // Process prediction data for display
      if (data.prediction) {
        // Example: Format prediction as table row - adjust based on your actual data structure
        const predictionResult = {
          time: new Date().toLocaleTimeString(),
          result: data.prediction[0] > 0.5 ? "Deceptive" : "Truthful",
          confidence: `${Math.round(Math.abs(data.prediction[0] - 0.5) * 200)}%`
        };
        
        setPredictionResults(prev => [...prev, predictionResult]);
        
        // If emotions data is available in the response
        if (data.emotions) {
          setEmotionData(data.emotions);
        }
        
        // If confidence over time is available
        if (data.confidence_timeline) {
          setConfidenceData(data.confidence_timeline);
        }
      }
    } catch (err) {
      console.error("Prediction failed:", err);
      setErrorMessage("Prediction failed. Please try again.");
      setShowError(true);
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("video/")) {
      setShowError(true)
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      setShowError(true)
      return
    }

    const videoUrl = URL.createObjectURL(file)
    setVideoSrc(videoUrl)

    sendFileForPrediction(file)
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      startPredictionTimer()
    } catch (err) {
      console.error("Error accessing camera:", err)
      setErrorMessage("Could not access camera. Please check your permissions.")
      setShowError(true)
    }
  }

  function startPredictionTimer() {
    if (predictionTimer) clearInterval(predictionTimer)
    const timer = setInterval(() => {
      setCameraTime((prev) => {
        const newTime = prev + 1
        if (newTime % 30 === 0) {
          console.log("30-sec camera capture: call Python for prediction here.")
        }
        return newTime
      })
    }, 1000)
    setPredictionTimer(timer)
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
    if (predictionTimer) {
      clearInterval(predictionTimer)
      setPredictionTimer(null)
    }
    setCameraTime(0)
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
                style={{ transform: "none" }}
              />
            )}
          </div>

          <Select
            value={inputMethod}
            onValueChange={(value) => setInputMethod(value as "upload" | "camera")}
          >
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
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2"
                >
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
              {predictionResults.length > 0 ? (
                predictionResults.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.result}</TableCell>
                    <TableCell>{row.confidence}</TableCell>
                  </TableRow>
                ))
              ) : (
                mockData.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.time}</TableCell>
                    <TableCell>{row.result}</TableCell>
                    <TableCell>{row.confidence}</TableCell>
                  </TableRow>
                ))
              )}
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
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius="80%"
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {(emotionData.length > 0 ? emotionData : pieData).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                    ))}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="aspect-video bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceData.length > 0 ? confidenceData : histogramData}>
                  <CartesianGrid strokeDasharray="3 3"/>
                  <XAxis dataKey="time"/>
                  <YAxis domain={[0, 100]}/>
                  <Tooltip/>
                  <Bar dataKey="confidence" fill="hsl(var(--chart-1))"/>
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
            <AlertDialogDescription>
              {errorMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
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
import { Upload, Camera, Square, Circle } from "lucide-react"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function ModelPage() {
  const [showError, setShowError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("The selected file is either too large or in an unsupported format. Please select a video file under 100MB in MP4 format.")
  const [progress, setProgress] = useState(100)
  const [videoSrc, setVideoSrc] = useState<string>("")
  const [inputMethod, setInputMethod] = useState<"upload" | "camera">("upload")
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
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
  const MAX_RECORDING_TIME = 40 // seconds

  // Start the camera stream
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true
      });
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setErrorMessage("Could not access camera. Please check your permissions.");
      setShowError(true);
    }
  };

  // Stop the camera stream
  const stopCamera = () => {
    if (isRecording) {
      stopRecording();
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Start recording from camera
  const startRecording = () => {
    if (!stream) return;
    
    // Reset recording state
    setRecordingTime(0);
    setIsRecording(true);
    
    const chunks: Blob[] = [];
    
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    
    // When recording stops, set preview video and switch back to upload mode
    mediaRecorder.onstop = () => {
      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const videoUrl = URL.createObjectURL(blob);
        setVideoSrc(videoUrl);
      }
      setIsRecording(false);
      setInputMethod("upload"); // switch back to upload mode
    };
    
    mediaRecorder.start(1000); // Collect data every second
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const newTime = prev + 1;
        if (newTime >= MAX_RECORDING_TIME) {
          stopRecording();
          return MAX_RECORDING_TIME;
        }
        return newTime;
      });
    }, 1000);
  };

  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop media recorder
    mediaRecorderRef.current.stop();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file type
    if (!file.type.startsWith('video/')) {
      setShowError(true)
      return
    }

    // Check file size (100MB = 100 * 1024 * 1024 bytes)
    if (file.size > 100 * 1024 * 1024) {
      setShowError(true)
      return
    }

    // Create object URL for video preview
    const videoUrl = URL.createObjectURL(file)
    setVideoSrc(videoUrl)

    // Simulate upload progress
    setProgress(0)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle input method change
  useEffect(() => {
    if (inputMethod === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    
    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      stopCamera();
    };
  }, [inputMethod]);

  useEffect(() => {
    if (videoSrc && inputMethod === "upload") {
      const videoEl = document.getElementById("video-preview") as HTMLVideoElement;
      if (videoEl) {
        videoEl.load();
      }
    }
  }, [videoSrc, inputMethod]);

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
              // Camera view 
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ transform: "none" }} // Remove mirroring
                />
                {isRecording && (
                  <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-full flex items-center gap-2">
                    <div className="animate-pulse h-2 w-2 rounded-full bg-white" />
                    {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
                  </div>
                )}
              </>
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
                {progress < 100 && <Progress value={progress} className="w-full"/>}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="video/*"
                  className="hidden"
                  title="Upload Video"
                />
                <Button
                  onClick={handleUploadClick}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload Video
                </Button>
              </>
            ) : (
              <div className="flex gap-4">
                {isRecording ? (
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop Recording
                  </Button>
                ) : (
                  <Button
                    onClick={startRecording}
                    variant="default"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Circle className="h-4 w-4 fill-current" />
                    Start Recording
                  </Button>
                )}
              </div>
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
              {mockData.map((row, i) => (
                <TableRow key={i}>
                  <TableCell>{row.time}</TableCell>
                  <TableCell>{row.result}</TableCell>
                  <TableCell>{row.confidence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Charts container: flex column on small, row on md+ */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="aspect-square bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius="80%"
                      fill="#8884d8"
                      dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
                    ))}
                  </Pie>
                  <Tooltip/>
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="aspect-video bg-card rounded-lg flex items-center justify-center p-4 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData}>
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
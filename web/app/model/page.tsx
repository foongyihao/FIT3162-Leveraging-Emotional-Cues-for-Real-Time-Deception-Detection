"use client"

import {useState, useRef, useEffect} from "react"
import {Card} from "@/components/ui/card"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select"
import {Button} from "@/components/ui/button"
import {Progress} from "@/components/ui/progress"
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
import {Upload} from "lucide-react"
import {PieChart, Pie, Cell, ResponsiveContainer, Tooltip} from "recharts"
import Image from "next/image"

interface PredictionResult {
	time: string
	result: string
	confidence: string
	videoName: string
	emotions?: Array<{ name: string; value: number }>
	visualization?: string
	videoBlob?: Blob
}

export default function ModelPage() {
	const [showError, setShowError] = useState(false)
	const [errorMessage, setErrorMessage] = useState(
		"The selected file is either too large or in an unsupported format. Please select a video file under 100MB in MP4 format."
	)
	const [progress, setProgress] = useState(100)
	const [videoSrc, setVideoSrc] = useState<string>("")
	const [inputMethod, setInputMethod] = useState<"upload" | "camera">("upload")
	const [pollTimer, setPollTimer] = useState<NodeJS.Timeout | null>(null)
	const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
	const [predictionResults, setPredictionResults] = useState<PredictionResult[]>([])
	const [selectedPrediction, setSelectedPrediction] = useState<PredictionResult | null>(null)
	const [countdown, setCountdown] = useState<number>(0)

	const isCameraActiveRef = useRef(false)
	const isMountedRef = useRef(false)
	const cameraStreamRef = useRef<MediaStream | null>(null)

	const fileInputRef = useRef<HTMLInputElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

	const mockData: PredictionResult[] = [
		{time: "0:02", result: "Deceptive", confidence: "95%", videoName: "-"},
		{time: "0:05", result: "Truth", confidence: "87%", videoName: "-"},
		{time: "0:08", result: "Truth", confidence: "92%", videoName: "-"},
	]

	const pieData = [
		{name: "Happiness", value: 45},
		{name: "Surprise", value: 25},
		{name: "Contempt", value: 15},
		{name: "Neutral", value: 15},
	]

	const COLORS = [
		"#000000",
		"#333333",
		"#666666",
		"#999999",
		"#CCCCCC",
	]

	/**
	 * handleError:
	 *   Sets the error message state and displays the error dialog.
	 *   Also logs the error to the console.
	 * @param message - The user-facing error message.
	 * @param error - Optional error object for console logging.
	 */
	const handleError = (message: string, error?: unknown) => {
		console.error(message, error); // Keep console log for debugging
		const detailedMessage = error instanceof Error ? `${message}\n${error.message}` : message;
		setErrorMessage(detailedMessage);
		setShowError(true);
	};

	/**
	 * startPredictProgressCheck:
	 *   Starts polling the /api/progress endpoint every 500ms,
	 *   updating the `progress` state until it reaches 100%.
	 *   Returns the interval ID for cleanup.
	 */
	const startPredictProgressCheck = () => {
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
		return timer
	}

	/**
	 * sendVideoForPrediction:
	 *   Uploads a video Blob or File to the /api/predict endpoint,
	 *   handles errors, and updates `predictionResults`, `emotionData`,
	 *   and `visualizationImg` based on the server response.
	 *   Also stores the video blob/file with the result.
	 */
	const sendVideoForPrediction = async (videoData: File | Blob) => {
		// Only start progress check - don't manually set progress
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
				let storedBlob: Blob;
				if (videoData instanceof File) {
					const buffer = await videoData.arrayBuffer();
					storedBlob = new Blob([buffer], { type: videoData.type });
				} else {
					storedBlob = new Blob([await videoData.arrayBuffer()], { 
						type: videoData.type || 'video/webm' 
					});
				}

				const predictionResult: PredictionResult = {
					time: new Date().toLocaleTimeString(),
					result: data.result || (data.prediction[0] > 0.5 ? "Deceptive" : "Truthful"),
					confidence: data.confidence || `${Math.round(Math.abs(data.prediction[0] - 0.5) * 200)}%`,
					videoName: videoData instanceof File && videoData.name ? videoData.name : fileName,
					emotions: data.emotions,
					visualization: data.visualization ? `data:image/png;base64,${data.visualization}` : undefined,
					videoBlob: storedBlob,
				}

				setPredictionResults((prev) => [...prev, predictionResult])
				if (!selectedPrediction) {
					setSelectedPrediction(predictionResult)
				}
			}
		} catch (err) {
			handleError("Prediction failed. Please try again.", err);
		}
	}

	/**
	 * handleFileSelect:
	 *   Validates an uploaded file (type & size), generates a preview URL,
	 *   and invokes `sendVideoForPrediction`.
	 */
	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) return

		if (!file.type.startsWith("video/")) {
			handleError("Please select a valid video file.");
			return
		}

		if (file.size > 100 * 1024 * 1024) {
			handleError("File is too large. Please select a video under 100MB.");
			return
		}

		if (videoSrc && videoSrc.startsWith("blob:")) {
			URL.revokeObjectURL(videoSrc)
			console.log("Revoked previous videoSrc URL (file select):", videoSrc)
		}

		const videoUrl = URL.createObjectURL(file)
		setVideoSrc(videoUrl)

		sendVideoForPrediction(file)
	}

	/**
	 * handlePredictionSelect:
	 *   Sets the selected prediction, switches the view to 'upload' mode,
	 *   and displays the video associated with the selected prediction.
	 *   Manages object URL creation and revocation for the video preview.
	 */
	const handlePredictionSelect = async (prediction: PredictionResult) => {
		setSelectedPrediction(prediction)

		if (videoSrc && videoSrc.startsWith("blob:")) {
			URL.revokeObjectURL(videoSrc)
			console.log("Revoked previous videoSrc URL:", videoSrc)
		}

		if (prediction.videoBlob) {
			try {
				console.log("Creating object URL from blob:", 
					prediction.videoBlob.size, 
					"bytes, type:", 
					prediction.videoBlob.type);
				
				const blobWithProperType = new Blob(
					[await prediction.videoBlob.arrayBuffer()], 
					{ type: 'video/webm' }
				);
				
				const newVideoUrl = URL.createObjectURL(blobWithProperType);
				console.log("Created new videoSrc URL:", newVideoUrl);
				
				setInputMethod("upload");
				
				setTimeout(() => {
					setVideoSrc(newVideoUrl);
					
					setTimeout(() => {
						const videoEl = document.getElementById("video-preview") as HTMLVideoElement;
						if (videoEl) {
							videoEl.load();
							videoEl.play().catch(e => console.log("Couldn't autoplay:", e));
						}
					}, 100);
				}, 50);
				
			} catch (error) {
				handleError("Could not display the selected video.", error);
				setVideoSrc("")
				setInputMethod("upload")
			}
		} else {
			console.warn("Selected prediction has no video data.")
			setVideoSrc("")
			setInputMethod("upload") 
		}
	}

	/**
	 * getSupportedMimeType:
	 *   Returns the first supported MediaRecorder MIME type from a list,
	 *   falling back to default if none match.
	 */
	const getSupportedMimeType = () => {
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
	}

	/**
	 * stopCamera:
	 *   Stops the MediaRecorder (if recording), stops all camera tracks,
	 *   clears the video element source, and resets related state.
	 */
	const stopCamera = () => {
		if (!isCameraActiveRef.current) {
			console.log("stopCamera: Camera is already inactive.")
			return
		}
		console.log("--- stopCamera called ---")
		isCameraActiveRef.current = false

		if (countdownIntervalRef.current) {
			clearInterval(countdownIntervalRef.current)
			countdownIntervalRef.current = null
		}
		setCountdown(0)

		setRecorder(prevRecorder => {
			if (prevRecorder && prevRecorder.state === "recording") {
				console.log(`stopCamera: Recorder found (state: ${prevRecorder.state}). Stopping.`)
				prevRecorder.stop()
				console.log("stopCamera: Recorder stop() called.")
			}
			return null
		})

		// --- Added: Stop media stream tracks ---
		if (cameraStreamRef.current) {
			cameraStreamRef.current.getTracks().forEach(track => track.stop())
			cameraStreamRef.current = null
		}
		if (videoRef.current && videoRef.current.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream;
			console.log("stopCamera: Getting tracks from stream:", stream);
			const tracks = stream.getTracks();
			console.log(`stopCamera: Found ${tracks.length} tracks.`);
			tracks.forEach(track => {
				console.log(`stopCamera: Stopping track: ${track.kind} (${track.label})`);
				track.stop();
			});
			videoRef.current.srcObject = null; // Clear the source *after* stopping tracks
			console.log("stopCamera: Cleared video element source and stopped tracks.");
		} else {
			console.log("stopCamera: No active stream found on video element.");
		}

		console.log("--- stopCamera finished ---")
	}

	/**
	 * createContinuousRecorder:
	 *   Creates a MediaRecorder on the provided stream that records 30s chunks.
	 *   Handles onstart, ondataavailable (triggers prediction), onerror,
	 *   and onstop events, and manages a countdown timer.
	 */
	const createContinuousRecorder = (mediaStream: MediaStream) => {
		if (!mediaStream) {
			console.error("No stream available for recording")
			return
		}
		setRecorder(prevRecorder => {
			if (prevRecorder) {
				console.log("Recorder already exists.")
				return prevRecorder
			}

			try {
				if (typeof MediaRecorder === 'undefined') {
					throw new Error("MediaRecorder not supported in this browser")
				}

				const mimeType = getSupportedMimeType()
				const options = mimeType ? {mimeType} : undefined
				console.log(`Creating MediaRecorder with options:`, options)

				const newMediaRecorder = new MediaRecorder(mediaStream, options)

				newMediaRecorder.onstart = () => {
					console.log("MediaRecorder started with 30s timeslice")
					setCountdown(30)
					
					// Start progress polling when recording starts - it will show 0%
					// until the backend starts processing
					startPredictProgressCheck()
					
					// Only update countdown, not progress
					if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
					countdownIntervalRef.current = setInterval(() => {
						setCountdown(prev => (prev > 0 ? prev - 1 : 0))
					}, 1000)
				}

				newMediaRecorder.onerror = (event) => {
					// Access the specific error if available
					const error = (event as any)?.error;
					handleError("Recording error occurred.", error);
					stopCamera()
				}

				newMediaRecorder.onstop = () => {
					console.log("MediaRecorder stopped")
					if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
					setCountdown(0)
					// Keep progress polling active to show processing progress
				}

				newMediaRecorder.ondataavailable = (event) => {
					console.log(`ondataavailable: Event fired. Data size: ${event.data?.size || 0} bytes`)
					if (inputMethod === 'camera') {
						setCountdown(30) // Reset countdown for the next chunk
						if (event.data && event.data.size > 0) {
							console.log("ondataavailable: Blob received with type:", event.data.type)
							
							const chunk = new Blob([event.data], { 
								type: event.data.type || 'video/webm;codecs=vp9,opus' 
							});
							
							console.log("Created new blob:", chunk.size, "bytes, type:", chunk.type);
							sendVideoForPrediction(chunk) // Send chunk for prediction
						} else {
							console.warn("Received empty data in ondataavailable event")

						}
					} else {
						// If not in camera mode anymore when data becomes available, stop countdown
						if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
						setCountdown(0)
					}
				}
				return newMediaRecorder

			} catch (err) {
				handleError("Failed to initialize camera recording.", err);
				return null
			}
		})
	}

	/**
	 * startCamera:
	 *   Requests camera access, attaches the stream to the video element,
	 *   and invokes `startContinuousRecording` once playback begins.
	 */
	const startCamera = async () => {
		if (isCameraActiveRef.current) {
			console.log("startCamera: Camera is already active.")
			return
		}
		console.log(">>> startCamera called <<<")
		isCameraActiveRef.current = true

		try {
			console.log("startCamera: Requesting camera access...")
			const mediaStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: false,
			})

			console.log("startCamera: Access granted.")

			cameraStreamRef.current = mediaStream

			if (videoRef.current) {
				videoRef.current.srcObject = mediaStream
				videoRef.current.style.transform = "none"
				videoRef.current.onloadedmetadata = () => {
					console.log("startCamera: video metadata loaded.")
					videoRef.current?.play().then(() => {
						console.log("startCamera: video playback started, calling startContinuousRecording.")
						createContinuousRecorder(mediaStream)
					}).catch(e => {
						handleError("Error playing camera preview.", e);
						stopCamera(); // Stop camera if playback fails
					})
				}
			} else {
				handleError("Video element not found. Cannot start camera.");
				isCameraActiveRef.current = false; // Ensure state reflects failure
			}
		} catch (err) {
			handleError("Could not access camera.", err);
			isCameraActiveRef.current = false
		}
		console.log(">>> startCamera finished <<<")
	}

	/**
	 * useEffect hook to handle changes in the input method.
	 * Starts the camera if 'camera' is selected, stops it otherwise.
	 * Also handles cleanup on component unmount or when inputMethod changes again.
	 */
	useEffect(() => {
		if (!isMountedRef.current) {
			isMountedRef.current = true
			return // Skip first render
		}
		if (inputMethod === "camera") {
			console.log("Input method changed to camera, starting...")
			startCamera()
		} else {
			console.log("Input method changed to upload, stopping camera...")
			stopCamera()
		}

		// Cleanup function: ensures camera is stopped when the effect re-runs or component unmounts.
		return () => {
			console.log("Cleanup: Stopping camera due to input method change or unmount...")
			stopCamera()
			if (videoSrc && videoSrc.startsWith("blob:")) {
				URL.revokeObjectURL(videoSrc)
				console.log("Cleanup: Revoked videoSrc URL:", videoSrc)
			}
		}
	}, [inputMethod]) // Dependency: Re-run when inputMethod changes

	/**
	 * useEffect hook to handle changes in the video source URL when in 'upload' mode.
	 * Loads and attempts to play the new video when `videoSrc` changes.
	 */
	useEffect(() => {
		if (videoSrc && inputMethod === "upload") {
			console.log("Video source changed, loading:", videoSrc);
			const videoEl = document.getElementById("video-preview") as HTMLVideoElement;
			if (videoEl) {
				videoEl.load(); // Ensure the new source is loaded
				videoEl.play().catch(e => {
					handleError("Couldn't automatically play the selected video.", e);
				});
			}
		}
	}, [videoSrc, inputMethod]); // Dependencies: Re-run when videoSrc or inputMethod changes

	/**
	 * useEffect hook to start the MediaRecorder when it's created and the input method is 'camera'.
	 * This ensures recording starts only when the recorder instance is ready and camera mode is active.
	 */
	useEffect(() => {
		// Only start if recorder exists and we are in camera mode
		if (!recorder || inputMethod !== "camera") return

		console.log("Starting MediaRecorder with 30000ms timeslice")
		recorder.start(30000)
		console.log("MediaRecorder state after start:", recorder.state)

	}, [inputMethod, recorder]);

	useEffect(() => {
		return () => {
			if (videoSrc && videoSrc.startsWith("blob:")) {
				URL.revokeObjectURL(videoSrc);
				console.log("Unmount cleanup: Revoked URL:", videoSrc);
			}
		}
	}, [inputMethod, recorder]); // Dependencies: Re-run when inputMethod or recorder instance changes

	return (
		<main className="container mx-auto px-4 py-8">
			<canvas ref={canvasRef} style={{display: "none"}}/>

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
									playsInline
									key={videoSrc}
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
								style={{transform: "none"}}
							/>
						)}
						{inputMethod === 'camera' && countdown > 0 && (
							<div className="absolute top-2 left-2 bg-red-600 text-white text-lg font-bold px-3 py-1 rounded shadow">
								{countdown}
							</div>
						)}
					</div>

					<Select value={inputMethod} onValueChange={(value) => setInputMethod(value as "upload" | "camera")}>
						<SelectTrigger>
							<SelectValue placeholder="Select input method"/>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="upload">Upload Video</SelectItem>
							<SelectItem value="camera">Camera</SelectItem>
						</SelectContent>
					</Select>

					<div className="space-y-4">
						{progress < 100 && <Progress value={progress} className="w-full"/>}
						{inputMethod === "upload" ? (
							<>
								<input
									type="file"
									ref={fileInputRef}
									onChange={handleFileSelect}
									accept="video/*"
									className="hidden"
									title="Upload Video"
								/>
								<Button onClick={() => fileInputRef.current?.click()}
								        className="w-full flex items-center justify-center gap-2">
									<Upload className="h-4 w-4"/>
									Upload Video
								</Button>
							</>
						) : (
							<>
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
										labelLine={{strokeWidth: 1, stroke: "gray", strokeOpacity: 0.5}}
									>
										{(selectedPrediction && selectedPrediction.emotions ? selectedPrediction.emotions : pieData)
											.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
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
												onClick={() => handlePredictionSelect(row)}
												className={`cursor-pointer hover:bg-muted ${selectedPrediction === row ? 'bg-muted' : ''}`}
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
						<AlertDialogDescription style={{ whiteSpace: 'pre-wrap' }}>
							{errorMessage}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction onClick={() => setShowError(false)}>OK</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	)
}
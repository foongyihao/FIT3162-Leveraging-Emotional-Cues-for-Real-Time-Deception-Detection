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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import {
	Upload,
	Clock,
	AlertCircle,
	Info,
	Database,
	HelpCircle,
	FileText,
	Check,
	CheckCircle2,
	Trash2,
	Eye,
	Download,
	X,
	CheckCircle,
	XCircle
} from "lucide-react"
import {PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip} from "recharts"
import Image from "next/image"
import {Checkbox} from "@/components/ui/checkbox"

interface PredictionResult {
	time: string
	result: string
	confidence: string
	videoName: string
	emotions?: Array<{ name: string; value: number }>
	visualization?: string
	videoBlob?: Blob
	error?: string // Add an optional error field
	id?: string // Add unique id for selection
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
	const [elapsedTime, setElapsedTime] = useState<number>(0) // Replace countdown with elapsedTime
	const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
	const [isExporting, setIsExporting] = useState(false)
	const [showExportDialog, setShowExportDialog] = useState(false)
	const [showPreviewDialog, setShowPreviewDialog] = useState(false)
	const [previewImageSrc, setPreviewImageSrc] = useState<string>("")
	const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
	const INTERVAL_TIME = 10

	const isCameraActiveRef = useRef(false)
	const isMountedRef = useRef(false)
	const cameraStreamRef = useRef<MediaStream | null>(null)
	const recorderRef = useRef<MediaRecorder | null>(null) // Use a ref to access the current recorder instance reliably

	const fileInputRef = useRef<HTMLInputElement>(null)
	const videoRef = useRef<HTMLVideoElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null) // Rename from countdownIntervalRef

	const COLORS = [
		"rgba(0,0,0,0.7)",
		"rgba(51,51,51,0.8)",
		"rgba(102,102,102,0.8)",
		"rgba(153,153,153,0.8)",
		"rgba(204,204,204,0.8)",
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
	 * formatTimeRemaining:
	 *   Formats seconds into MM:SS display format
	 * @param totalSeconds - Seconds to format
	 * @returns formatted time string
	 */
	const formatTimeRemaining = (totalSeconds: number): string => {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	};

	/**
	 * getRemainingSeconds:
	 *   Calculate remaining seconds until next interval mark
	 * @returns number of seconds remaining
	 */
	const getRemainingSeconds = (): number => {
		return INTERVAL_TIME - (elapsedTime % INTERVAL_TIME);
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
	 *   Also stores the video blob/file with the result, even on failure.
	 */
	const sendVideoForPrediction = async (videoData: File | Blob) => {
		startPredictProgressCheck();
		const formData = new FormData();
		const fileName = videoData instanceof File ? videoData.name : `live_recording_${new Date().toISOString()}.webm`;
		formData.append("video", videoData, fileName);

		let storedBlob = videoData; // Use the original Blob directly

		try {
			const response = await fetch("http://localhost:5001/api/predict", {
				method: "POST",
				body: formData,
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(`Server responded with ${response.status}: ${data.error || response.statusText}`);
			}

			const predictionResult: PredictionResult = {
				time: new Date().toLocaleTimeString(),
				result: data.result || (data.prediction[0] > 0.5 ? "Deceptive" : "Truthful"),
				confidence: data.confidence || `${Math.round(Math.abs(data.prediction[0] - 0.5) * 200)}%`,
				videoName: videoData instanceof File && videoData.name ? videoData.name : fileName,
				emotions: data.emotions,
				visualization: data.visualization ? `data:image/png;base64,${data.visualization}` : undefined,
				videoBlob: storedBlob,
				id: `pred_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
			};

			setPredictionResults((prev) => [...prev, predictionResult]);
			// if (!selectedPrediction) {
				handlePredictionSelect(predictionResult);
			// }
		} catch (err) {
			const errorMessage = err instanceof Error
			    ? err.message.replace(/(?:Error: )?(?:Server responded with (?:\d+|[^:]+): )?/, "").trim()
			    : "An unknown error.";
			handleError(`"${errorMessage}" \n\n- By the model`);
			console.log(err);
			const failureResult: PredictionResult = {
				time: new Date().toLocaleTimeString(),
				result: "Prediction Failed",
				confidence: "-",
				videoName: fileName,
				videoBlob: storedBlob,
				error: errorMessage,
				id: `pred_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
			};
			setPredictionResults((prev) => [...prev, failureResult]);
		} finally {
			if (pollTimer) {
				clearInterval(pollTimer);
				setPollTimer(null);
			}
			setProgress(100);
		}
	};

	/**
	 * toggleRowSelection:
	 *   Toggle the selection state of a prediction row
	 */
	const toggleRowSelection = (id?: string) => {
		if (!id) return;

		setSelectedRows(prev => {
			const newSelection = new Set(prev);
			if (newSelection.has(id)) {
				newSelection.delete(id);
			} else {
				newSelection.add(id);
			}
			return newSelection;
		});
	};

	/**
	 * selectAllRows:
	 *   Select all valid prediction rows
	 */
	const selectAllRows = () => {
		const allIds = predictionResults
			.filter(result => !result.error) // Only select valid results
			.map(result => result.id)
			.filter(Boolean) as string[];

		setSelectedRows(new Set(allIds));
	};

	/**
	 * clearSelection:
	 *   Clear all selected rows
	 */
	const clearSelection = () => {
		setSelectedRows(new Set());
	};

	/**
	 * deleteSelected:
	 *   Remove selected rows from prediction results
	 */
	const deleteSelected = () => {
		setPredictionResults(prev =>
			prev.filter(result => !result.id || !selectedRows.has(result.id))
		);
		clearSelection();
	};

	/**
	 * downloadPdf:
	 *   Download the generated PDF file
	 */
	const downloadPdf = () => {
		if (!pdfBlob) return;

		const url = URL.createObjectURL(pdfBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `deception_analysis_${new Date().toISOString().slice(0, 10)}.pdf`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		setShowPreviewDialog(false);
		setShowExportDialog(true);
	};

	/**
	 * createReportContent:
	 *   Create the HTML content for the report
	 */
	const createReportContent = (selectedResults: PredictionResult[]) => {
		// Create a temporary container for generating the report content
		const reportContainer = document.createElement('div');
		reportContainer.style.padding = '30px';
		reportContainer.style.width = '800px'; // Fixed width for consistent rendering
		reportContainer.style.fontFamily = 'Arial, sans-serif';
		reportContainer.style.backgroundColor = 'white';

		// Add modern header with title
		reportContainer.innerHTML = `
		<div style="margin-bottom: 30px;">
			<h1 style="margin: 0; color: #000000; font-size: 32px; font-weight: 600; letter-spacing: -0.5px;">Deception Detection Report</h1>
			<p style="margin: 8px 0 0; color: #555555; font-size: 15px;">${new Date().toLocaleString()}</p>
			<div style="width: 60px; height: 4px; background-color: #000000; margin-top: 15px;"></div>
		</div>
	`;

		// Add summary section with modern styling
		const truthCount = selectedResults.filter(r => r.result === "Truthful").length;
		const deceptiveCount = selectedResults.filter(r => r.result === "Deceptive").length;
		const errorCount = selectedResults.filter(r => r.result === "Prediction Failed").length;

		reportContainer.innerHTML += `
		<div style="margin-bottom: 40px; background-color: #f8f8f8; padding: 25px; border-radius: 8px;">
			<h2 style="margin-top: 0; margin-bottom: 15px; font-size: 20px; font-weight: 500; color: #000000;">Analysis Summary</h2>
			<div style="display: flex; gap: 15px; margin-bottom: 20px;">
				<div style="flex: 1; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
					<div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 5px;">Total Analyzed</div>
					<div style="font-size: 28px; font-weight: 600; color: #000;">${selectedResults.length}</div>
				</div>
				<div style="flex: 1; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
					<div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 2px;">Truthful</div>
					<div style="font-size: 28px; font-weight: 600; color: #000;">${truthCount}</div>
				</div>
				<div style="flex: 1; padding: 15px; background-color: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
					<div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 2px;">Deceptive</div>
					<div style="font-size: 28px; font-weight: 600; color: #000;">${deceptiveCount}</div>
				</div>
			</div>
		</div>
		`;

		// Add results list heading
		reportContainer.innerHTML += `
		<h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: 500; color: #000;">Analysis Results</h2>
		`;

		// Loop through each selected result with modern styling
		for (const result of selectedResults) {
			const card = document.createElement('div');
			card.style.marginBottom = '40px';
			card.style.backgroundColor = 'white';
			card.style.borderRadius = '8px';
			card.style.overflow = 'hidden';
			card.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';

			if (result.error) {
				card.innerHTML = `
					<div style="padding:25px">
						<div style="display:flex;align-items:center;margin-bottom:15px">
							<div style="background-color:#f5f5f5;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-right:15px">
								<div style="width:18px;height:18px;background-color:#999;border-radius:50%"></div>
							</div>
							<div>
								<h3 style="margin:0 0 4px 0;font-size:18px;font-weight:500;color:#666">
									${result.videoName}
								</h3>
								<p style="margin:0;color:#888;font-size:14px">
									${result.time}
								</p>
							</div>
						</div>
						<div style="padding:20px;background-color:#f9f9f9;border-radius:6px;color:#666;font-size:15px">
							Analysis failed: ${result.error}
						</div>
					</div>
				`;
			} else {
				const color = result.result === 'Truthful' ? '#05402C' : '#800000';
				const confidence = parseInt(result.confidence || '50', 10);
				const viz = result.visualization
					? `<div style="margin-bottom:20px">
							<img src="${result.visualization}" 
								style="width:100%;max-height:250px;object-fit:contain;filter:grayscale(100%);border-radius:4px" />
						</div>`
					: '';

				// Build emotion rows all at once
				const rows = result.emotions?.map(e => `
					<tr>
						<td style="padding:10px;border-bottom:1px solid #eee;color:#555">
							${e.name}
						</td>
						<td style="padding:10px;text-align:right;border-bottom:1px solid #eee">
							<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px">
								<div style="width:100px;background-color:#eee;height:6px;border-radius:3px">
									<div style="height:6px;border-radius:6px;background-color:#555;width:${e.value}%"></div>
								</div>
								<span style="font-size:14px;color:#555">
									${Math.round(e.value)}%
								</span>
							</div>
						</td>
					</tr>
				`).join('') ?? '';

				card.innerHTML = `
					<div style="padding:25px">
						<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
							<div>
								<h3 style="font-size:18px;font-weight:500;color:#333;margin:0">
									${result.videoName}
								</h3>
								<p style="color:#888;font-size:14px;margin:2px 0 0">
									${result.time}
								</p>
							</div>
						</div>

						<div style="
							display:flex;
							justify-content:space-between;
							align-items:center;
							background-color:#ECECEC;
							margin:20px 0;
							border-radius:8px;
							padding:20px;
						">
							<p style="font-size:24px;font-weight:600;color:${color}">
								${result.result}
							</p>
							<p style="font-size:14px;color:#333">
								Confidence: ${confidence}%
							</p>
						</div>

						${viz}

						${rows
								? `<table style="width:100%;border-collapse:collapse;font-size:14px">
							<thead>
								<tr style="background-color:#f5f5f5">
									<th style="padding:10px;text-align:left;border-bottom:1px solid #eee;color:#333;font-weight:500">
										Emotion
									</th>
									<th style="padding:10px;text-align:right;border-bottom:1px solid #eee;color:#333;font-weight:500">
										Intensity
									</th>
								</tr>
							</thead>
							<tbody>${rows}</tbody>
						</table>`
								: ''
							}
					</div>
				`;
			}

			reportContainer.appendChild(card);
		}


		return reportContainer;
	};

	/**
	 * generatePreview:
	 *   Generate a preview image of the PDF and show the preview dialog
	 */
	const generatePreview = async () => {
		if (selectedRows.size === 0) return;

		try {
			setIsExporting(true);

			// Filter and sort selected results
			const selectedResults = predictionResults
				.filter(result => result.id && selectedRows.has(result.id))
				.sort((a, b) => a.time.localeCompare(b.time));

			// Create report content
			const reportContainer = createReportContent(selectedResults);

			// Temporarily add container to document for rendering
			reportContainer.style.position = 'absolute';
			reportContainer.style.left = '-9999px';
			document.body.appendChild(reportContainer);

			try {
				// Dynamically import html2canvas
				const html2canvas = await import('html2canvas');

				// Generate preview image for the preview dialog
				const canvas = await html2canvas.default(reportContainer, {
					scale: 2, // Higher quality
					useCORS: true,
					logging: false,
				});

				// Convert to image for preview
				const previewImage = canvas.toDataURL('image/png');
				setPreviewImageSrc(previewImage);

				// Generate PDF with proper pagination
				const jsPDF = await import('jspdf');
				const doc = new jsPDF.default({
					orientation: 'portrait',
					unit: 'mm',
					format: 'a4'
				});

				const imgWidth = 210; // A4 width in mm
				const pageHeight = 297; // A4 height in mm
				const imgHeight = (canvas.height * imgWidth) / canvas.width;
				
				// Handle multi-page content
				let heightLeft = imgHeight;
				let position = 0;
				let pageCount = 0;
				
				// Add first page
				doc.addImage(previewImage, 'PNG', 0, position, imgWidth, imgHeight);
				heightLeft -= pageHeight;
				
				// Add additional pages if content doesn't fit on one page
				while (heightLeft > 0) {
					pageCount++;
					position = -pageHeight * pageCount;
					doc.addPage();
					doc.addImage(previewImage, 'PNG', 0, position, imgWidth, imgHeight);
					heightLeft -= pageHeight;
				}

				// Store PDF as blob for later download
				const pdfOutput = doc.output('blob');
				setPdfBlob(pdfOutput);

				// Show preview dialog
				setShowPreviewDialog(true);

			} catch (err) {
				console.error('Error generating preview:', err);
				handleError('Failed to generate report preview', err);
			}

			// Clean up
			document.body.removeChild(reportContainer);

		} catch (err) {
			handleError('Failed to generate report preview', err);
		} finally {
			setIsExporting(false);
		}
	};

	/**
	 * exportToPdf:
	 *   Just calls generate preview now - actual export happens in downloadPdf
	 */
	const exportToPdf = async () => {
		if (selectedRows.size === 0) return;
		await generatePreview();
	};

	/**
	 * checkWMV3Encoding:
	 *   Checks if a video blob contains WMV3 encoding by examining its header bytes
	 * @param blob - The video blob to check
	 * @returns Promise<boolean> indicating if the file is likely WMV3 encoded
	 */
	const checkWMV3Encoding = async (blob: Blob): Promise<boolean> => {
		try {
			const buffer = await blob.slice(0, 12).arrayBuffer();
			const header = new Uint8Array(buffer);

			// WMV3 files typically start with these bytes
			const wmv3Signature = [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11];

			// Check if the header matches WMV3 signature
			return wmv3Signature.every((byte, index) => header[index] === byte);
		} catch (error) {
			console.warn('Error checking WMV3 encoding:', error);
			return false;
		}
	};

	/**
	 * checkVideoFormatSupport:
	 *   Checks if the video format is supported and handles errors consistently.
	 * @param videoName - The name of the video file.
	 * @param mimeType - The MIME type of the video.
	 * @param isLikelyWMV3 - Whether the video is likely in WMV3 format.
	 */
	const checkVideoFormatSupport = (videoName: string, mimeType: string, isLikelyWMV3: boolean) => {
		const errorMsg = isLikelyWMV3
			? `WMV3 video format cannot be played in browsers. ` +
			`\n\nThe prediction analysis will still worked, but video preview is not available.` +
			`\n\nPlease convert to other supported format (e.g. MP4) for full functionality.`
			: `This video format (${mimeType}) is not supported in your browser.` +
			`\n\nPlease convert to other supported format (e.g. MP4) for full functionality or use another browser like Chrome`;

		handleError(errorMsg);
	};

	/**
	 * handleFileSelect:
	 *   Validates an uploaded file (type & size), generates a preview URL,
	 *   and invokes `sendVideoForPrediction`.
	 */
	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		// More comprehensive format check
		const isVideoFile =
			file.type.startsWith("video/") ||
			/\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv|3gp|wmv3)$/i.test(file.name);

		// Check specifically for WMV3 to show a direct warning
		const isWMV3 = /\.wmv3$/i.test(file.name);
		
		if (isWMV3) {
			checkVideoFormatSupport(file.name, "video/x-ms-wmv", true);
			// Continue with the upload despite the warning
		} else if (!isVideoFile) {
			handleError(
				"Please select a valid video file. Supported formats include MP4, WebM, MOV, AVI, WMV, WMV3, FLV, MKV, and more."
			);
			return;
		}

		if (file.size > 100 * 1024 * 1024) {
			handleError("File is too large. Please select a video under 100MB.");
			return;
		}

		if (videoSrc && videoSrc.startsWith("blob:")) {
			URL.revokeObjectURL(videoSrc);
			console.log("Revoked previous videoSrc URL (file select):", videoSrc);
		}

		const videoUrl = URL.createObjectURL(file);
		setVideoSrc(videoUrl);

		sendVideoForPrediction(file);
	};

	/**
	 * playVideoToPreview:
	 *   Plays the video from a Blob, setting the source URL and handling format checks.
	 * @param videoBlob - The Blob containing the video data.
	 * @param videoName - The name of the video file.
	 */
	const playVideoToPreview = async (videoBlob: Blob, videoName: string) => {
		// Don't play video if the input method is camera
		if (inputMethod === "camera") {
			return
		}

		try {
			console.log(
				"Creating object URL from blob:",
				videoBlob.size,
				"bytes, type:",
				videoBlob.type
			);

			// Check if this is likely a WMV3 file
			const isWMV3 = await checkWMV3Encoding(videoBlob);

			// Detect appropriate MIME type based on original file name
			let mimeType = "video/webm"; // default
			const fileName = videoName.toLowerCase();

			if (fileName.endsWith(".mp4")) mimeType = "video/mp4";
			else if (fileName.endsWith(".webm")) mimeType = "video/webm";
			else if (fileName.endsWith(".ogg") || fileName.endsWith(".ogv"))
				mimeType = "video/ogg";
			else if (fileName.endsWith(".mov")) mimeType = "video/quicktime";
			else if (fileName.endsWith(".wmv")) mimeType = "video/x-ms-wmv";
			else if (fileName.endsWith(".wmv3")) mimeType = "video/x-ms-wmv"; // Map WMV3 to MS-WMV MIME type
			else if (fileName.endsWith(".avi")) mimeType = "video/x-msvideo";
			else if (fileName.endsWith(".flv")) mimeType = "video/x-flv";
			else if (fileName.endsWith(".mkv")) mimeType = "video/x-matroska";
			else if (fileName.endsWith(".3gp")) mimeType = "video/3gpp";

			const blobWithProperType = new Blob(
				[await videoBlob.arrayBuffer()],
				{type: mimeType}
			);

			const newVideoUrl = URL.createObjectURL(blobWithProperType);
			console.log(
				`Created new videoSrc URL with MIME type ${mimeType}:`,
				newVideoUrl
			);

			setInputMethod("upload");

			// For WMV3 files, show a warning before even trying to play
			if (isWMV3) {
				handleError(
					"WMV3 videos cannot be played in most browsers. While the prediction analysis will work, the video preview may not be available. For best results, convert your videos to MP4 format."
				);
			}

			// Set video source and add format support info
			setTimeout(() => {
				setVideoSrc(newVideoUrl);

				setTimeout(() => {
					const videoEl = document.getElementById("video-preview") as HTMLVideoElement;
					if (videoEl) {
						videoEl.addEventListener(
							"error",
							() => checkVideoFormatSupport(videoName, mimeType, isWMV3),
							{once: true}
						);

						videoEl.load();
						videoEl.play().catch((e) => {
							if (e.name === "NotSupportedError") {
								checkVideoFormatSupport(videoName, mimeType, isWMV3);
							}
						});
					}
				}, 100);
			}, 50);
		} catch (error) {
			handleError("Could not display the selected video.", error);
			setVideoSrc("");
			setInputMethod("upload");
		}
	}
	/**
	 * handlePredictionSelect:
	 *   Sets the selected prediction, switches the view to 'upload' mode,
	 *   and displays the video associated with the selected prediction.
	 *   Manages object URL creation and revocation for the video preview.
	 */
	const handlePredictionSelect = async (prediction: PredictionResult) => {
		setSelectedPrediction(prediction);

		if (videoSrc && videoSrc.startsWith("blob:")) {
			URL.revokeObjectURL(videoSrc);
			console.log("Revoked previous videoSrc URL:", videoSrc);
		}
		const videoBlob = prediction.videoBlob;

		if (videoBlob) {
			inputMethod !== "camera" && await playVideoToPreview(videoBlob, prediction.videoName);
		} else {
			console.warn("Selected prediction has no video data.");
			setVideoSrc("");
			setInputMethod("upload");
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
	 *   clears the video element source, stops the timer, and resets related state.
	 */
	const stopCamera = () => {
		if (!isCameraActiveRef.current) {
			console.log("stopCamera: Camera is already inactive.")
			return
		}
		console.log("--- stopCamera called ---")
		isCameraActiveRef.current = false

		// Stop timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current)
			timerIntervalRef.current = null
			console.log("stopCamera: Cleared elapsedTime timer.")
		}

		// Stop recorder using the ref
		const currentRecorder = recorderRef.current;
		if (currentRecorder && currentRecorder.state === "recording") {
			console.log(`stopCamera: Recorder found (state: ${currentRecorder.state}). Stopping.`);
			// Remove event listeners before stopping to prevent unwanted restarts
			currentRecorder.onstop = null;
			currentRecorder.ondataavailable = null;
			currentRecorder.onerror = null;
			currentRecorder.stop();
			console.log("stopCamera: Recorder stop() called.");
		}
		recorderRef.current = null; // Clear the ref
		setRecorder(null); // Clear the state as well

		if (cameraStreamRef.current) {
			cameraStreamRef.current.getTracks().forEach(track => track.stop())
			cameraStreamRef.current = null
		}
		if (videoRef.current && videoRef.current.srcObject) {
			const stream = videoRef.current.srcObject as MediaStream;
			stream.getTracks().forEach(track => track.stop());
			videoRef.current.srcObject = null;
		}

		console.log("--- stopCamera finished ---")
	}

	/**
	 * restartRecorder:
	 *   Called after a chunk is processed (from onstop) to set up the next recording cycle.
	 */
	const restartRecorder = () => {
		if (!isCameraActiveRef.current) {
			console.log("restartRecorder: Camera is not active, not restarting.");
			return;
		}
		if (!cameraStreamRef.current || !cameraStreamRef.current.active) {
			handleError("Cannot restart recorder: Camera stream is missing or inactive.");
			stopCamera();
			return;
		}
		console.log("restartRecorder: Setting up next recorder instance...");
		createContinuousRecorder(cameraStreamRef.current);
		// The useEffect[recorder] hook will start the new recorder instance
	};

	/**
	 * createContinuousRecorder:
	 *   Creates a MediaRecorder instance, sets up event handlers (including onstop for restart),
	 *   and updates the recorder state and ref. Does NOT start the recording itself.
	 */
	const createContinuousRecorder = (mediaStream: MediaStream) => {
		if (!mediaStream || !mediaStream.active) {
			handleError("No active stream available for recording");
			stopCamera();
			return;
		}

		// Stop previous recorder if exists (belt-and-suspenders)
		if (recorderRef.current && recorderRef.current.state === "recording") {
			console.warn("createContinuousRecorder: Found existing recording recorder. Stopping it first.");
			recorderRef.current.onstop = null; // Prevent restart loop
			recorderRef.current.stop();
		}

		try {
			if (typeof MediaRecorder === 'undefined') {
				throw new Error("MediaRecorder not supported in this browser")
			}

			const mimeType = getSupportedMimeType()
			const options = mimeType ? {mimeType} : undefined
			console.log(`Creating MediaRecorder with options:`, options)

			const newMediaRecorder = new MediaRecorder(mediaStream, options)
			recorderRef.current = newMediaRecorder; // Update the ref immediately

			newMediaRecorder.onstart = () => {
				console.log("MediaRecorder started (manual cycle)")
			}

			newMediaRecorder.onerror = (event) => {
				const error = (event as any)?.error;
				handleError("Recording error occurred.", error);
				stopCamera() // Stop everything on error
			}

			newMediaRecorder.onstop = () => {
				console.log("MediaRecorder stopped (manual cycle)")
				// Check if we should restart (i.e., wasn't stopped by user changing mode)
				if (isCameraActiveRef.current) {
					console.log("onstop: Camera still active, calling restartRecorder.");
					restartRecorder();
				} else {
					console.log("onstop: Camera not active, not restarting.");
				}
			}

			newMediaRecorder.ondataavailable = (event) => {
				console.log(`ondataavailable: Event fired. Data size: ${event.data?.size || 0} bytes`)
				// Check camera active state *again* here for safety
				if (isCameraActiveRef.current && event.data && event.data.size > 0) {
					console.log("ondataavailable: Blob received with type:", event.data.type)

					const chunk = new Blob([event.data], {
						type: event.data.type || getSupportedMimeType() || 'video/webm' // Use detected or default MIME type
					});

					console.log("Created new blob:", chunk.size, "bytes, type:", chunk.type);
					sendVideoForPrediction(chunk)
				} else {
					console.warn("ondataavailable: Ignoring data - camera not active or data empty.")
				}
			}
			console.log("createContinuousRecorder: New recorder instance created and ref updated.");
			setRecorder(newMediaRecorder); // Update state to trigger useEffect

		} catch (err) {
			handleError("Failed to initialize camera recording.", err);
			recorderRef.current = null;
			setRecorder(null);
			stopCamera(); // Clean up if initialization fails
		}
	}

	/**
	 * startCamera:
	 *   Requests camera access, attaches stream, starts the 30s stop timer,
	 *   and calls `createContinuousRecorder` to set up the initial recorder.
	 */
	const startCamera = async () => {
		if (isCameraActiveRef.current) {
			console.log("startCamera: Camera is already active.")
			return
		}
		console.log(">>> startCamera called <<<")
		isCameraActiveRef.current = true

		// Reset and start timer - THIS timer now calls stop()
		setElapsedTime(0)
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current)
		}

		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(prev => {
				const nextTime = prev + 1;
				// Stop the recorder every 30 seconds
				if (nextTime > 0 && nextTime % INTERVAL_TIME === 0) {
					console.log(`Elapsed time ${nextTime}s: Stopping recorder for chunk.`);
					const currentRecorder = recorderRef.current; // Use ref
					if (currentRecorder && currentRecorder.state === "recording") {
						currentRecorder.stop(); // This triggers ondataavailable, then onstop (which restarts)
					} else {
						console.warn(`Timer interval: Recorder not found or not recording (state: ${currentRecorder?.state})`);
					}
					return nextTime;
				}
				return nextTime;
			});
		}, 1000)
		console.log("startCamera: Started stop timer.")

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
				videoRef.current.style.transform = "none" // Reset potential transforms
				videoRef.current.onloadedmetadata = () => {
					console.log("startCamera: video metadata loaded.")
					videoRef.current?.play().then(() => {
						console.log("startCamera: video playback started, calling createContinuousRecorder for initial setup.")
						// Create the *first* recorder. useEffect[recorder] will start it.
						createContinuousRecorder(mediaStream)
					}).catch(e => {
						handleError("Error playing camera preview.", e);
						stopCamera();
					})
				}
				videoRef.current.onerror = (e) => {
					handleError("Error loading video metadata.", e);
					stopCamera();
				}
			} else {
				throw new Error("Video element not found.");
			}
		} catch (err) {
			handleError("Could not access or set up camera.", err);
			stopCamera(); // Ensure full cleanup on error
		}
		console.log(">>> startCamera finished <<<")
	}

	/**
	 * useEffect hook to handle changes in the input method.
	 * Starts the camera setup if 'camera' is selected, stops it otherwise.
	 * Handles cleanup on component unmount or when inputMethod changes again.
	 */
	useEffect(() => {
		if (!isMountedRef.current) {
			isMountedRef.current = true
			return
		}
		if (inputMethod === "camera") {
			console.log("Input method changed to camera, starting camera setup...")
			startCamera()
		} else {
			console.log("Input method changed to upload, stopping camera...")
			stopCamera()
		}

		return () => {
			console.log("Cleanup: Stopping camera due to input method change or unmount...")
			stopCamera()
			if (videoSrc && videoSrc.startsWith("blob:")) {
				URL.revokeObjectURL(videoSrc)
				console.log("Cleanup: Revoked videoSrc URL:", videoSrc)
			}
		}
	}, [inputMethod])

	/**
	 * useEffect hook to start the MediaRecorder when it's created/set in state
	 * and the input method is 'camera'. Handles both initial start and restarts.
	 */
	useEffect(() => {
		// Use the recorder from state for triggering, but the ref for actions
		const currentRecorder = recorderRef.current;

		if (!currentRecorder || inputMethod !== "camera" || !isCameraActiveRef.current) {
			return;
		}

		if (currentRecorder.state === "inactive") {
			console.log("useEffect[recorder]: Recorder ready and inactive. Starting recording (manual cycle).")
			try {
				// Start without timeslice, manual stop/start cycle handles chunks
				currentRecorder.start();
				console.log("useEffect[recorder]: MediaRecorder state after start:", currentRecorder.state)
			} catch (e) {
				handleError("Failed to start recording via useEffect.", e);
				stopCamera()
			}
		} else {
			console.log(`useEffect[recorder]: Recorder exists but not inactive (state: ${currentRecorder.state}). Not starting again.`)
		}

	}, [recorder, inputMethod]); // Depend on recorder state change

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
									<p className="text-muted-foreground">No preview</p>
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
						{inputMethod === 'camera' && (
							<div
								className="absolute top-2 left-2 bg-black/60 text-white px-3 py-1.5 rounded-lg shadow flex items-center space-x-2">
								<Clock className="h-4 w-4"/>
								<span className="font-mono font-medium tabular-nums">
                  {formatTimeRemaining(getRemainingSeconds())}
                </span>
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
									Upload
								</Button>
							</>
						) : (
							<>
								<p className="text-xs text-muted-foreground text-center">
									Camera is rolling! Prediction will start after {INTERVAL_TIME} seconds
								</p>
							</>
						)}
					</div>
					<div className="flex flex-col gap-4">
						<div
							className="aspect-square bg-card rounded-lg flex items-center justify-center p-4 flex-1 overflow-hidden border border-border">
							{selectedPrediction?.error ? (
								<div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
									<AlertCircle className="h-8 w-8 text-muted-foreground mb-2"/>
									<p className="text-sm font-medium text-foreground">
										Emotions playing hide and seek
									</p>
									<p className="text-xs text-muted-foreground max-w-[200px]">
										Our emotion detector hit a snag. Let&apos;s try another video clip!
									</p>
								</div>
							) : selectedPrediction?.emotions && selectedPrediction.emotions.length > 0 ? (
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={selectedPrediction.emotions}
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
											{selectedPrediction.emotions.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]}/>
											))}
										</Pie>
										<RechartsTooltip
											formatter={(value) => `${(value as number).toFixed(0)}%`}
											labelFormatter={(name) => `${name}`}
										/>
									</PieChart>
								</ResponsiveContainer>
							) : (
								<div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
									<div className="flex items-center gap-1">
										<p className="text-sm font-medium text-foreground">Emotion radar</p>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<HelpCircle className="h-4 w-4 text-foreground cursor-pointer"/>
												</TooltipTrigger>
												<TooltipContent className="p-2 max-w-[220px]">
													<p className="text-xs">Pick a result or record something new to see emotions in action</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
								</div>
							)}
						</div>
					</div>
				</Card>

				<Card className="p-6 space-y-6 md:col-span-3">
					<div className="flex flex-col h-[600px]">
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									className="flex items-center gap-1"
									onClick={selectAllRows}
									disabled={predictionResults.length === 0}
								>
									<CheckCircle2 className="h-3 w-3"/>
									<span className="text-xs">All</span>
								</Button>
								{selectedRows.size > 0 && (
									<>
										<Button
											variant="outline"
											size="sm"
											className="flex items-center gap-1"
											onClick={clearSelection}
										>
											<Check className="h-3 w-3"/>
											<span className="text-xs">{selectedRows.size} selected</span>
										</Button>
										<Button
											variant="outline"
											size="sm"
											className="flex items-center gap-1 text-destructive hover:text-destructive"
											onClick={deleteSelected}
										>
											<Trash2 className="h-3 w-3"/>
											<span className="text-xs">Delete</span>
										</Button>
									</>
								)}
							</div>
							<div className="flex items-center gap-2">
								<Button
									variant="secondary"
									size="sm"
									className="flex items-center gap-1"
									onClick={exportToPdf}
									disabled={selectedRows.size === 0 || isExporting}
								>
									<span className="text-xs">{isExporting ? 'Generating...' : 'Preview Report'}</span>
								</Button>
							</div>
						</div>
						<div className="flex-1 overflow-auto">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[30px]"></TableHead>
										<TableHead>Time</TableHead>
										<TableHead>Video Name</TableHead>
										<TableHead>Result</TableHead>
										<TableHead>Confidence</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{predictionResults.length > 0 ? (
										predictionResults.map((row, i) => (
											<TableRow
												key={i}
												className={`hover:bg-muted ${selectedPrediction === row ? 'bg-muted' : ''}`}
											>
												<TableCell className="pl-4">
													<Checkbox
														checked={row.id ? selectedRows.has(row.id) : false}
														onCheckedChange={() => toggleRowSelection(row.id)}
														onClick={(e) => e.stopPropagation()}
														disabled={!!row.error} // Disable selection for failed predictions
													/>
												</TableCell>
												<TableCell
													className="cursor-pointer"
													onClick={() => handlePredictionSelect(row)}
												>
													{row.time}
												</TableCell>
												<TableCell
													className="cursor-pointer"
													onClick={() => handlePredictionSelect(row)}
												>
													{row.videoName}
												</TableCell>
												<TableCell
													className="cursor-pointer"
													onClick={() => handlePredictionSelect(row)}
												>
													{row.result}
												</TableCell>
												<TableCell
													className="cursor-pointer"
													onClick={() => handlePredictionSelect(row)}
												>
													{row.confidence}
												</TableCell>
											</TableRow>
										))
									) : (
										<TableRow>
											<TableCell colSpan={5} className="py-12"/>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
						<div className="flex-1 mt-6 overflow-hidden border-t border-border pt-4">
							{selectedPrediction?.error ? (
								<div className="flex flex-col items-center justify-center h-full text-center p-6 bg-muted rounded-lg">
									<AlertCircle className="h-10 w-10 text-muted-foreground mb-3"/>
									<h3 className="text-lg font-medium text-foreground">
										Houston, we have a problem
									</h3>
									<p className="mt-1 text-sm text-muted-foreground">
										{selectedPrediction.videoName} at {selectedPrediction.time}
									</p>
									<div
										className="mt-4 p-3 bg-card border border-border rounded text-sm text-muted-foreground max-w-md overflow-auto">
										<p className="font-mono whitespace-pre-wrap">{selectedPrediction.error}</p>
									</div>
								</div>
							) : selectedPrediction?.visualization ? (
								<>
									<h3 className="text-lg font-semibold mt-2 mb-4 text-foreground">
										{selectedPrediction.videoName}
									</h3>
									<div className="border border-border rounded-lg overflow-hidden">
										<Image
											src={selectedPrediction.visualization}
											alt="Video frames with emotion predictions"
											className="w-full h-full object-contain"
											width={800}
											height={600}
											priority
										/>
									</div>
								</>
							) : (
								<div className="flex flex-col items-center justify-center h-full text-center">
									<div className="flex items-center gap-1">
										<p className="text-sm font-medium text-foreground">Visual insights</p>
										<TooltipProvider>
											<Tooltip>
												<TooltipTrigger asChild>
													<HelpCircle className="h-4 w-4 text-foreground cursor-pointer"/>
												</TooltipTrigger>
												<TooltipContent className="p-2 max-w-[220px]">
													<p className="text-xs">Click any result in the table above to reveal the visual evidence</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									</div>
								</div>
							)}
						</div>
					</div>
				</Card>
			</div>

			<AlertDialog open={showError} onOpenChange={setShowError}>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<div className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-foreground"/>
							<AlertDialogTitle>Action Interrupted</AlertDialogTitle>
						</div>
						<AlertDialogDescription className="mt-3">
							<div className="p-3 bg-muted rounded-md border border-border">
								<p className="text-sm text-foreground whitespace-pre-wrap font-medium">
									{errorMessage}
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction>Got it!</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Success Export Dialog */}
			<AlertDialog open={showExportDialog} onOpenChange={setShowExportDialog}>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<div className="flex items-center gap-2">
							<CheckCircle2 className="h-5 w-5 text-green-500"/>
							<AlertDialogTitle>Report Generated Successfully</AlertDialogTitle>
						</div>
						<AlertDialogDescription className="mt-3">
							<div className="p-4 bg-muted rounded-md border border-border">
								<p className="text-sm text-foreground">
									Your report has been generated and saved to your downloads folder. You can view it in any PDF reader.
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogAction>Close</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Preview Dialog */}
			<AlertDialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
				<AlertDialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0">
					<AlertDialogHeader className="p-4 border-b">
						<div className="flex items-center justify-between w-full">
							<div className="flex items-center gap-2">
								<FileText className="h-5 w-5 text-foreground"/>
								<AlertDialogTitle>Report Preview</AlertDialogTitle>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowPreviewDialog(false)}
							>
								<X className="h-4 w-4"/>
							</Button>
						</div>
					</AlertDialogHeader>

					<div className="overflow-auto p-4 flex-1 max-h-[70vh]">
						{previewImageSrc ? (
							<div className="flex justify-center">
								<img
									src={previewImageSrc}
									alt="Report Preview"
									className="max-w-full border border-border shadow-sm rounded"
								/>
							</div>
						) : (
							<div className="flex items-center justify-center py-12">
								<p className="text-muted-foreground">Generating preview...</p>
							</div>
						)}
					</div>

					<AlertDialogFooter className="p-4 border-t">
						<Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
							Cancel
						</Button>
						<Button className="flex items-center gap-1" onClick={downloadPdf}>
							Download PDF
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	)
}
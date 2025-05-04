"use client";

import React, {useEffect, useState, useRef} from "react";
import {useTheme} from "next-themes"; // Import useTheme
// @ts-ignore
import ExcelViewer from "excel-viewer";
import "@/styles/excel-viewer.css";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogContent,
	AlertDialogDescription, AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {AlertCircle} from "lucide-react";

export default function DatasetPage() {
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [showError, setShowError] = useState<boolean>(false)
	const {resolvedTheme} = useTheme(); // Get the resolved theme (light/dark)
	const viewerContainerRef = useRef<HTMLDivElement>(null); // Ref for the container

	useEffect(() => {
		// Ensure this runs only client-side and theme is available
		if (typeof window === "undefined" || !resolvedTheme || !viewerContainerRef.current) {
			return;
		}

		// Clear previous viewer instance before creating a new one
		if (viewerContainerRef.current) {
			viewerContainerRef.current.innerHTML = '';
		}

		setIsLoading(true);
		setErrorMessage(null);

		const initializeExcelViewer = () => {
			// Delay to ensure DOM is ready after theme change potentially re-renders
			const timerId = setTimeout(() => {
				try {
					console.log(`Initializing ExcelViewer with theme: ${resolvedTheme}`);
					const viewer = new ExcelViewer("#excel-view", "http://localhost:5001/api/codebook", {
						theme: resolvedTheme === 'dark' ? 'dark' : 'light', // Use resolvedTheme
						lang: "en"

					});

					if (!viewer) {
						throw new Error("ExcelViewer constructor failed.");
					}

					console.log("ExcelViewer initialized.");
					setIsLoading(false);
				} catch (err: any) {
					console.error("Excel viewer initialization error:", err);
					setErrorMessage(`Failed to load Excel viewer: ${err.message || 'Unknown error'}`);
					setShowError(true);
					setIsLoading(false);
				}
			}, 10);

			return () => clearTimeout(timerId);
		};

		// Directly call initializeExcelViewer and store its cleanup function
		initializeExcelViewer();

		return () => {
			if (viewerContainerRef.current) {
				// eslint-disable-next-line react-hooks/exhaustive-deps
				viewerContainerRef.current.innerHTML = '';
			}
		};
	}, [resolvedTheme]); // Re-run effect when resolvedTheme changes

	return (
		<div>
			{isLoading && <p className="text-center">Loading codebook...</p>}
			<div id="excel-view" ref={viewerContainerRef}
			     style={{visibility: isLoading ? 'hidden' : 'visible'}}></div>
			<AlertDialog open={showError} onOpenChange={setShowError}>
				<AlertDialogContent className="max-w-md">
					<AlertDialogHeader>
						<div className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-foreground"/>
							<AlertDialogTitle>Oops! A Tiny Hiccup</AlertDialogTitle>
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
		</div>
	);
}
/*
 * SPDX-License-Identifier: AGPL-3.0-only
 * page.tsx
 * Copyright (C) 2025 Nextify Limited
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 */

"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@libra/ui/components/card";
import { CheckIcon, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function GitHubSuccessPage() {
	const router = useRouter();
	const [countdown, setCountdown] = useState(10);
	const [autoClose, setAutoClose] = useState(true);
	const [isClient, setIsClient] = useState(false);

	// Check if we're on the client side
	useEffect(() => {
		setIsClient(true);
	}, []);

	// Auto-close functionality
	useEffect(() => {
		if (!autoClose) return;

		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					handleCloseWindow();
					return 0;
				}
				return prev - 1;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, [autoClose]);

	const handleCloseWindow = () => {
		// Try to close the window if it was opened as a popup
		if (isClient && window.opener) {
			window.close();
		} else {
			// If not a popup, redirect to dashboard
			router.push('/dashboard');
		}
	};

	const handleGoToDashboard = () => {
		router.push('/dashboard');
	};

	const handleCancelAutoClose = () => {
		setAutoClose(false);
	};

	return (
		<div className="min-h-[80vh] flex items-center justify-center">
			<div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
			<Card className="w-full max-w-md">
				<CardHeader>
					<div className="flex items-center justify-center w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
						<CheckIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
					</div>
					<CardTitle className="text-2xl font-bold text-center text-green-700 dark:text-green-400">
						GitHub Integration Successful!
					</CardTitle>
					<CardDescription className="text-center">
						Your GitHub account has been successfully connected to your organization.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4 text-center">
						<p className="text-sm text-muted-foreground">
							You can now access your GitHub repositories and manage your projects
							directly from your dashboard.
						</p>
						{autoClose && (
							<div className="p-3 bg-muted rounded-lg">
								<p className="text-sm font-medium">
									This window will close automatically in {countdown} seconds
								</p>
								<Button
									variant="link"
									size="sm"
									onClick={handleCancelAutoClose}
									className="mt-1 h-auto p-0 text-xs"
								>
									Cancel auto-close
								</Button>
							</div>
						)}
					</div>
				</CardContent>
				<CardFooter className="flex flex-col gap-3">
					<Button onClick={handleCloseWindow} className="w-full">
						{isClient && window.opener ? "Close Window" : "Continue"}
					</Button>
					{isClient && !window.opener && (
						<Button
							variant="outline"
							onClick={handleGoToDashboard}
							className="w-full gap-2"
						>
							Go to Dashboard
							<ExternalLink className="w-4 h-4" />
						</Button>
					)}
				</CardFooter>
			</Card>
		</div>
	);
}

import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const archivo = Archivo({
	variable: "--font-archivo",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: { default: "Ember Factory OS", template: "%s · Ember Factory OS" },
	description: "Label studio for the Ember packing site: edit, group, print and scan labels.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en-GB" className={`${archivo.variable} h-full antialiased`}>
			<body className="flex min-h-full flex-col font-sans">
				<ToastProvider>{children}</ToastProvider>
			</body>
		</html>
	);
}

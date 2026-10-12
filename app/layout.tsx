import type { Metadata, Viewport } from "next";
import { Archivo, Arimo, Caladea, Noto_Sans, Tinos } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const archivo = Archivo({
	variable: "--font-archivo",
	subsets: ["latin"],
});

// Free fonts with the same letter widths as the ones the LibreOffice labels
// use (Cambria, Liberation Serif/Sans, Noto Sans), so imported labels keep
// their layout. Caladea is on almost every label; the rest load when used.
const caladea = Caladea({ variable: "--font-caladea", subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"] });
const tinos = Tinos({ variable: "--font-tinos", subsets: ["latin"], weight: ["400", "700"], preload: false });
const arimo = Arimo({ variable: "--font-arimo", subsets: ["latin"], weight: ["400", "700"], preload: false });
const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"], weight: ["400", "700"], preload: false });

export const metadata: Metadata = {
	title: { default: "Ember Factory OS", template: "%s · Ember Factory OS" },
	description: "Label studio for the Ember packing site: edit, group, print and scan labels.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en-GB" className={`${archivo.variable} ${caladea.variable} ${tinos.variable} ${arimo.variable} ${notoSans.variable} h-full antialiased`}>
			<body className="flex min-h-full flex-col font-sans">
				<ToastProvider>{children}</ToastProvider>
			</body>
		</html>
	);
}

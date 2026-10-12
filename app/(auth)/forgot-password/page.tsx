import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function Page() {
	return <AuthForm mode="forgot" />;
}

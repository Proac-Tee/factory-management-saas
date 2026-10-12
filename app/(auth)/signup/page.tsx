import { AuthForm } from "../auth-form";

export default function Page() {
	return (
		<main className="flex flex-1 items-center justify-center p-6">
			<AuthForm mode="signup" />
		</main>
	);
}

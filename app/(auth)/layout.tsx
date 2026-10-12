/** Sign-in screens: one column, phone first (Paper: "Phone – Sign in"). */
export default function AuthLayout({ children }: LayoutProps<"/">) {
	return <main className="flex flex-1 flex-col items-center px-6 pt-14 pb-8 md:justify-center md:py-16">{children}</main>;
}

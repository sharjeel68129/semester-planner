import AuthScreen from "../auth-screen";

export const metadata = { title: "Sign in | AI Semester Planner" };

export default function LoginPage() {
  return <AuthScreen creating={false} />;
}

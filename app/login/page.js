import AuthScreen from "../auth-screen";

export const metadata = {
  title: "Sign in",
  description: "Sign in to your AI Semester Planner calendar.",
};

export default function LoginPage() {
  return <AuthScreen creating={false} />;
}

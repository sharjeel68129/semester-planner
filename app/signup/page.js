import AuthScreen from "../auth-screen";

export const metadata = {
  title: "Create an account",
  description: "Create a free AI Semester Planner account to turn your course outlines into one calendar.",
};

export default function SignupPage() {
  return <AuthScreen creating />;
}

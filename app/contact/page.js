import { OPERATOR } from "@/lib/site";
import AuthShell from "../auth-shell";
import ContactLine from "../contact-line";

export const metadata = {
  title: "Contact",
  description: "How to reach the students who run the AI Semester Planner, and where to report a problem.",
};

export default function Contact() {
  return (
    <AuthShell wide>
      <h1>Contact</h1>
      <p>This site is run by {OPERATOR}. It is not an official PolyU service.</p>
      <p>
        <ContactLine />
      </p>
      <h2>Reporting a wrong or missing date</h2>
      <p>
        Tell us which course outline it was, what the planner showed and what the outline says. Please do not send the
        outline itself if it contains personal information.
      </p>
    </AuthShell>
  );
}

// The reset page runs in the browser, so its title lives here. Only reached from an email link, so search engines skip it.
export const metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordLayout({ children }) {
  return children;
}

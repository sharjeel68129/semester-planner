// The settings page runs in the browser, so its title lives here. It is private, so search engines are told to skip it.
export const metadata = { title: "Settings", robots: { index: false } };

export default function SettingsLayout({ children }) {
  return children;
}

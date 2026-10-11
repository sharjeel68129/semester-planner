import { CONTACT_EMAIL, REPO_URL } from "@/lib/site";

/** How to reach the people who run the site. Says so plainly while no email address has been chosen. */
export default function ContactLine() {
  return CONTACT_EMAIL ? (
    <>
      Email <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, or open an issue on{" "}
      <a className="link" href={`${REPO_URL}/issues`}>
        the project&rsquo;s GitHub page
      </a>
      .
    </>
  ) : (
    <>
      <strong>[Contact email to be added before this site is shared.]</strong> Until then, open an issue on{" "}
      <a className="link" href={`${REPO_URL}/issues`}>
        the project&rsquo;s GitHub page
      </a>
      .
    </>
  );
}

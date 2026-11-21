import type { Metadata } from "next";
import LegalPage, { CONTACT_EMAIL } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Fooddie Scanner" };

const mail = (
  <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>
    {CONTACT_EMAIL}
  </a>
);

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy explains what information Fooddie Scanner (fooddiescanner.com, run from York County, South Carolina) collects, how we use
        it and the choices you have. In short: we collect only what we need to run the library and the contributor program, we don&apos;t
        sell your information, and we don&apos;t use advertising cookies.
      </p>

      <h2>If you just visit the site</h2>
      <p>You don&apos;t need an account to search or read breakdowns. When you visit:</p>
      <ul>
        <li>We use Vercel Web Analytics to count page views. It doesn&apos;t use cookies and reports only totals, such as pages viewed, referring site, country and device or browser type.</li>
        <li>Our hosting provider keeps standard server logs, including IP address and browser type, for a short time for security and to keep the site running.</li>
        <li>We don&apos;t use advertising or cross-site tracking cookies. The only cookie we set is a sign-in cookie for members and the admin.</li>
      </ul>

      <h2>If you become a member</h2>
      <p>When you join and contribute, we collect:</p>
      <ul>
        <li><strong>Account details:</strong> your email, the invite code you used and the username you pick. Passwords are handled by our sign-in provider (Supabase) and are stored only in hashed form. We never see them.</li>
        <li><strong>Reward details:</strong> your phone number and TikTok username, which we use to verify you and pay rewards, plus any payment and tax information needed to send a reward.</li>
        <li><strong>Submissions:</strong> the label photos, product photos and videos you send, and their date and time. Videos may include your face and voice.</li>
        <li><strong>Activity:</strong> your points, accepted and rejected submissions, and the products you were first to scan.</li>
      </ul>
      <p>If you email or call us, we keep that conversation so we can reply.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the library, review submissions, publish accepted ones and make videos.</li>
        <li>To track points, pay rewards and keep tax records the law requires.</li>
        <li>To prevent fraud and abuse, for example duplicate accounts or copied submissions.</li>
        <li>To send account messages, such as email confirmation, password resets and notices that a submission was accepted.</li>
      </ul>
      <p>We don&apos;t send marketing text messages, and we won&apos;t add you to a marketing email list without asking first.</p>

      <h2>What is public</h2>
      <ul>
        <li>Accepted scans: the product name, product and label photos, scores and ingredient breakdown.</li>
        <li>Your username, on the leaderboard and on products you were first to scan. Pick a username that doesn&apos;t identify you if you prefer.</li>
        <li>Accepted videos, including your face and voice if they appear, posted to Fooddie Scanner&apos;s TikTok, Instagram and YouTube.</li>
      </ul>
      <p>Your email, phone number and reward details are never shown publicly. Please keep receipts, addresses and other people out of your photos and videos.</p>

      <h2>Services that process data for us</h2>
      <p>We share only what each provider needs to do its job:</p>
      <ul>
        <li>Vercel (website hosting and analytics), Supabase (database and sign-in) and Cloudflare R2 (photo and video storage).</li>
        <li>Google Cloud (video rendering).</li>
        <li>An AI provider, Google Gemini or Anthropic Claude, which reads label and product photos and ingredient text to produce scores, scripts and captions.</li>
        <li>ElevenLabs, which receives script text to make voiceovers. Your own voice is never sent to it.</li>
        <li>Open Food Facts, which receives a barcode or product name to look up public product data.</li>
        <li>TikTok, Instagram and YouTube, where accepted videos are published.</li>
        <li>A payment provider, when a reward is paid.</li>
      </ul>
      <p>
        We don&apos;t sell personal information or share it for targeted advertising. We may disclose information if the law requires it,
        to protect the safety and rights of our users or ourselves, or as part of a sale or transfer of the service, in which case this
        policy still applies.
      </p>

      <h2>Connected social accounts</h2>
      <ul>
        <li>Only the Fooddie Scanner admin connects TikTok, Instagram or YouTube accounts. We ask only for the permissions needed to identify that account and upload its own videos, and access tokens are encrypted at rest.</li>
        <li>We don&apos;t read followers, messages or other people&apos;s content.</li>
        <li>
          Use of YouTube data follows the <a className="underline" href="https://www.youtube.com/t/terms">YouTube Terms of Service</a> and the{" "}
          <a className="underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>. Access can be removed at any time from your Google, TikTok or Instagram security settings.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        We keep account information while your account is open. Published scans stay up until they are removed. When you delete your
        account, we delete or anonymize your information within 30 days, except records we must keep by law, such as reward payment and tax
        records. Scans you contributed may stay in the library without your username.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>You can view and update your account and reward details on your account page.</li>
        <li>You can ask us to show you, correct, export or delete your personal information, or to remove a submission, by emailing {mail}. We reply within 30 days.</li>
        <li>Some US states give their residents extra privacy rights. We honor these requests for every member, wherever they live, and we won&apos;t treat you differently for using them.</li>
      </ul>

      <h2>Security</h2>
      <p>
        We use encrypted connections, access controls and encryption for sensitive tokens. No service is perfectly secure, so please use a
        password you don&apos;t use anywhere else. If a breach affects your information, we will tell you as the law requires.
      </p>

      <h2>Children</h2>
      <p>
        The public library is not directed at children under 13, and we don&apos;t knowingly collect their information. Member accounts are for
        people 18 and older. Submissions must not show children. If you believe a child has given us information, email us and we will
        delete it.
      </p>

      <h2>Changes and contact</h2>
      <p>
        When this policy changes, we update the date at the top, and we tell members about important changes in the app or by email.
        Questions or requests: {mail}.
      </p>
    </LegalPage>
  );
}

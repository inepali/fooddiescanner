import type { Metadata } from "next";
import LegalPage, { ContactLink } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · Fooddie Scanner" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms cover your use of fooddiescanner.com, its public library of food label breakdowns, member accounts, the contributor
        points program and the Fooddie Scanner videos on TikTok, Instagram and YouTube (together, the &quot;service&quot;). Fooddie Scanner
        is run from York County, South Carolina (&quot;we&quot;, &quot;us&quot;). By using the service you agree to these terms. If you don&apos;t
        agree, please don&apos;t use it.
      </p>

      <h2>1. Information and education only</h2>
      <p>
        Fooddie Scanner reads the ingredient lists printed on packaged foods and explains them in plain language. It exists to help people
        read labels and learn about common ingredients. Nothing on the service is medical, nutritional, dietary, allergy or legal advice,
        and none of it is a safety, quality or regulatory assessment of any product.
      </p>
      <ul>
        <li>Talk to your doctor, a registered dietitian or another qualified professional before you change your diet, especially if you have an allergy, a health condition or are pregnant.</li>
        <li>Always read the actual package before you buy or eat a product. If you have an allergy, rely on the package, not on us.</li>
        <li>We don&apos;t tell anyone to buy or not to buy any product. That choice is yours.</li>
      </ul>

      <h2>2. Scores are our opinion</h2>
      <p>
        The Fooddie Score and each ingredient&apos;s score and reason are our opinion, produced by applying our own general nutrition rubric
        (explained on the home page) with the help of AI software, and in some cases blended with public data from Open Food Facts. They
        are not a statement of fact about any product or company. Different experts weigh ingredients differently and may reasonably
        disagree with our scores. A low score means only that, under our rubric, the ingredient list scored lower. It does not mean a
        product is unsafe, unlawful, mislabeled or harmful to eat.
      </p>

      <h2>3. Accuracy and snapshots</h2>
      <p>
        Each breakdown is a snapshot of the package that was scanned on the date it was scanned. Recipes change, labels differ by region
        and size, and AI and photo reading can make mistakes. We review breakdowns before they are published, but we can&apos;t promise that
        every breakdown is complete, current or error free. If you find a mistake, please tell us (see section 5).
      </p>

      <h2>4. Brands and trademarks</h2>
      <p>
        Fooddie Scanner is independent. We are not affiliated with, sponsored by or endorsed by any food maker, brand or retailer shown on
        the service, and showing a product does not mean its maker approves of our breakdown. Product names, brand names, logos and
        package designs belong to their owners. We show them only to identify the product being discussed.
      </p>

      <h2>5. Corrections and removal requests</h2>
      <p>
        If you are a manufacturer, brand owner, retailer or anyone else who believes a breakdown is inaccurate or out of date, or that
        something on the service infringes your rights, <ContactLink /> with the page link, what you believe is wrong and, if possible, a
        photo of the current label or other supporting information. We review every request in good faith. When a breakdown is wrong or
        out of date we correct it, rescan the product or take the page down, and we remove infringing material.
      </p>

      <h2>6. Using the public site</h2>
      <ul>
        <li>You can read, link to and share breakdowns for personal, non-commercial use, as long as you don&apos;t change the scores or present them as anything other than our opinion.</li>
        <li>Don&apos;t copy the library in bulk, scrape it in a way that burdens the service, try to break into private areas, or use the service for anything unlawful.</li>
        <li>Product facts from <a className="underline" href="https://world.openfoodfacts.org">Open Food Facts</a> (such as Nutri-Score, NOVA and Green-Score) are available under the Open Database License. Nutri-Score, NOVA and Green-Score are systems created by others; we report them, we don&apos;t issue them.</li>
      </ul>

      <h2>7. Member accounts</h2>
      <ul>
        <li>Member accounts are by invite for now. To join you must be at least 18 years old and live in the United States.</li>
        <li>One account per person. Give us accurate information and keep your password private. You are responsible for activity on your account.</li>
        <li>We may decline, suspend or close an account that breaks these terms, submits misleading content or tries to game the points program or the leaderboard.</li>
      </ul>

      <h2>8. Your submissions</h2>
      <p>When you submit label photos, product photos or videos (&quot;submissions&quot;), you promise that:</p>
      <ul>
        <li>You took them yourself, or have the right to share them, and they show the real, unedited package.</li>
        <li>You filmed or photographed legally and followed the rules of the store you were in.</li>
        <li>They don&apos;t show other people&apos;s faces or personal information without their permission, and they never show children.</li>
        <li>They don&apos;t contain your own statements that a brand is lying, that a product is unsafe or illegal, or anything else you can&apos;t back up.</li>
      </ul>
      <p>
        You keep ownership of your submissions. You give us a worldwide, non-exclusive, royalty-free, transferable license to use, store,
        copy, edit, crop, combine, publish and share them, in any media, to run and promote the service, including in breakdowns and in
        videos posted to Fooddie Scanner&apos;s social accounts. If you submit a video, you also agree that we may use your name, username,
        likeness and voice as they appear in it. We may edit your video and add captions, scores, music, graphics and an AI-generated
        voiceover. We decide whether and how to publish a submission and don&apos;t have to publish anything.
      </p>
      <p>
        You can ask us to remove a submission at any time by <ContactLink>contacting us</ContactLink>. We will take it off the site and our own social accounts
        within a reasonable time, but we can&apos;t recall copies other people have already saved or shared.
      </p>

      <h2>9. Contributor points and leaderboard</h2>
      <ul>
        <li>Points are added only for submissions we review and accept. Acceptance is at our discretion. Current point values are shown on the site and may change for future submissions.</li>
        <li>Points are for recognition only. They have no monetary or cash value and can&apos;t be redeemed, exchanged or paid out for money, prizes, gift cards or anything else. They are not your property and can&apos;t be sold, transferred or combined between accounts.</li>
        <li>The ten members with the most points are shown on a public leaderboard by username. Being on the leaderboard doesn&apos;t earn you anything else.</li>
        <li>We may remove points earned through fraud, duplicate or copied submissions, multiple accounts or other breaks of these terms, and take an account off the leaderboard.</li>
        <li>We may change point values, reset the leaderboard, or end the program at any time. Because points have no value, nothing is owed when that happens.</li>
        <li>Taking part doesn&apos;t make you our employee, agent or partner.</li>
        <li>If you post content about Fooddie Scanner on your own accounts, please say that you&apos;re a Fooddie Scanner contributor.</li>
      </ul>

      <h2>10. Our videos and AI</h2>
      <p>
        Fooddie Scanner videos show real products and real footage. Scripts are written with AI help and reviewed by us, and voiceovers
        are AI-generated from our founder&apos;s own cloned voice, used with his permission. We label AI-generated content where a platform asks us to. Videos follow
        the same rules as the library: they are our opinion of an ingredient list, for information only.
      </p>
      <p>
        The admin tool can post to our own TikTok, Instagram and YouTube accounts, and acts on an account only when we choose to post. Your
        use of those platforms is governed by their own terms.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind, express or implied, including
        warranties of accuracy, fitness for a particular purpose and non-infringement. We don&apos;t promise that the service will always be
        available or free of errors.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, Fooddie Scanner and the people who run it are not liable for any indirect, incidental, special
        or consequential damages, or for any loss that comes from relying on a score, a breakdown or a video, including decisions about
        what to buy or eat. Our total liability for any claim about the service is limited to $100. Some places don&apos;t allow these limits, so they may not all apply to you.
      </p>

      <h2>13. Indemnity</h2>
      <p>
        If you are a member, you agree to cover our reasonable costs, including legal fees, if a claim is brought against us because of
        your submissions or your break of these terms.
      </p>

      <h2>14. Disputes</h2>
      <p>
        If you have a problem with the service, please email us first so we can try to fix it informally. These terms are governed by the
        laws of South Carolina, without regard to its conflict-of-law rules. Any dispute that we can&apos;t resolve informally will be heard
        in the state courts located in York County, South Carolina, or the federal court for the District of South Carolina.
      </p>

      <h2>15. Changes and contact</h2>
      <p>
        We may update these terms. When we do, we change the date at the top, and if a change matters to members we tell them in the app
        or by email. Using the service after an update means you accept the new terms. Questions? <ContactLink>Reach out here</ContactLink>.
      </p>
    </LegalPage>
  );
}

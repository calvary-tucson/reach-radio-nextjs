import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPolicyPage() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto prose prose-invert">
      <Link href="/about" className="text-white/60 text-sm mb-6 block hover:text-white not-prose">
        ← About
      </Link>
      <h1>Privacy Policy</h1>
      <p className="text-white/60 text-sm">Last updated: {new Date().getFullYear()}</p>
      <p>
        Reach Radio / Calvary Chapel of Tucson, Inc. operates the Reach Radio mobile app and website.
        This page informs you of our policies regarding collection and use of personal data.
      </p>
      <h2>Data We Collect</h2>
      <p>
        We do not collect personal data directly. The contact form submits data to Formspree.
        The app uses Google reCAPTCHA to protect against spam.
      </p>
      <h2>Third-Party Services</h2>
      <ul>
        <li>RadioJar — audio streaming</li>
        <li>Sanity — content management</li>
        <li>Formspree — contact form processing</li>
        <li>Google reCAPTCHA — spam protection</li>
        <li>Ministry Forms — donation processing</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions? Contact us via the <Link href="/about">About page</Link>.</p>
    </div>
  )
}

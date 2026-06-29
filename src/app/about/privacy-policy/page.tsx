import type { Metadata } from 'next'
import Link from 'next/link'
import { ShowMediaBar } from '@/components/media-bar/ShowMediaBar'
import Breadcrumbs from '@/components/global/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: "Privacy Policy for Reach Radio Tucson's website and mobile applications.",
  alternates: { canonical: '/about/privacy-policy' },
  openGraph: {
    title: 'Privacy Policy — Reach Radio',
    description: "Privacy Policy for Reach Radio Tucson's website and mobile applications.",
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <ShowMediaBar />
      <Breadcrumbs
        variant="standalone"
        items={[
          { name: 'About', url: '/about' },
          { name: 'Privacy Policy', url: '/about/privacy-policy' },
        ]}
      />
      <div className="px-4 md:px-8 pt-10 md:pt-6 pb-8">
      <div className="prose prose-invert max-w-none">
        <h1>Privacy Policy</h1>
        <p><strong>Last updated:</strong> March 17, 2026</p>
        <p>
          Calvary Chapel of Tucson, Inc. ("we," "us," or "our") operates the Reach Radio website (
          <a href="https://reach.radio">reach.radio</a>) and the Reach Radio mobile applications available on the{' '}
          <a href="https://apps.apple.com/us/app/reach-radio-fm/id1246500077" target="_blank" rel="noopener noreferrer">
            Apple App Store
          </a>{' '}
          and the{' '}
          <a href="https://play.google.com/store/apps/details?id=com.goodbarber.reachradio&hl=en_US&gl=US" target="_blank" rel="noopener noreferrer">
            Google Play Store
          </a>{' '}
          (collectively, the "Service"). This Privacy Policy describes how we collect, use, and protect
          your information when you use the Service.
        </p>
        <p>
          We are committed to maintaining your privacy and believe that as a user of the Service you are
          entitled to know our information practices.
        </p>

        <h2>About the Mobile Applications</h2>
        <p>
          The Reach Radio mobile apps for Android and iOS are hybrid applications. They load web content
          from our website and provide native audio playback so you can listen to Reach Radio&apos;s live stream.
          The apps do not require you to create an account or log in.
        </p>

        <h2>Information We Collect</h2>
        <h3>Information You Provide Voluntarily</h3>
        <p>
          If you choose to contact us through the contact form on our website, we collect the information
          you submit, such as your name, email address, and message content. This information is used
          solely to respond to your inquiry and is not shared with third parties.
        </p>
        <h3>Information Collected Automatically</h3>
        <p>The Reach Radio mobile apps and website do <strong>not</strong> collect personal data automatically. Specifically:</p>
        <ul>
          <li>We do not use analytics or tracking services.</li>
          <li>We do not use advertising networks or ad identifiers.</li>
          <li>We do not collect device identifiers, location data, or usage statistics.</li>
          <li>We do not require user accounts, login, or registration.</li>
        </ul>
        <p>
          The app does process audio stream metadata (such as song title, artist name, and artwork) from
          our streaming service in order to display "now playing" information. This metadata is not stored
          and does not contain personal information.
        </p>
        <h3>Photographic Images</h3>
        <p>
          Photographic images of individuals and groups at Calvary Chapel of Tucson, Inc. events may be
          displayed on the website. We will not sell, share, or rent any of these images to third parties.
        </p>

        <h2>Device Permissions (Mobile Apps)</h2>
        <p>The Reach Radio mobile apps request the following device permissions to function properly:</p>
        <ul>
          <li><strong>Internet access</strong> — Required to stream audio content and load web content from our servers.</li>
          <li><strong>Foreground service</strong> — Allows audio playback to continue when the app is in the background or the screen is off.</li>
          <li><strong>Wake lock</strong> — Prevents the device from sleeping during active audio playback.</li>
          <li><strong>Network state</strong> — Used to detect internet connectivity and handle connection changes gracefully.</li>
          <li><strong>Notifications</strong> — Used to display media playback controls in the notification shade while audio is playing.</li>
        </ul>
        <p>
          These permissions are used exclusively for audio streaming and playback functionality. No permissions
          are used to collect, transmit, or store personal data.
        </p>

        <h2>Third-Party Services</h2>
        <p>The Service relies on the following third-party infrastructure:</p>
        <ul>
          <li><strong>Cloudflare Pages / Vercel</strong> — Hosts and delivers the web content displayed within the mobile apps and on the website.</li>
          <li><strong>RadioJar</strong> — Provides the audio streaming infrastructure for live radio playback.</li>
          <li>
            <strong>Formspree</strong> — Processes contact form submissions on our behalf. Formspree&apos;s privacy
            policy is available at{' '}
            <a href="https://formspree.io/legal/privacy-policy/" target="_blank" rel="noopener noreferrer">
              formspree.io/legal/privacy-policy
            </a>.
          </li>
        </ul>
        <p>
          We do not share personal information with any other third-party services, advertisers, or data brokers.
        </p>

        <h2>Data Retention and Deletion</h2>
        <p>
          The Reach Radio mobile apps do not store personal data on your device. Any temporary data cached
          by the embedded web view (such as cookies or cached pages) can be cleared through your device&apos;s
          system settings by clearing the app&apos;s storage or cache.
        </p>
        <p>
          Contact form submissions are retained only as long as necessary to respond to your inquiry. You may
          request deletion of any information you have submitted by contacting us using the information below.
        </p>

        <h2>Security</h2>
        <p>
          Calvary Chapel of Tucson, Inc. takes the security of your information seriously and considers any
          information contained in our records to be confidential. We follow practices to prevent unauthorized
          access to personally identifiable information. However, no method of electronic transmission or
          storage is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2>Children&apos;s Privacy</h2>
        <p>
          The Service is not directed at children under the age of 13. We do not knowingly collect personal
          information from children under 13. If you are a parent or guardian and believe that your child has
          provided us with personal information, please contact us so that we can take appropriate action.
        </p>

        <h2>Changes to This Policy</h2>
        <p>
          Calvary Chapel of Tucson, Inc. may update this Privacy Policy from time to time. We will post the
          revised policy on this page with an updated "Last updated" date. Your continued use of the Service
          after any changes constitutes acceptance of the updated policy.
        </p>

        <h2>Contact Us</h2>
        <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us:</p>
        <ul>
          <li><strong>Online:</strong> <Link href="/about">reach.radio/about</Link> (contact form)</li>
          <li><strong>Website:</strong> <a href="https://calvarytucson.com" target="_blank" rel="noopener noreferrer">calvarytucson.com</a></li>
          <li><strong>Organization:</strong> Calvary Chapel of Tucson, Inc. — Tucson, AZ</li>
        </ul>
      </div>
      </div>
    </div>
  )
}

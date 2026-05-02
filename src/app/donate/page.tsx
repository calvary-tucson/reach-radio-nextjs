import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donate',
  description: 'Support Reach Radio — 106.7FM / 690AM in Tucson, AZ',
}

export default function DonatePage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-white text-2xl font-bold mb-4">Support Reach Radio</h1>
      <p className="text-white/70 mb-6">
        Your generous support keeps Reach Radio on the air.
      </p>
      <iframe
        src="https://forms.ministryforms.net/viewForm.aspx?formId=018b4ff7-2c2f-4938-a6d5-f7a0b8b9e0f1"
        title="Donation Form"
        className="w-full min-h-[600px] border-0"
        loading="lazy"
      />
    </div>
  )
}

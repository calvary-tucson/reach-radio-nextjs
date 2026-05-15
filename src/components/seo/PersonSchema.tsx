interface Props {
  name: string
  jobTitle: string
  imageUrl?: string
  url: string
}

export function PersonSchema({ name, jobTitle, imageUrl, url }: Props) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    jobTitle,
    ...(imageUrl ? { image: imageUrl } : {}),
    url,
    worksFor: {
      '@type': 'Organization',
      name: 'Reach Radio',
      url: 'https://reach-radio.com',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/<\/script>/gi, '<\\/script>') }}
    />
  )
}

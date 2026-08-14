import React from 'react'
import './styles.css'

export const metadata = {
  description: 'Multi-tenant content and release publishing for HYGE.',
  title: 'HYGE Content Platform',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
